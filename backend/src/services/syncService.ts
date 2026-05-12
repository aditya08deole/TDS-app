import { getFirestore } from 'firebase-admin/firestore';
import { query as dbQuery } from '../db/connection';
import { Device, Alert, SyncLog } from '../types';

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
  let errorMessage: string | undefined;

  try {
    console.log(`🔄 Starting ${syncType} sync from Firebase...`);

    // Sync devices
    try {
      const devicesResult = await syncDevices();
      devicesSynced = devicesResult;
      console.log(`✅ Synced ${devicesSynced} devices`);
    } catch (err) {
      console.error('Error syncing devices:', err);
      errors++;
    }

    // Sync alerts
    try {
      const alertsResult = await syncAlerts();
      alertsSynced = alertsResult;
      console.log(`✅ Synced ${alertsSynced} alerts`);
    } catch (err) {
      console.error('Error syncing alerts:', err);
      errors++;
    }

    // Sync sensor data (optional - can be skipped to reduce sync time)
    try {
      const sensorResult = await syncSensorData();
      sensorEntriesSynced = sensorResult;
      console.log(`✅ Synced ${sensorEntriesSynced} sensor entries`);
    } catch (err) {
      console.error('Error syncing sensor data:', err);
      errors++;
    }

    const durationMs = Date.now() - startTime;
    const status = errors === 0 ? 'success' : errors > 2 ? 'failed' : 'partial';

    // Log sync result
    await logSync({
      sync_type: syncType,
      devices_synced: devicesSynced,
      alerts_synced: alertsSynced,
      sensor_entries_synced: sensorEntriesSynced,
      errors,
      error_message: errorMessage,
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
      errorMessage,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    errorMessage = error instanceof Error ? error.message : String(error);

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
      doc.id,
      firebaseData.name,
      firebaseData.location_name || null,
      firebaseData.description || null,
      firebaseData.latitude || null,
      firebaseData.longitude || null,
      firebaseData.thingspeak_channel_id || null,
      firebaseData.thingspeak_read_key || null,
      firebaseData.thingspeak_write_key || null,
      firebaseData.node_number || null,
      firebaseData.sim_number || null,
      firebaseData.serial_number || null,
      firebaseData.tds_field_number || 1,
      firebaseData.temperature_field_number || 2,
      firebaseData.voltage_field_number || 3,
      firebaseData.status || 'offline',
      firebaseData.last_seen_at || null,
      firebaseData.deployment_date || null,
      firebaseData.last_reading_at || null,
      firebaseData.safe_tds_min || 35,
      firebaseData.safe_tds_max || 175,
      firebaseData.min_tds_threshold || 5,
      firebaseData.max_tds_threshold || 2000,
      firebaseData.metadata ? JSON.stringify(firebaseData.metadata) : null,
      firebaseData.confidence_score || 100,
      firebaseData.created_at || new Date().toISOString(),
      firebaseData.updated_at || new Date().toISOString(),
      doc.id,
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

    const params = [
      doc.id,
      firebaseData.device_id,
      firebaseData.device_name || null,
      firebaseData.type,
      firebaseData.severity,
      firebaseData.message,
      firebaseData.value_at_time,
      firebaseData.threshold_snapshot ? JSON.stringify(firebaseData.threshold_snapshot) : null,
      firebaseData.status,
      firebaseData.created_at,
      firebaseData.acknowledged_at || null,
      firebaseData.resolved_at || null,
      firebaseData.resolved_by || null,
      firebaseData.created_by || null,
      firebaseData.escalation_level || 0,
      doc.id,
    ];

    await dbQuery(sql, params);
    synced++;
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

    const params = [
      doc.id,
      firebaseData.device_id,
      firebaseData.payload?.tds || null,
      firebaseData.payload?.temperature || null,
      firebaseData.payload?.voltage || null,
      firebaseData.recorded_at || new Date().toISOString(),
      doc.id,
    ];

    await dbQuery(sql, params);
    synced++;
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
