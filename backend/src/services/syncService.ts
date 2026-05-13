import { getFirestore } from 'firebase-admin/firestore';
import { query as dbQuery } from '../db/connection';
import { Device, Alert, SyncLog } from '../types';
import { TDS_CONFIG } from '../config/tdsConfig';

function getDb() {
  return getFirestore();
}

interface SyncResult {
  type: 'manual' | 'scheduled' | 'event';
  devicesSynced: number;
  alertsSynced: number;
  sensorEntriesSynced: number;
  errors: number;
  errorMessage?: string;
  durationMs: number;
}

export async function syncFromFirebase(syncType: 'manual' | 'scheduled' | 'event' = 'manual'): Promise<SyncResult> {
  const startTime = Date.now();
  let devicesSynced = 0;
  let alertsSynced = 0;
  let sensorEntriesSynced = 0;
  let errors = 0;
  let errorLog: string[] = [];

  try {
    console.log(`🔄 Starting ${syncType} sync from Firebase...`);

    // Sync devices
    try {
      const devicesResult = await syncDevices();
      devicesSynced = devicesResult;
      console.log(`✅ Synced ${devicesSynced} devices`);
    } catch (err: any) {
      console.error('Error syncing devices:', err);
      errors++;
      errorLog.push(`Devices error: ${err.message}`);
    }

    // Sync alerts
    try {
      const alertsResult = await syncAlerts();
      alertsSynced = alertsResult;
      console.log(`✅ Synced ${alertsSynced} alerts`);
    } catch (err: any) {
      console.error('Error syncing alerts:', err);
      errors++;
      errorLog.push(`Alerts error: ${err.message}`);
    }

    // Sync sensor data (optional - can be skipped to reduce sync time)
    try {
      const sensorResult = await syncSensorData();
      sensorEntriesSynced = sensorResult;
      console.log(`✅ Synced ${sensorEntriesSynced} sensor entries`);
    } catch (err: any) {
      console.error('Error syncing sensor data:', err);
      errors++;
      errorLog.push(`Sensor error: ${err.message}`);
    }

    const durationMs = Date.now() - startTime;
    const status = errors === 0 ? 'success' : errors > 2 ? 'failed' : 'partial';
    const finalErrorMessage = errorLog.length > 0 ? errorLog.join(' | ') : undefined;

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

async function syncDevices(): Promise<number> {
  const db = getDb();
  const devicesRef = db.collection('devices');
  const devicesSnapshot = await devicesRef.get();

  let synced = 0;

  for (const doc of devicesSnapshot.docs) {
    const firebaseData = doc.data() as Device;
    
    // Basic validation
    if (!firebaseData.name) {
      console.warn(`⚠️ Skipping device ${doc.id}: Missing name`);
      continue;
    }

    const sql = `
      INSERT INTO devices (
        id, name, location_name, description, latitude, longitude,
        thingspeak_channel_id, thingspeak_read_key, thingspeak_write_key,
        node_number, sim_number, serial_number,
        tds_field_number, temperature_field_number, voltage_field_number,
        status, last_seen_at, deployment_date, last_reading_at,
        safe_tds_min, safe_tds_max, min_tds_threshold, max_tds_threshold,
        metadata, confidence_score, created_at, updated_at, synced_at, firestore_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), $28)
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        location_name = $3,
        description = $4,
        latitude = $5,
        longitude = $6,
        thingspeak_channel_id = $7,
        thingspeak_read_key = $8,
        thingspeak_write_key = $9,
        node_number = $10,
        sim_number = $11,
        serial_number = $12,
        tds_field_number = $13,
        temperature_field_number = $14,
        voltage_field_number = $15,
        status = $16,
        last_seen_at = $17,
        deployment_date = $18,
        last_reading_at = $19,
        safe_tds_min = $20,
        safe_tds_max = $21,
        min_tds_threshold = $22,
        max_tds_threshold = $23,
        metadata = $24,
        confidence_score = $25,
        updated_at = $27,
        synced_at = NOW()
    `;

    const params = [
      String(doc.id), // 1: id
      firebaseData.name, // 2: name
      firebaseData.location_name || null, // 3
      firebaseData.description || null, // 4
      firebaseData.latitude || null, // 5
      firebaseData.longitude || null, // 6
      firebaseData.thingspeak_channel_id || null, // 7
      firebaseData.thingspeak_read_key || null, // 8
      firebaseData.thingspeak_write_key || null, // 9
      firebaseData.node_number || null, // 10
      firebaseData.sim_number || null, // 11
      firebaseData.serial_number || null, // 12
      firebaseData.tds_field_number || 1, // 13
      firebaseData.temperature_field_number || 2, // 14
      firebaseData.voltage_field_number || 3, // 15
      firebaseData.status || 'offline', // 16
      firebaseData.last_seen_at || null, // 17
      firebaseData.deployment_date || null, // 18
      firebaseData.last_reading_at || null, // 19
      firebaseData.safe_tds_min || TDS_CONFIG.RANGES.SAFE_MIN, // 20
      firebaseData.safe_tds_max || TDS_CONFIG.RANGES.SAFE_MAX, // 21
      firebaseData.min_tds_threshold || TDS_CONFIG.THRESHOLDS.DEFAULT_MIN, // 22
      firebaseData.max_tds_threshold || TDS_CONFIG.THRESHOLDS.DEFAULT_MAX, // 23
      firebaseData.metadata ? JSON.stringify(firebaseData.metadata) : null, // 24
      firebaseData.confidence_score || 100, // 25
      firebaseData.created_at || new Date().toISOString(), // 26
      firebaseData.updated_at || new Date().toISOString(), // 27
      String(doc.id), // 28: firestore_id
    ];

    await dbQuery(sql, params);
    synced++;
  }

  return synced;
}

async function syncAlerts(): Promise<number> {
  const db = getDb();
  const alertsRef = db.collection('alerts');
  const alertsSnapshot = await alertsRef.get();

  let synced = 0;

  for (const doc of alertsSnapshot.docs) {
    const firebaseData = doc.data() as Alert;

    // Basic validation
    if (!firebaseData.type || !firebaseData.severity) {
      console.warn(`⚠️ Skipping alert ${doc.id}: Missing required fields (type/severity)`);
      continue;
    }

    const sql = `
      INSERT INTO alerts (
        id, device_id, device_name, type, severity, message,
        value_at_time, threshold_snapshot, status, created_at,
        acknowledged_at, resolved_at, resolved_by, created_by, escalation_level,
        synced_at, firestore_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16)
      ON CONFLICT (id) DO UPDATE SET
        device_id = $2,
        device_name = $3,
        type = $4,
        severity = $5,
        message = $6,
        value_at_time = $7,
        threshold_snapshot = $8,
        status = $9,
        created_at = $10,
        acknowledged_at = $11,
        resolved_at = $12,
        resolved_by = $13,
        created_by = $14,
        escalation_level = $15,
        synced_at = NOW()
    `;

    // Ensure device_id is a string, even if it's a Firestore DocumentReference
    const deviceId = typeof firebaseData.device_id === 'object' && firebaseData.device_id !== null 
      ? (firebaseData.device_id as any).id 
      : String(firebaseData.device_id);

    const params = [
      String(doc.id), // 1: id
      deviceId, // 2: device_id
      firebaseData.device_name || null, // 3
      firebaseData.type, // 4
      firebaseData.severity, // 5
      firebaseData.message, // 6
      firebaseData.value_at_time, // 7
      firebaseData.threshold_snapshot ? JSON.stringify(firebaseData.threshold_snapshot) : null, // 8
      firebaseData.status, // 9
      firebaseData.created_at, // 10
      firebaseData.acknowledged_at || null, // 11
      firebaseData.resolved_at || null, // 12
      firebaseData.resolved_by || null, // 13
      firebaseData.created_by || null, // 14
      firebaseData.escalation_level || 0, // 15
      String(doc.id), // 16: firestore_id
    ];

    try {
      await dbQuery(sql, params);
      synced++;
    } catch (err: any) {
      if (err.code === '23503') { // Foreign key violation
        console.warn(`⚠️ Skipping orphaned alert ${doc.id}: Device ${deviceId} not found in database.`);
      } else {
        console.error(`❌ Error syncing alert ${doc.id}:`, err);
        throw err;
      }
    }
  }

  return synced;
}

async function syncSensorData(): Promise<number> {
  // Only sync recent sensor data (last 7 days to avoid too many rows)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const db = getDb();
  const sensorRef = db.collection('sensor_data');
  const q = sensorRef.where('recorded_at', '>', sevenDaysAgo);
  const sensorSnapshot = await q.get();

  let synced = 0;

  for (const doc of sensorSnapshot.docs) {
    const firebaseData = doc.data();

    const sql = `
      INSERT INTO sensor_data (
        id, device_id, tds, temperature, voltage, recorded_at, synced_at, firestore_id
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      ON CONFLICT (id) DO UPDATE SET
        synced_at = NOW()
    `;

    // Ensure device_id is a string
    const deviceId = typeof firebaseData.device_id === 'object' && firebaseData.device_id !== null 
      ? (firebaseData.device_id as any).id 
      : String(firebaseData.device_id);

    const params = [
      String(doc.id), // 1: id
      deviceId, // 2: device_id
      firebaseData.payload?.tds || null, // 3
      firebaseData.payload?.temperature || null, // 4
      firebaseData.payload?.voltage || null, // 5
      firebaseData.recorded_at || new Date().toISOString(), // 6
      String(doc.id), // 7: firestore_id
    ];

    try {
      await dbQuery(sql, params);
      synced++;
    } catch (err: any) {
      if (err.code === '23503') { // Foreign key violation
        console.warn(`⚠️ Skipping sensor data ${doc.id}: Device ${deviceId} not found in database.`);
      } else {
        console.error(`❌ Error syncing sensor data ${doc.id}:`, err);
        throw err;
      }
    }
  }

  return synced;
}

async function logSync(syncLog: Partial<SyncLog>): Promise<void> {
  const sql = `
    INSERT INTO sync_log (
      sync_type, completed_at, devices_synced, alerts_synced, sensor_entries_synced,
      errors, error_message, status, duration_ms
    ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8)
  `;

  const params = [
    syncLog.sync_type,
    syncLog.devices_synced || 0,
    syncLog.alerts_synced || 0,
    syncLog.sensor_entries_synced || 0,
    syncLog.errors || 0,
    syncLog.error_message || null,
    syncLog.status,
    syncLog.duration_ms || 0,
  ];

  await dbQuery(sql, params);
}

export async function getLastSyncStatus(): Promise<any> {
  const sql = `
    SELECT * FROM sync_log
    ORDER BY started_at DESC
    LIMIT 5
  `;

  const result = await dbQuery(sql);
  return result.rows;
}
