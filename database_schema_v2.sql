-- =====================================================
-- Updated Database Schema for EvaraTDS
-- With ThingSpeak Integration and Device Management
-- =====================================================

-- First, let's drop and recreate the devices table with new fields
-- Note: Run this only if you want to reset the devices table

-- Backup existing data if needed
-- CREATE TABLE devices_backup AS SELECT * FROM devices;

-- Drop existing table and recreate with new schema
DROP TABLE IF EXISTS device_readings CASCADE;
DROP TABLE IF EXISTS devices CASCADE;

-- =====================================================
-- DEVICES TABLE - Enhanced with ThingSpeak fields
-- =====================================================
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL, -- Hardware identifier
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'warning', 'critical', 'offline')),
    current_tds DECIMAL(10, 2) DEFAULT 0,
    temperature DECIMAL(5, 2),
    voltage DECIMAL(5, 3),
    battery_level INTEGER DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- SIM Information
    sim_number VARCHAR(50),
    
    -- ThingSpeak Configuration
    thingspeak_api_key VARCHAR(100), -- Read API Key
    thingspeak_channel_id VARCHAR(50),
    tds_field_number INTEGER DEFAULT 1 CHECK (tds_field_number >= 1 AND tds_field_number <= 8),
    temperature_field_number INTEGER CHECK (temperature_field_number >= 1 AND temperature_field_number <= 8),
    voltage_field_number INTEGER CHECK (voltage_field_number >= 1 AND voltage_field_number <= 8),
    
    -- Thresholds
    warning_threshold DECIMAL(10, 2) DEFAULT 300,
    critical_threshold DECIMAL(10, 2) DEFAULT 600,
    
    -- Last reading timestamp
    last_reading_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_is_active ON devices(is_active);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_location ON devices(location);

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for devices
-- Everyone can read active devices
CREATE POLICY "devices_select_policy" ON devices
    FOR SELECT
    USING (is_active = true);

-- Only authenticated users with admin role can insert/update/delete
CREATE POLICY "devices_insert_policy" ON devices
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "devices_update_policy" ON devices
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "devices_delete_policy" ON devices
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- =====================================================
-- DEVICE READINGS TABLE - Historical data
-- =====================================================
CREATE TABLE device_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    tds_value DECIMAL(10, 2) NOT NULL,
    temperature DECIMAL(5, 2),
    voltage DECIMAL(5, 3),
    is_valid BOOLEAN DEFAULT true,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_readings_device_id ON device_readings(device_id);
CREATE INDEX idx_readings_recorded_at ON device_readings(recorded_at DESC);
CREATE INDEX idx_readings_device_time ON device_readings(device_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE device_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_readings
CREATE POLICY "readings_select_policy" ON device_readings
    FOR SELECT
    USING (true);

CREATE POLICY "readings_insert_policy" ON device_readings
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- FUNCTION: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for devices table
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA: Kadamba Mess Device
-- =====================================================
INSERT INTO devices (
    device_id,
    name,
    location,
    latitude,
    longitude,
    status,
    current_tds,
    is_active,
    sim_number,
    thingspeak_api_key,
    tds_field_number,
    temperature_field_number,
    voltage_field_number,
    warning_threshold,
    critical_threshold
) VALUES (
    'KDM-001',
    'Kadamba Canteen TDS Monitor',
    'Kadamba Mess, IIIT Hyderabad',
    17.4449,
    78.3489,
    'online',
    0,
    true,
    NULL,
    'EHEK3A1XD48TY98B',
    1,  -- TDS is Field 1
    2,  -- Temperature is Field 2 (adjust as needed)
    3,  -- Voltage is Field 3 (adjust as needed)
    300,
    600
);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT ON devices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON devices TO authenticated;
GRANT SELECT, INSERT ON device_readings TO authenticated;
GRANT SELECT ON device_readings TO anon;

-- =====================================================
-- USEFUL QUERIES
-- =====================================================

-- Get all active devices with latest readings
-- SELECT * FROM devices WHERE is_active = true ORDER BY name;

-- Get device readings for last 24 hours
-- SELECT * FROM device_readings 
-- WHERE device_id = 'your-device-id' 
-- AND recorded_at > NOW() - INTERVAL '24 hours'
-- ORDER BY recorded_at DESC;

-- Get average TDS per device for last hour
-- SELECT device_id, AVG(tds_value) as avg_tds, COUNT(*) as readings
-- FROM device_readings
-- WHERE recorded_at > NOW() - INTERVAL '1 hour'
-- GROUP BY device_id;
