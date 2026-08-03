import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient, hgetall } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, SensorData, SystemHealthLog, UptimeStat } from '../types';

function getFirestoreDb() {
  return getFirestore();
}

export async function getAllDevices(): Promise<Device[]> {
  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection('devices').get();
    
    const devices: Device[] = [];
    snapshot.forEach(doc => {
      devices.push({ id: doc.id, ...doc.data() } as Device);
    });

    return devices.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error fetching all devices from Firestore:", error);
    return [];
  }
}

export async function getDeviceById(id: string): Promise<Device | null> {
  try {
    const db = getFirestoreDb();
    const doc = await db.collection('devices').doc(id).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() } as Device;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching device ${id} from Firestore:`, error);
    return null;
  }
}

export async function createDevice(deviceData: Partial<Device>): Promise<Device> {
  const db = getFirestoreDb();
  const deviceId = deviceData.id || `local_dev_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const device: Device = {
    ...deviceData,
    id: deviceId,
    created_at: deviceData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: deviceData.status || 'offline'
  } as Device;

  if (!deviceData.id) {
    await db.collection('devices').doc(deviceId).set(device);
  } else {
    await db.collection('devices').doc(deviceId).set(device, { merge: true });
  }

  return device;
}

/**
 * Fix #31: searchDevices now reads from Redis (O(n) over in-memory cache)
 * instead of fetching all devices from Firestore on every search.
 * This avoids a full Firestore collection scan per keystroke.
 */
export async function searchDevices(query: string): Promise<Device[]> {
  const redis = getRedisClient();
  const q = query.toLowerCase();
  const deviceIds = await redis.sMembers('devices:all');

  const matched: Device[] = [];
  for (const id of deviceIds) {
    const device = await hgetall<Device>(`device:${id}`);
    if (
      device && (
        device.name?.toLowerCase().includes(q) ||
        device.location_name?.toLowerCase().includes(q) ||
        device.node_number?.toLowerCase().includes(q) ||
        device.id?.toLowerCase().includes(q)
      )
    ) {
      matched.push(device);
      if (matched.length >= 50) break; // enforce limit
    }
  }

  // Fallback to Firestore if Redis cache is cold
  if (matched.length === 0 && deviceIds.length === 0) {
    const allDevices = await getAllDevices();
    return allDevices.filter(d =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.location_name && d.location_name.toLowerCase().includes(q)) ||
      (d.node_number && d.node_number.toLowerCase().includes(q)) ||
      (d.id && d.id.toLowerCase().includes(q))
    ).slice(0, 50);
  }

  return matched;
}

export async function getDevicesByStatus(status: string): Promise<Device[]> {
  const allDevices = await getAllDevices();
  return allDevices.filter(d => d.status === status);
}

export async function getDeviceStats(): Promise<any> {
  const allDevices = await getAllDevices();
  
  const totalTds = allDevices.reduce((acc, d) => acc + (d.last_tds || 0), 0);
  const activeDevices = allDevices.filter(d => d.last_tds !== undefined && d.last_tds !== null).length;
  const averageTds = activeDevices > 0 ? totalTds / activeDevices : 0;

  return {
    total_devices: allDevices.length,
    online_count: allDevices.filter(d => d.status === 'online').length,
    offline_count: allDevices.filter(d => d.status === 'offline').length,
    critical_count: allDevices.filter(d => d.status === 'critical').length,
    maintenance_count: allDevices.filter(d => d.status === 'maintenance').length,
    average_tds: Math.round(averageTds * 10) / 10,
    updated_at: new Date().toISOString()
  };
}

/**
 * Fix #30: getDeviceWithRecentData cached in L1 memory cache (30s TTL).
 * Previously fired 3 sequential Firestore reads on every device detail page load.
 * Now serves from fast in-memory cache between refreshes.
 */
export async function getDeviceWithRecentData(id: string): Promise<any> {
  const cacheKey = `device:detail:${id}`;
  const cached = l1Cache.get<any>(cacheKey);
  if (cached) return cached;

  try {
    const device = await getDeviceById(id);
    if (!device) return null;

    const db = getFirestoreDb();

    // Get open alerts count
    const alertsSnapshot = await db.collection('alerts')
      .where('device_id', '==', id)
      .where('status', '==', 'open')
      .get();
    const openAlertsCount = alertsSnapshot.size;

    // Get total readings & latest reading
    const readingsSnapshot = await db.collection('sensor_data')
      .where('device_id', '==', id)
      .orderBy('recorded_at', 'desc')
      .limit(1)
      .get();

    let latestReading = null;
    if (!readingsSnapshot.empty) {
      latestReading = readingsSnapshot.docs[0].data();
    }

    const countSnapshot = await db.collection('sensor_data').where('device_id', '==', id).count().get();
    const totalReadings = countSnapshot.data().count;

    const result = {
      ...device,
      open_alerts_count: openAlertsCount,
      total_readings: totalReadings,
      latest_tds: latestReading?.payload?.tds || latestReading?.tds || null,
      latest_temperature: latestReading?.payload?.temperature || latestReading?.temperature || null,
      latest_voltage: latestReading?.payload?.voltage || latestReading?.voltage || null
    };

    // Cache result for 30 seconds to avoid repeated Firestore reads
    l1Cache.set(cacheKey, result, 30 * 1000);
    return result;
  } catch (error) {
    console.error(`Error fetching recent data for device ${id}:`, error);
    return null;
  }
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

  const db = getFirestoreDb();
  const cleanUpdates = { ...updates };
  delete (cleanUpdates as any).id;
  (cleanUpdates as any).updated_at = updated.updated_at;
  
  await db.collection('devices').doc(deviceId).update(cleanUpdates);

  return updated;
}

async function deleteQueryBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query, resolve: () => void, reject: (err: any) => void) {
  try {
    const snapshot = await query.limit(500).get();

    // When there are no documents left, we are done
    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(db, query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function deleteCollectionByQuery(query: FirebaseFirestore.Query) {
  const db = getFirestoreDb();
  return new Promise<void>((resolve, reject) => {
    deleteQueryBatch(db, query, resolve, reject);
  });
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const db = getFirestoreDb();

  // 1. Purge all associated Firestore collections in batches
  const alertsQuery = db.collection('alerts').where('device_id', '==', deviceId);
  const sensorDataQuery = db.collection('sensor_data').where('device_id', '==', deviceId);
  const uptimeQuery = db.collection('uptime_stats').where('device_id', '==', deviceId);

  await Promise.all([
    deleteCollectionByQuery(alertsQuery),
    deleteCollectionByQuery(sensorDataQuery),
    deleteCollectionByQuery(uptimeQuery)
  ]);

  // 2. Delete the main device document
  await db.collection('devices').doc(deviceId).delete();

  // 3. Purge all corresponding keys in Redis
  try {
    const redis = getRedisClient();
    
    const keysToDelete = [
      `device:${deviceId}`,
      `sensors:${deviceId}`,
      `device:${deviceId}:alerts`,
      `device:${deviceId}:alerts:open`,
      `device:${deviceId}:uptime_records`,
      `notif:debounce:${deviceId}`,
      `notif:last_severity:${deviceId}`,
      `notif:wa_tier_state:${deviceId}`
    ];

    // Delete channel rate limit keys
    const channels = ['global', 'push', 'whatsapp', 'ntfy', 'ifttt'];
    channels.forEach(channel => {
      keysToDelete.push(`notif:rate:${deviceId}:${channel}`);
    });

    await Promise.all(keysToDelete.map(key => redis.del(key)));

    // Remove device from devices:all set
    await redis.sRem('devices:all', deviceId);
    
    console.log(`🗑️ Successfully cleaned up all Firestore records and Redis cache keys for device: ${deviceId}`);
  } catch (error) {
    console.error(`⚠️ Redis cleanup failed or was not initialized during deletion of device ${deviceId}:`, error);
  }
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

export async function getDeviceSensorHistory(deviceId: string, limit: number = 100): Promise<SensorData[]> {
  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection('sensor_data')
      .where('device_id', '==', deviceId)
      .orderBy('recorded_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SensorData));
  } catch (error) {
    console.error(`Error fetching sensor history for device ${deviceId}:`, error);
    return [];
  }
}

export async function getDeviceHealthEvents(deviceId: string, limit: number = 50): Promise<any[]> {
  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection('alerts')
      .where('device_id', '==', deviceId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching health events for device ${deviceId}:`, error);
    return [];
  }
}

export async function getSystemHealthLogs(limit: number = 100): Promise<SystemHealthLog[]> {
  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection('system_health_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemHealthLog));
  } catch (error) {
    console.error("Error fetching system health logs:", error);
    return [];
  }
}

export async function getUptimeStats(deviceId?: string): Promise<UptimeStat[]> {
  try {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection('uptime_stats');
    
    if (deviceId) {
      query = query.where('device_id', '==', deviceId);
    }
    
    const snapshot = await query.orderBy('timestamp', 'desc').get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UptimeStat));
  } catch (error) {
    console.error("Error fetching uptime stats:", error);
    return [];
  }
}
