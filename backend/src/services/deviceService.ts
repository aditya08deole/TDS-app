import { getFirestore } from 'firebase-admin/firestore';
import { query as dbQuery } from '../db/connection';
import { Device } from '../types';

function getFirestoreDb() {
  return getFirestore();
}

export async function getAllDevices(): Promise<Device[]> {
  const sql = `
    SELECT * FROM devices
    ORDER BY created_at DESC
  `;

  const result = await dbQuery(sql);
  return result.rows;
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const sql = `
    SELECT * FROM devices
    WHERE id = $1
  `;

  const result = await dbQuery(sql, [id]);
  return result.rows[0] || null;
}

export async function createDevice(deviceData: Partial<Device>): Promise<Device> {
  const db = getFirestoreDb();
  
  // 1. Add to Firestore first to get an ID if not provided
  let firestoreId = deviceData.id;
  if (!firestoreId) {
    const docRef = await db.collection('devices').add({
      ...deviceData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: deviceData.status || 'offline'
    });
    firestoreId = docRef.id;
  } else {
    await db.collection('devices').doc(firestoreId).set({
      ...deviceData,
      created_at: deviceData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: deviceData.status || 'offline'
    }, { merge: true });
  }

  // 2. Add to PostgreSQL
  const sql = `
    INSERT INTO devices (
      id, name, location_name, description, latitude, longitude,
      node_number, sim_number, serial_number, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = $2,
      location_name = $3,
      description = $4,
      latitude = $5,
      longitude = $6,
      node_number = $7,
      sim_number = $8,
      serial_number = $9,
      status = $10,
      updated_at = NOW()
    RETURNING *
  `;

  const params = [
    firestoreId,
    deviceData.name,
    deviceData.location_name || null,
    deviceData.description || null,
    deviceData.latitude || null,
    deviceData.longitude || null,
    deviceData.node_number || null,
    deviceData.sim_number || null,
    deviceData.serial_number || null,
    deviceData.status || 'offline'
  ];

  const result = await dbQuery(sql, params);
  return result.rows[0];
}

export async function searchDevices(query: string): Promise<Device[]> {
  const searchTerm = `%${query}%`;

  const sql = `
    SELECT * FROM devices
    WHERE
      name ILIKE $1
      OR location_name ILIKE $1
      OR node_number ILIKE $1
      OR id::text ILIKE $1
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const result = await dbQuery(sql, [searchTerm]);
  return result.rows;
}

export async function getDevicesByStatus(status: string): Promise<Device[]> {
  const sql = `
    SELECT * FROM devices
    WHERE status = $1
    ORDER BY created_at DESC
  `;

  const result = await dbQuery(sql, [status]);
  return result.rows;
}

export async function getDeviceStats(): Promise<any> {
  const sql = `
    SELECT
      COUNT(*) as total_devices,
      COUNT(CASE WHEN status = 'online' THEN 1 END) as online_count,
      COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_count,
      COUNT(CASE WHEN status = 'critical' THEN 1 END) as critical_count,
      COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_count
    FROM devices
  `;

  const result = await dbQuery(sql);
  return result.rows[0];
}

export async function getDeviceWithRecentData(id: string): Promise<any> {
  const sql = `
    SELECT
      d.*,
      (SELECT COUNT(*) FROM alerts WHERE device_id = d.id AND status = 'open') as open_alerts_count,
      (SELECT COUNT(*) FROM sensor_data WHERE device_id = d.id) as total_readings,
      (SELECT tds FROM sensor_data WHERE device_id = d.id ORDER BY recorded_at DESC LIMIT 1) as latest_tds,
      (SELECT temperature FROM sensor_data WHERE device_id = d.id ORDER BY recorded_at DESC LIMIT 1) as latest_temperature,
      (SELECT voltage FROM sensor_data WHERE device_id = d.id ORDER BY recorded_at DESC LIMIT 1) as latest_voltage
    FROM devices d
    WHERE d.id = $1
  `;

  const result = await dbQuery(sql, [id]);
  return result.rows[0] || null;
}

export async function updateDeviceTdsThresholds(
  deviceId: string,
  minTds: number,
  maxTds: number
): Promise<Device> {
  const sql = `
    UPDATE devices
    SET safe_tds_min = $1, safe_tds_max = $2, updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `;

  const result = await dbQuery(sql, [minTds, maxTds, deviceId]);

  if (result.rows.length === 0) {
    throw new Error(`Device ${deviceId} not found`);
  }

  return result.rows[0];
}

export async function updateDeviceStatus(
  deviceId: string,
  status: 'online' | 'offline' | 'critical' | 'maintenance'
): Promise<Device> {
  const sql = `
    UPDATE devices
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await dbQuery(sql, [status, deviceId]);

  if (result.rows.length === 0) {
    throw new Error(`Device ${deviceId} not found`);
  }

  return result.rows[0];
}

export async function updateDevice(
  deviceId: string,
  updates: Partial<Device>
): Promise<Device> {
  // 1. Update Firestore
  try {
    const db = getFirestoreDb();
    const cleanUpdates = { ...updates };
    delete (cleanUpdates as any).id; // ID cannot be updated
    (cleanUpdates as any).updated_at = new Date().toISOString();
    
    await db.collection('devices').doc(deviceId).update(cleanUpdates);
    console.log(`✅ Firestore updated for device ${deviceId}`);
  } catch (error) {
    console.warn(`⚠️ Could not update device ${deviceId} in Firestore:`, error);
    // Continue even if Firestore update fails, as long as PostgreSQL succeeds
  }

  // 2. Update PostgreSQL (Partial Update)
  const fields: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  const updatableFields = [
    'name', 'location_name', 'description', 'latitude', 'longitude',
    'node_number', 'sim_number', 'serial_number', 'status',
    'thingspeak_channel_id', 'thingspeak_read_key', 'tds_field_number',
    'temperature_field_number', 'voltage_field_number', 'safe_tds_min', 'safe_tds_max'
  ];

  for (const field of updatableFields) {
    if (updates[field as keyof Device] !== undefined) {
      fields.push(`${field} = $${paramCount}`);
      params.push(updates[field as keyof Device]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    // No fields to update in Postgres, just fetch current
    const result = await dbQuery('SELECT * FROM devices WHERE id = $1', [deviceId]);
    return result.rows[0];
  }

  params.push(deviceId);
  const sql = `
    UPDATE devices
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await dbQuery(sql, params);

  if (result.rows.length === 0) {
    throw new Error(`Device ${deviceId} not found in PostgreSQL`);
  }

  return result.rows[0];
}

export async function deleteDevice(deviceId: string): Promise<void> {
  // 1. Delete from Firestore
  try {
    const db = getFirestoreDb();
    await db.collection('devices').doc(deviceId).delete();
  } catch (error) {
    console.warn(`Could not delete device ${deviceId} from Firestore:`, error);
  }

  // 2. Delete from PostgreSQL
  const sql = `
    DELETE FROM devices
    WHERE id = $1
  `;

  await dbQuery(sql, [deviceId]);
}

export async function getStaleDevices(hoursAgo: number = 1): Promise<Device[]> {
  const sql = `
    SELECT * FROM devices
    WHERE last_reading_at < NOW() - INTERVAL '${hoursAgo} hours'
      OR last_reading_at IS NULL
    ORDER BY last_reading_at ASC
  `;

  const result = await dbQuery(sql);
  return result.rows;
}
