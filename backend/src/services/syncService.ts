import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getRedisClient, hset } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, Alert, SyncLog, SystemHealthLog, UptimeStat } from '../types';
import { TDS_CONFIG } from '../config/tdsConfig';

function getDb() {
  return getFirestore();
}

interface SyncResult {
  type: 'manual' | 'scheduled' | 'event';
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

export async function syncFromFirebase(syncType: 'manual' | 'scheduled' | 'event' = 'manual'): Promise<SyncResult> {
  const startTime = Date.now();
  let devicesSynced = 0;
  let alertsSynced = 0;
  let sensorEntriesSynced = 0;
  let healthLogsSynced = 0;
  let uptimeStatsSynced = 0;
  let errors = 0;
  let errorLog: string[] = [];

  try {
    const lastSyncedAt = await getLastSyncedAt();
    console.log(`🔄 Starting ${syncType} sync from Firebase... ${lastSyncedAt ? `(Incremental since ${lastSyncedAt.toISOString()})` : '(Full sync)'}`);

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
  let query: any = db.collection('devices');
  
  if (since) {
    // We use the last sync time to filter. Since we might not have updated_at everywhere yet,
    // we fallback to created_at or just get all if it's the first time.
    // Actually, Firestore's updateTime is internal, so we rely on 'updated_at' field.
    query = query.where('updated_at', '>', since.toISOString());
  }

  const devicesSnapshot = await query.get();
  let synced = 0;

  for (const doc of devicesSnapshot.docs) {
    const firebaseData = doc.data() as Device;
    
    if (!firebaseData.name) {
      continue;
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
    l1Cache.set(`device:${deviceId}`, deviceData, 60 * 1000); // Populate L1 Cache
    synced++;
  }

  return synced;
}

async function syncAlerts(since?: Date | null): Promise<number> {
  const db = getDb();
  const redis = getRedisClient();
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
    synced++;
  }

  return synced;
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
  return logs.map(log => JSON.parse(log));
}
