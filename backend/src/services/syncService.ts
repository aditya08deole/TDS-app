import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, Alert, SyncLog, SystemHealthLog, UptimeStat } from '../types';
import { TDS_CONFIG } from '../config/tdsConfig';

function getDb() {
  return getFirestore();
}

export interface SyncResult {
  type: 'manual' | 'scheduled' | 'event' | 'startup';
  devicesSynced: number;
  alertsSynced: number;
  sensorEntriesSynced: number;
  healthLogsSynced: number;
  uptimeStatsSynced: number;
  errors: number;
  errorMessage?: string;
  durationMs: number;
}

const SYNC_STATE_KEY = 'sync:state:last_synced_at';

async function getLastSyncedAt(): Promise<Date | null> {
  const redis = getRedisClient();
  const val = await redis.get(SYNC_STATE_KEY);
  return val ? new Date(val) : null;
}

async function setLastSyncedAt(date: Date): Promise<void> {
  const redis = getRedisClient();
  await redis.set(SYNC_STATE_KEY, date.toISOString());
}

export async function syncFromFirebase(syncType: 'manual' | 'scheduled' | 'event' | 'startup' = 'manual'): Promise<SyncResult> {
  const startTime = Date.now();
  let devicesSynced = 0;
  let alertsSynced = 0;
  let sensorEntriesSynced = 0;
  let healthLogsSynced = 0;
  let uptimeStatsSynced = 0;
  let errors = 0;
  let errorLog: string[] = [];
  const isFullSync = syncType === 'manual' || syncType === 'scheduled' || syncType === 'startup';

  try {
    const lastSyncedAt = isFullSync ? null : await getLastSyncedAt();
    console.log(`🔄 Starting ${syncType} sync from Firebase... ${lastSyncedAt ? `(Incremental since ${lastSyncedAt.toISOString()})` : '(Full reconciliation mode)'}`);

    // Sync devices
    try {
      devicesSynced = await syncDevices(lastSyncedAt);
      console.log(`✅ Synced ${devicesSynced} devices`);
    } catch (err: any) {
      console.error('Error syncing devices:', err);
      errors++;
      errorLog.push(`Devices error: ${err.message}`);
    }

    // Sync alerts
    try {
      alertsSynced = await syncAlerts(lastSyncedAt);
      console.log(`✅ Synced ${alertsSynced} alerts`);
    } catch (err: any) {
      console.error('Error syncing alerts:', err);
      errors++;
      errorLog.push(`Alerts error: ${err.message}`);
    }

    // Sync sensor data
    try {
      sensorEntriesSynced = await syncSensorData(lastSyncedAt);
      console.log(`✅ Synced ${sensorEntriesSynced} sensor entries`);
    } catch (err: any) {
      console.error('Error syncing sensor data:', err);
      errors++;
      errorLog.push(`Sensor error: ${err.message}`);
    }

    // Sync health logs
    try {
      healthLogsSynced = await syncHealthLogs(lastSyncedAt);
      console.log(`✅ Synced ${healthLogsSynced} health logs`);
    } catch (err: any) {
      console.error('Error syncing health logs:', err);
      errors++;
      errorLog.push(`Health logs error: ${err.message}`);
    }

    // Sync uptime stats
    try {
      uptimeStatsSynced = await syncUptimeStats(lastSyncedAt);
      console.log(`✅ Synced ${uptimeStatsSynced} uptime stats`);
    } catch (err: any) {
      console.error('Error syncing uptime stats:', err);
      errors++;
      errorLog.push(`Uptime stats error: ${err.message}`);
    }

    // 6. PRUNE ORPHANED KEYS (Full Sync Only)
    // Already handled within syncDevices and syncAlerts for specific collections,
    // but cleanupOrphanedKeys can be used for additional maintenance if needed.
    if (isFullSync) {
      try {
        await cleanupOrphanedKeys();
        console.log('🧹 Orphaned keys reconciliation complete');
      } catch (err: any) {
        console.error('Error during cleanup of orphaned keys:', err);
        errors++;
        errorLog.push(`Cleanup error: ${err.message}`);
      }
    }

    const durationMs = Date.now() - startTime;
    const status = errors === 0 ? 'success' : errors > 2 ? 'failed' : 'partial';
    const finalErrorMessage = errorLog.length > 0 ? errorLog.join(' | ') : undefined;
    // Update last sync time on success
    if (errors === 0) {
      await setLastSyncedAt(new Date(startTime));
    }
    // Log sync result
    await logSync({
      sync_type: syncType,
      devices_synced: devicesSynced,
      alerts_synced: alertsSynced,
      sensor_entries_synced: sensorEntriesSynced,
      errors,
      error_message: finalErrorMessage,
      status,
      duration_ms: durationMs,
    });

    console.log(`✨ Sync completed in ${durationMs}ms (${status})`);

    return {
      type: syncType,
      devicesSynced,
      alertsSynced,
      sensorEntriesSynced,
      healthLogsSynced,
      uptimeStatsSynced,
      errors,
      errorMessage: finalErrorMessage,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logSync({
      sync_type: syncType,
      devices_synced: devicesSynced,
      alerts_synced: alertsSynced,
      sensor_entries_synced: sensorEntriesSynced,
      errors: errors + 1,
      error_message: errorMessage,
      status: 'failed',
      duration_ms: durationMs,
    });

    throw error;
  }
}

async function syncDevices(since?: Date | null): Promise<number> {
  const db = getDb();
  const redis = getRedisClient();
  
  // 1. Get ALL current devices from Firestore to handle deletions
  const allFirebaseDevicesSnapshot = await db.collection('devices').select().get();
  const currentFirebaseIds = new Set(allFirebaseDevicesSnapshot.docs.map(doc => doc.id));

  // 2. Cleanup orphaned devices in Redis
  const cachedIds = await redis.sMembers('devices:all');
  let cleanedCount = 0;
  for (const cachedId of cachedIds) {
    if (!currentFirebaseIds.has(cachedId)) {
      console.log(`🗑️ [RECONCILIATION] Removing ghost device from cache: ${cachedId}`);
      await redis.del(`device:${cachedId}`);
      await redis.sRem('devices:all', cachedId);
      // Also clean up any associated alerts and uptime records
      await redis.del(`device:${cachedId}:alerts`);
      await redis.del(`device:${cachedId}:alerts:open`);
      await redis.del(`device:${cachedId}:uptime_records`);
      l1Cache.del(`device:${cachedId}`);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} ghost devices from Redis.`);
  }

  // 3. Sync existing/new devices
  let query: any = db.collection('devices');
  if (since) {
    query = query.where('updated_at', '>', since.toISOString());
  }

  const devicesSnapshot = await query.get();
  let synced = 0;

  // Use Promise.all for parallel syncing
  await Promise.all(devicesSnapshot.docs.map(async (doc: any) => {
    const firebaseData = doc.data() as Device;
    
    if (!firebaseData.name) {
      return;
    }

    const deviceId = String(doc.id);
    const deviceData = {
      ...firebaseData,
      id: deviceId,
      firestore_id: deviceId,
      synced_at: new Date().toISOString(),
      tds_field_number: firebaseData.tds_field_number || 1,
      temperature_field_number: firebaseData.temperature_field_number || 2,
      voltage_field_number: firebaseData.voltage_field_number || 3,
      status: firebaseData.status || 'offline',
      safe_tds_min: firebaseData.safe_tds_min || TDS_CONFIG.RANGES.SAFE_MIN,
      safe_tds_max: firebaseData.safe_tds_max || TDS_CONFIG.RANGES.SAFE_MAX,
      min_tds_threshold: firebaseData.min_tds_threshold || TDS_CONFIG.THRESHOLDS.DEFAULT_MIN,
      max_tds_threshold: firebaseData.max_tds_threshold || TDS_CONFIG.THRESHOLDS.DEFAULT_MAX,
      confidence_score: firebaseData.confidence_score || 100,
    };

    await hset(`device:${deviceId}`, deviceData);
    await redis.sAdd('devices:all', deviceId);
    l1Cache.set(`device:${deviceId}`, deviceData, 60 * 1000);
    synced++;
  }));

  return synced;
}

async function syncAlerts(since?: Date | null): Promise<number> {
  const db = getDb();
  const redis = getRedisClient();

  // 1. Get ALL current alerts from Firestore to handle deletions
  const allFirebaseAlertsSnapshot = await db.collection('alerts').select().get();
  const currentFirebaseAlertIds = new Set(allFirebaseAlertsSnapshot.docs.map(doc => doc.id));

  // 2. Cleanup orphaned alerts in Redis
  const cachedAlertIds = await redis.sMembers('alerts:all');
  let cleanedAlerts = 0;
  for (const alertId of cachedAlertIds) {
    if (!currentFirebaseAlertIds.has(alertId)) {
      console.log(`🗑️ [RECONCILIATION] Removing ghost alert from cache: ${alertId}`);
      await redis.del(`alert:${alertId}`);
      await redis.sRem('alerts:all', alertId);
      
      // Remove from all potential device associations
      const devices = await redis.sMembers('devices:all');
      for (const dId of devices) {
        await redis.sRem(`device:${dId}:alerts`, alertId);
        await redis.sRem(`device:${dId}:alerts:open`, alertId);
      }
      cleanedAlerts++;
    }
  }

  if (cleanedAlerts > 0) {
    console.log(`🧹 Cleaned ${cleanedAlerts} ghost alerts from Redis.`);
  }

  // 3. Sync existing/new alerts
  let query: any = db.collection('alerts');
  if (since) {
    query = query.where('updated_at', '>', since.toISOString());
  }

  const alertsSnapshot = await query.get();
  let synced = 0;

  for (const doc of alertsSnapshot.docs) {
    const firebaseData = doc.data() as Alert;

    if (!firebaseData.type || !firebaseData.severity) {
      continue;
    }

    const alertId = String(doc.id);
    const deviceId = typeof firebaseData.device_id === 'object' && firebaseData.device_id !== null 
      ? (firebaseData.device_id as any).id 
      : String(firebaseData.device_id);

    const alertData = {
      ...firebaseData,
      id: alertId,
      device_id: deviceId,
      firestore_id: alertId,
      synced_at: new Date().toISOString(),
      escalation_level: firebaseData.escalation_level || 0,
    };

    await hset(`alert:${alertId}`, alertData);
    await redis.sAdd('alerts:all', alertId);
    await redis.sAdd(`device:${deviceId}:alerts`, alertId);

    if (firebaseData.status === 'open') {
      await redis.sAdd(`device:${deviceId}:alerts:open`, alertId);
    } else {
      await redis.sRem(`device:${deviceId}:alerts:open`, alertId);
    }

    synced++;
  }

  return synced;
}

async function syncSensorData(since?: Date | null): Promise<number> {
  const db = getDb();
  const redis = getRedisClient();
  let query: any = db.collection('sensor_data');

  if (since) {
    query = query.where('recorded_at', '>', since.toISOString());
  } else {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = query.where('recorded_at', '>', sevenDaysAgo.toISOString());
  }

  const sensorSnapshot = await query.get();
  let synced = 0;

  for (const doc of sensorSnapshot.docs) {
    const firebaseData = doc.data();
    const deviceId = typeof firebaseData.device_id === 'object' && firebaseData.device_id !== null 
      ? (firebaseData.device_id as any).id 
      : String(firebaseData.device_id);

    const reading = {
      id: doc.id,
      device_id: deviceId,
      tds: firebaseData.payload?.tds || null,
      temperature: firebaseData.payload?.temperature || null,
      voltage: firebaseData.payload?.voltage || null,
      recorded_at: firebaseData.recorded_at,
      firestore_id: doc.id,
    };

    const key = `sensors:${deviceId}`;
    await redis.lPush(key, JSON.stringify(reading));
    await redis.lTrim(key, 0, 999); 

    synced++;
  }

  return synced;
}

async function syncHealthLogs(since?: Date | null): Promise<number> {
  const db = getDb();
  const redis = getRedisClient();
  let query: any = db.collection('system_health_logs');

  if (since) {
    query = query.where('timestamp', '>', since.toISOString());
  } else {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query = query.where('timestamp', '>', thirtyDaysAgo.toISOString());
  }

  const snapshot = await query.get();
  let synced = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const log = {
      ...data,
      id: doc.id,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : data.timestamp,
    };

    await redis.lPush('system:health_logs', JSON.stringify(log));
    await redis.lTrim('system:health_logs', 0, 999);
    synced++;
  }

  return synced;
}

async function syncUptimeStats(since?: Date | null): Promise<number> {
  const db = getDb();
  const redis = getRedisClient();
  let query: any = db.collection('uptime_stats');

  if (since) {
    query = query.where('timestamp', '>', since.toISOString());
  }

  const snapshot = await query.get();
  let synced = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const stat = {
      ...data,
      id: doc.id,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : data.timestamp,
    };

    await hset(`uptime:${stat.device_id}:${stat.timestamp}`, stat);
    await redis.sAdd(`device:${stat.device_id}:uptime_records`, `uptime:${stat.device_id}:${stat.timestamp}`);
    await redis.sAdd('uptime:all', `uptime:${stat.device_id}:${stat.timestamp}`);
    synced++;
  }

  return synced;
}

/**
 * Reconciliation service to ensure no ghost keys remain in Redis
 */
async function cleanupOrphanedKeys(): Promise<void> {
  const redis = getRedisClient();
  const db = getDb();

  console.log('🧹 [RECONCILIATION] Running deep cleanup of orphaned keys...');

  // 1. Cleanup Devices (Already handled in syncDevices, but here for completeness)
  // 2. Cleanup Alerts (Already handled in syncAlerts)

  // 3. Cleanup Uptime Records
  const allUptimeKeys = await redis.sMembers('uptime:all');
  const allFirebaseUptimeSnapshot = await db.collection('uptime_stats').select().get();
  const firebaseUptimeIds = new Set(allFirebaseUptimeSnapshot.docs.map(doc => doc.id));
  
  let uptimeCleaned = 0;
  for (const key of allUptimeKeys) {
    const stat = await hgetall<UptimeStat>(key);
    if (!stat || !stat.id || !firebaseUptimeIds.has(stat.id)) {
      console.log(`🗑️ [RECONCILIATION] Removing orphaned uptime record: ${key}`);
      await redis.del(key);
      await redis.sRem('uptime:all', key);
      if (stat && stat.device_id) {
        await redis.sRem(`device:${stat.device_id}:uptime_records`, key);
      }
      uptimeCleaned++;
    }
  }
  
  if (uptimeCleaned > 0) {
    console.log(`🧹 Cleaned ${uptimeCleaned} orphaned uptime records.`);
  }

  console.log('✅ Deep reconciliation pass complete.');
}

async function logSync(syncLog: Partial<SyncLog>): Promise<void> {
  const redis = getRedisClient();
  const logEntry = {
    ...syncLog,
    completed_at: new Date().toISOString(),
  };

  await redis.lPush('sync:logs', JSON.stringify(logEntry));
  await redis.lTrim('sync:logs', 0, 49);
}

export async function getLastSyncStatus(): Promise<any> {
  const redis = getRedisClient();
  const logs = await redis.lRange('sync:logs', 0, 4);
  return logs.map((log: string) => JSON.parse(log));
}

export async function forceCleanSync(): Promise<SyncResult> {
  const redis = getRedisClient();
  console.log('☢️ [HARD SYNC] Flashing Redis device cache for fresh start...');
  
  // 1. Identify all device and alert related keys
  const deviceIds = await redis.sMembers('devices:all');
  const alertIds = await redis.sMembers('alerts:all');
  
  // 2. Delete all related keys
  const keysToDelete = [
    'devices:all',
    'alerts:all',
    SYNC_STATE_KEY,
    ...deviceIds.map((id: string) => `device:${id}`),
    ...deviceIds.map((id: string) => `device:${id}:alerts`),
    ...deviceIds.map((id: string) => `device:${id}:alerts:open`),
    ...deviceIds.map((id: string) => `device:${id}:uptime_records`),
    ...alertIds.map((id: string) => `alert:${id}`)
  ];
  
  for (const key of keysToDelete) {
    await redis.del(key);
  }
  
  // 3. Clear L1 cache
  l1Cache.clear();
  
  console.log(`✅ Redis keys cleared (${keysToDelete.length} keys). Re-syncing from Firestore...`);
  
  // 4. Trigger a fresh full sync
  return syncFromFirebase('manual');
}
