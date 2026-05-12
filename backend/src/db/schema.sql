-- PostgreSQL Schema for TDS-APP Firestore Mirror

-- Drop tables to ensure clean recreation with correct types
DROP TABLE IF EXISTS sync_log CASCADE;
DROP TABLE IF EXISTS sensor_data CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS last_sync CASCADE;

-- Devices Table
CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location_name VARCHAR(255),
  description TEXT,

  -- GPS Coordinates
  latitude FLOAT,
  longitude FLOAT,

  -- ThingSpeak Integration
  thingspeak_channel_id VARCHAR(50),
  thingspeak_read_key VARCHAR(255),
  thingspeak_write_key VARCHAR(255),

  -- Hardware Identity
  node_number VARCHAR(50),
  sim_number VARCHAR(50),
  serial_number VARCHAR(50),

  -- Field Mapping (1-8 for ThingSpeak)
  tds_field_number INT DEFAULT 1,
  temperature_field_number INT DEFAULT 2,
  voltage_field_number INT DEFAULT 3,

  -- Status
  status VARCHAR(50) DEFAULT 'offline',
  last_seen_at TIMESTAMP,
  deployment_date TIMESTAMP,
  last_reading_at TIMESTAMP,

  -- TDS Thresholds (user-configured per device)
  safe_tds_min INT DEFAULT 35,
  safe_tds_max INT DEFAULT 175,

  -- Additional thresholds for validation
  min_tds_threshold INT DEFAULT 5,
  max_tds_threshold INT DEFAULT 2000,

  -- Metadata & Timestamps
  metadata JSONB,
  confidence_score INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Sync tracking
  synced_at TIMESTAMP,
  firestore_id VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_synced_at ON devices(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_firestore_id ON devices(firestore_id);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(255) PRIMARY KEY,
  device_id VARCHAR(255) REFERENCES devices(id) ON DELETE CASCADE,
  device_name VARCHAR(255),

  type VARCHAR(100),
  severity VARCHAR(50),
  message TEXT,
  value_at_time FLOAT,
  threshold_snapshot JSONB,

  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  created_by VARCHAR(255),

  escalation_level INT DEFAULT 0,

  -- Sync tracking
  synced_at TIMESTAMP,
  firestore_id VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_synced_at ON alerts(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_firestore_id ON alerts(firestore_id);

-- Sensor Data Table (Historical - Optional for analytics)
CREATE TABLE IF NOT EXISTS sensor_data (
  id VARCHAR(255) PRIMARY KEY,
  device_id VARCHAR(255) REFERENCES devices(id) ON DELETE CASCADE,

  tds FLOAT,
  temperature FLOAT,
  voltage FLOAT,
  recorded_at TIMESTAMP,

  synced_at TIMESTAMP,
  firestore_id VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_device_id ON sensor_data(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_recorded_at ON sensor_data(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_data_firestore_id ON sensor_data(firestore_id);

-- Sync Log Table (Track sync status)
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  devices_synced INT DEFAULT 0,
  alerts_synced INT DEFAULT 0,
  sensor_entries_synced INT DEFAULT 0,
  errors INT DEFAULT 0,

  error_message TEXT,
  status VARCHAR(50),

  duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);

-- Users Table (Optional - for multi-tenant support)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50),
  organization_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP,
  firestore_id VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_firestore_id ON users(firestore_id);

-- Last Sync Timestamp Table
CREATE TABLE IF NOT EXISTS last_sync (
  collection_name VARCHAR(100) PRIMARY KEY,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'success'
);

-- Initialize last_sync entries
INSERT INTO last_sync (collection_name, last_synced_at)
VALUES
  ('devices', NOW()),
  ('alerts', NOW()),
  ('sensor_data', NOW()),
  ('users', NOW())
ON CONFLICT (collection_name) DO UPDATE SET last_synced_at = NOW();
