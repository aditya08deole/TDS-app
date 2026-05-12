import { query as dbQuery } from '../db/connection';
import { Device } from '../types';

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

export async function deleteDevice(deviceId: string): Promise<void> {
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
