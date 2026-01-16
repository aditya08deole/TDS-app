-- ============================================================
-- EvaraTDS Complete Database Setup for Supabase
-- Run this in Supabase SQL Editor
-- NOTE: Safe to run multiple times (uses IF NOT EXISTS and DROP IF EXISTS)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. DEVICES TABLE - Main device registry with ThingSpeak config
-- ============================================================
DROP TABLE IF EXISTS device_readings CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS devices CASCADE;

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'warning', 'critical', 'maintenance')),
    current_tds DOUBLE PRECISION DEFAULT 0,
    temperature DOUBLE PRECISION,
    voltage DOUBLE PRECISION,
    battery_level INTEGER DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
    is_active BOOLEAN DEFAULT true,
    
    -- ThingSpeak Configuration
    sim_number VARCHAR(20),
    thingspeak_api_key VARCHAR(50),
    thingspeak_channel_id VARCHAR(20),
    tds_field_number INTEGER DEFAULT 1 CHECK (tds_field_number >= 1 AND tds_field_number <= 8),
    temperature_field_number INTEGER CHECK (temperature_field_number IS NULL OR (temperature_field_number >= 1 AND temperature_field_number <= 8)),
    voltage_field_number INTEGER CHECK (voltage_field_number IS NULL OR (voltage_field_number >= 1 AND voltage_field_number <= 8)),
    
    -- Thresholds
    warning_threshold DOUBLE PRECISION DEFAULT 300,
    critical_threshold DOUBLE PRECISION DEFAULT 600,
    
    -- Metadata
    data_source_type VARCHAR(20) DEFAULT 'thingspeak' CHECK (data_source_type IN ('thingspeak', 'manual', 'api')),
    last_reading_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_is_active ON devices(is_active);
CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- ============================================================
-- 2. DEVICE READINGS TABLE - Historical TDS readings
-- ============================================================
CREATE TABLE device_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    tds_value DOUBLE PRECISION NOT NULL,
    temperature DOUBLE PRECISION,
    voltage DOUBLE PRECISION,
    is_valid BOOLEAN DEFAULT true,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_readings_device_id ON device_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON device_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device_time ON device_readings(device_id, recorded_at DESC);

-- ============================================================
-- 3. INCIDENTS TABLE - Water quality incidents tracking
-- ============================================================
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'closed')),
    tds_value DOUBLE PRECISION,
    threshold_exceeded DOUBLE PRECISION,
    reported_by VARCHAR(255),
    assigned_to VARCHAR(255),
    resolved_by VARCHAR(255),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_incidents_device_id ON incidents(device_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

-- ============================================================
-- 4. USERS TABLE - Extended user profiles (extends Supabase auth)
-- ============================================================
DROP TABLE IF EXISTS user_profiles CASCADE;
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'user', 'viewer')),
    phone VARCHAR(20),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ALERTS TABLE - System alerts and notifications
-- ============================================================
DROP TABLE IF EXISTS alerts CASCADE;
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('tds_warning', 'tds_critical', 'device_offline', 'maintenance_due', 'system')),
    title VARCHAR(200) NOT NULL,
    message TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    target_user_id UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- ============================================================
-- 6. AUDIT LOG TABLE - Track all changes
-- ============================================================
DROP TABLE IF EXISTS audit_log CASCADE;
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);

-- ============================================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create incident on critical TDS
CREATE OR REPLACE FUNCTION check_tds_threshold()
RETURNS TRIGGER AS $$
BEGIN
    -- Create incident if TDS exceeds critical threshold
    IF NEW.current_tds >= NEW.critical_threshold AND 
       (OLD.current_tds IS NULL OR OLD.current_tds < NEW.critical_threshold) THEN
        INSERT INTO incidents (device_id, title, description, severity, tds_value, threshold_exceeded)
        VALUES (
            NEW.id,
            'Critical TDS Level Detected at ' || NEW.name,
            'TDS level of ' || NEW.current_tds || ' ppm exceeded critical threshold of ' || NEW.critical_threshold || ' ppm',
            'critical',
            NEW.current_tds,
            NEW.critical_threshold
        );
        
        -- Create alert
        INSERT INTO alerts (device_id, alert_type, title, message, severity)
        VALUES (
            NEW.id,
            'tds_critical',
            'Critical: ' || NEW.name,
            'TDS level ' || NEW.current_tds || ' ppm exceeded critical threshold',
            'critical'
        );
    -- Create warning alert
    ELSIF NEW.current_tds >= NEW.warning_threshold AND NEW.current_tds < NEW.critical_threshold AND
          (OLD.current_tds IS NULL OR OLD.current_tds < NEW.warning_threshold) THEN
        INSERT INTO alerts (device_id, alert_type, title, message, severity)
        VALUES (
            NEW.id,
            'tds_warning',
            'Warning: ' || NEW.name,
            'TDS level ' || NEW.current_tds || ' ppm exceeded warning threshold',
            'warning'
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS check_device_tds_threshold ON devices;
CREATE TRIGGER check_device_tds_threshold
    AFTER UPDATE OF current_tds ON devices
    FOR EACH ROW
    EXECUTE FUNCTION check_tds_threshold();

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for devices table
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON devices;
CREATE POLICY "Allow read access for all authenticated users" ON devices
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON devices;
CREATE POLICY "Allow insert for authenticated users" ON devices
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON devices;
CREATE POLICY "Allow update for authenticated users" ON devices
    FOR UPDATE TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON devices;
CREATE POLICY "Allow delete for authenticated users" ON devices
    FOR DELETE TO authenticated
    USING (true);

-- Policies for device_readings
DROP POLICY IF EXISTS "Allow all for authenticated on readings" ON device_readings;
CREATE POLICY "Allow all for authenticated on readings" ON device_readings
    FOR ALL TO authenticated
    USING (true);

-- Policies for incidents
DROP POLICY IF EXISTS "Allow all for authenticated on incidents" ON incidents;
CREATE POLICY "Allow all for authenticated on incidents" ON incidents
    FOR ALL TO authenticated
    USING (true);

-- Policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR EXISTS (
        SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Policies for alerts
DROP POLICY IF EXISTS "Allow all for authenticated on alerts" ON alerts;
CREATE POLICY "Allow all for authenticated on alerts" ON alerts
    FOR ALL TO authenticated
    USING (true);

-- Policies for audit_log (read-only for non-admins)
DROP POLICY IF EXISTS "Allow read for authenticated on audit" ON audit_log;
CREATE POLICY "Allow read for authenticated on audit" ON audit_log
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated on audit" ON audit_log;
CREATE POLICY "Allow insert for authenticated on audit" ON audit_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================================
-- 9. HELPFUL VIEWS
-- ============================================================

-- View for device dashboard with latest readings
CREATE OR REPLACE VIEW device_dashboard AS
SELECT 
    d.id,
    d.device_id,
    d.name,
    d.location,
    d.latitude,
    d.longitude,
    d.status,
    d.current_tds,
    d.temperature,
    d.voltage,
    d.warning_threshold,
    d.critical_threshold,
    d.last_reading_at,
    d.thingspeak_channel_id,
    CASE 
        WHEN d.current_tds >= d.critical_threshold THEN 'critical'
        WHEN d.current_tds >= d.warning_threshold THEN 'warning'
        ELSE 'normal'
    END as tds_status,
    (SELECT COUNT(*) FROM incidents i WHERE i.device_id = d.id AND i.status NOT IN ('resolved', 'closed')) as open_incidents
FROM devices d
WHERE d.is_active = true;

-- View for recent alerts
CREATE OR REPLACE VIEW recent_alerts AS
SELECT 
    a.id,
    a.alert_type,
    a.title,
    a.message,
    a.severity,
    a.is_read,
    a.created_at,
    d.name as device_name,
    d.location as device_location
FROM alerts a
LEFT JOIN devices d ON a.device_id = d.id
WHERE a.is_dismissed = false
ORDER BY a.created_at DESC
LIMIT 100;

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================

SELECT 'Database setup complete! Tables created:' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
