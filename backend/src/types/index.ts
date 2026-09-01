export interface Device {
  id: string;
  name: string;
  location_name?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  thingspeak_channel_id?: string;
  thingspeak_read_key?: string;
  thingspeak_write_key?: string;
  node_number?: string;
  sim_number?: string;
  serial_number?: string;
  tds_field_number?: number;
  temperature_field_number?: number;
  voltage_field_number?: number;
  last_tds?: number;
  last_temperature?: number;
  last_voltage?: number;
  status: 'online' | 'offline' | 'critical' | 'maintenance';
  last_seen_at?: string;
  deployment_date?: string;
  last_reading_at?: string;
  safe_tds_min?: number;
  safe_tds_max?: number;
  min_tds_threshold?: number;
  max_tds_threshold?: number;
  metadata?: Record<string, any>;
  confidence_score?: number;
  created_at: string;
  updated_at?: string;
  synced_at?: string;
  firestore_id?: string;
}

export interface Alert {
  id: string;
  device_id: string;
  device_name?: string;
  type: string;
  severity: 'info' | 'critical';
  message: string;
  value_at_time: number;
  threshold_snapshot?: Record<string, any>;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  created_by?: string;
  synced_at?: string;
  firestore_id?: string;
}

export interface SensorData {
  id: string;
  device_id: string;
  tds: number;
  temperature?: number;
  voltage?: number;
  recorded_at: string;
  synced_at?: string;
  firestore_id?: string;
}

export interface SyncLog {
  id: number;
  sync_type: 'manual' | 'scheduled' | 'event' | 'startup';
  started_at: string;
  completed_at?: string;
  devices_synced: number;
  alerts_synced: number;
  sensor_entries_synced: number;
  errors: number;
  error_message?: string;
  status: 'success' | 'failed' | 'partial';
  duration_ms?: number;
}

export interface SyncStatus {
  collection_name: string;
  last_synced_at: string;
  sync_status: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface SystemHealthLog {
  id: string;
  timestamp: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  component: string;
  metadata?: Record<string, any>;
}

export interface UptimeStat {
  id: string;
  device_id: string;
  timestamp: string;
  uptime_percentage: number;
  total_online_minutes: number;
  total_offline_minutes: number;
}
