import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, SensorData, SystemHealthLog, UptimeStat } from '../types';

function getFirestoreDb() {
  return getFirestore();
}

export async function getAllDevices(): Promise<Device[]> {
  const redis = getRedisClient();
  const ids = await redis.sMembers('devices:all');
  
  const devices: Device[] = [];
  for (const id of ids) {
    const device = await getDeviceById(id);
    if (device) devices.push(device);
  }

  // Sort by created_at DESC (if needed)
  return devices.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

export async function getDeviceById(id: string): Promise<Device | null> {
  // 1. Try L1 Cache (In-Memory)
  const cached = l1Cache.get<Device>(`device:${id}`);
  if (cached) return cached;

  // 2. Try L2 Cache (Redis)
  const device = await hgetall<Device>(`device:${id}`);
  
  // 3. Populate L1 if found
  if (device) {
    l1Cache.set(`device:${id}`, device, 30 * 1000); // Cache for 30 seconds
  }
  
  return device;
}

export async function createDevice(deviceData: Partial<Device>): Promise<Device> {
  const db = getFirestoreDb();
  const redis = getRedisClient();
  
  // 1. Generate an ID if needed
  const deviceId = deviceData.id || `local_dev_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // 2. Add to Redis immediately
  const device: Device = {
    ...deviceData,
    id: deviceId,
    created_at: deviceData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: deviceData.status || 'offline'
  } as Device;

  await hset(`device:${deviceId}`, device);
  await redis.sAdd('devices:all', deviceId);
  l1Cache.set(`device:${deviceId}`, device); // Populate L1 cache

  // 3. Async push to Firestore
  if (!deviceData.id) {
    db.collection('devices').doc(deviceId).set(device)
      .catch(e => console.error("Firestore create device sync failed", e));
  } else {
    db.collection('devices').doc(deviceId).set(device, { merge: true })
      .catch(e => console.error("Firestore create/update device sync failed", e));
  }

  return device;
}

export async function searchDevices(query: string): Promise<Device[]> {
  const allDevices = await getAllDevices();
  const q = query.toLowerCase();

  return allDevices.filter(d => 
    (d.name && d.name.toLowerCase().includes(q)) ||
    (d.location_name && d.location_name.toLowerCase().includes(q)) ||
    (d.node_number && d.node_number.toLowerCase().includes(q)) ||
    (d.id && d.id.toLowerCase().includes(q))
  ).slice(0, 50);
}

export async function getDevicesByStatus(status: string): Promise<Device[]> {
  const allDevices = await getAllDevices();
  return allDevices.filter(d => d.status === status);
}

export async function getDeviceStats(): Promise<any> {
  const redis = getRedisClient();
  const cacheKey = 'stats:global';
  
  // 1. Try to get from Redis cache
  const cachedStats = await redis.get(cacheKey);
  if (cachedStats) {
    return JSON.parse(cachedStats);
  }

  // 2. Recalculate if not cached
  const allDevices = await getAllDevices();
  
  const totalTds = allDevices.reduce((acc, d) => acc + (d.last_tds || 0), 0);
  const activeDevices = allDevices.filter(d => d.last_tds !== undefined && d.last_tds !== null).length;
  const averageTds = activeDevices > 0 ? totalTds / activeDevices : 0;

  const stats = {
    total_devices: allDevices.length,
    online_count: allDevices.filter(d => d.status === 'online').length,
    offline_count: allDevices.filter(d => d.status === 'offline').length,
    critical_count: allDevices.filter(d => d.status === 'critical').length,
    maintenance_count: allDevices.filter(d => d.status === 'maintenance').length,
    average_tds: Math.round(averageTds * 10) / 10,
    updated_at: new Date().toISOString()
  };

  // 3. Store in Redis for 60 seconds
  await redis.set(cacheKey, JSON.stringify(stats), {
    EX: 60
  });
  
  return stats;
}

export async function getDeviceWithRecentData(id: string): Promise<any> {
  const device = await getDeviceById(id);
  if (!device) return null;

  const redis = getRedisClient();
  
  // Get open alerts count
  const openAlertsCount = await redis.sCard(`device:${id}:alerts:open`);
  
  // Get total readings
  const totalReadings = await redis.lLen(`sensors:${id}`);
  
  // Get latest reading
  const latestReadingStr = await redis.lIndex(`sensors:${id}`, 0);
  let latestReading = latestReadingStr ? JSON.parse(latestReadingStr) : null;

  return {
    ...device,
    open_alerts_count: openAlertsCount,
    total_readings: totalReadings,
    latest_tds: latestReading?.tds || null,
    latest_temperature: latestReading?.temperature || null,
    latest_voltage: latestReading?.voltage || null
  };
}

export async function updateDeviceTdsThresholds(
  deviceId: string,
  minTds: number,
  maxTds: number
): Promise<Device> {
  const updates = { safe_tds_min: minTds, safe_tds_max: maxTds };
  return await updateDevice(deviceId, updates);
}

export async function updateDeviceStatus(
  deviceId: string,
  status: 'online' | 'offline' | 'critical' | 'maintenance'
): Promise<Device> {
  const updates = { status };
  return await updateDevice(deviceId, updates);
}

export async function updateDevice(
  deviceId: string,
  updates: Partial<Device>
): Promise<Device> {
  const current = await getDeviceById(deviceId);
  if (!current) {
    throw new Error(`Device ${deviceId} not found`);
  }

  const updated: Device = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString()
  };

  // 1. Update Redis & Cache First
  await hset(`device:${deviceId}`, updated);
  l1Cache.set(`device:${deviceId}`, updated); // Update L1 cache

  // 2. Background Firestore Sync
  const db = getFirestoreDb();
  const cleanUpdates = { ...updates };
  delete (cleanUpdates as any).id;
  (cleanUpdates as any).updated_at = updated.updated_at;
  
  db.collection('devices').doc(deviceId).update(cleanUpdates)
    .catch(error => console.error(`⚠️ Could not update device ${deviceId} in Firestore:`, error));

  return updated;
}

export async function deleteDevice(deviceId: string): Promise<void> {
  // 1. Delete from Redis & Cache First
  const redis = getRedisClient();
  await redis.del(`device:${deviceId}`);
  await redis.sRem('devices:all', deviceId);
  await redis.del(`device:${deviceId}:alerts`);
  await redis.del(`device:${deviceId}:alerts:open`);
  await redis.del(`sensors:${deviceId}`);
  l1Cache.del(`device:${deviceId}`);

  // 2. Background Firestore Sync
  const db = getFirestoreDb();
  db.collection('devices').doc(deviceId).delete()
    .catch(error => console.warn(`Could not delete device ${deviceId} from Firestore:`, error));
}

export async function getStaleDevices(hoursAgo: number = 1): Promise<Device[]> {
  const allDevices = await getAllDevices();
  const threshold = Date.now() - hoursAgo * 60 * 60 * 1000;

  return allDevices.filter(d => {
    const lastReading = d.last_reading_at ? new Date(d.last_reading_at).getTime() : 0;
    return lastReading < threshold;
  }).sort((a, b) => {
    const lastA = a.last_reading_at ? new Date(a.last_reading_at).getTime() : 0;
    const lastB = b.last_reading_at ? new Date(b.last_reading_at).getTime() : 0;
    return lastA - lastB;
  });
}

/**
 * Get sensor history for a device from Redis
 */
export async function getDeviceSensorHistory(deviceId: string, limit: number = 100): Promise<SensorData[]> {
  const redis = getRedisClient();
  const key = `sensors:${deviceId}`;
  
  const rawData = await redis.lRange(key, 0, limit - 1);
  return rawData.map(item => JSON.parse(item));
}

/**
 * Get health events (alerts) for a device from Redis
 */
export async function getDeviceHealthEvents(deviceId: string, limit: number = 50): Promise<any[]> {
  const redis = getRedisClient();
  
  // Get alert IDs from the device's alert set
  const alertIds = await redis.sMembers(`device:${deviceId}:alerts`);
  
  const alerts: any[] = [];
  for (const id of alertIds) {
    const alert = await hgetall<any>(`alert:${id}`);
    if (alert) alerts.push(alert);
  }
  
  // Sort by created_at DESC
  return alerts.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  }).slice(0, limit);
}

/**
 * Get all system health logs from Redis
 */
export async function getSystemHealthLogs(limit: number = 100): Promise<SystemHealthLog[]> {
  const redis = getRedisClient();
  const rawData = await redis.lRange('system:health_logs', 0, limit - 1);
  return rawData.map(item => JSON.parse(item));
}

/**
 * Get uptime stats for all devices or a specific device
 */
export async function getUptimeStats(deviceId?: string): Promise<UptimeStat[]> {
  const redis = getRedisClient();
  let records: string[] = [];

  if (deviceId) {
    records = await redis.sMembers(`device:${deviceId}:uptime_records`);
  } else {
    // This is a bit inefficient in Redis without a global index, 
    // but for now we can scan or just return empty if deviceId is missing 
    // for specific analytics. 
    // For the dashboard "Total Uptime", we might want a different approach.
    // Let's assume we want all records for now.
    const keys = await redis.keys('uptime:*:*');
    records = keys;
  }

  const stats: UptimeStat[] = [];
  for (const key of records) {
    const stat = await hgetall<UptimeStat>(key);
    if (stat) stats.push(stat);
  }

  // Sort by timestamp DESC
  return stats.sort((a, b) => {
    const dateA = new Date(a.timestamp || 0).getTime();
    const dateB = new Date(b.timestamp || 0).getTime();
    return dateB - dateA;
  });
}
