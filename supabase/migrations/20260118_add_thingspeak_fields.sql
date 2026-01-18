-- Add ThingSpeak integration fields to devices table
-- Migration: Add ThingSpeak channel ID, read key, node number, SIM number, and field mappings

ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS thingspeak_channel_id TEXT,
ADD COLUMN IF NOT EXISTS thingspeak_read_key TEXT,
ADD COLUMN IF NOT EXISTS node_number TEXT,
ADD COLUMN IF NOT EXISTS sim_number TEXT,
ADD COLUMN IF NOT EXISTS tds_field_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS temperature_field_number INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS voltage_field_number INTEGER DEFAULT 3;

-- Add comments for documentation
COMMENT ON COLUMN devices.thingspeak_channel_id IS 'ThingSpeak channel ID for API calls';
COMMENT ON COLUMN devices.thingspeak_read_key IS 'ThingSpeak channel read API key for fetching real-time sensor data';
COMMENT ON COLUMN devices.node_number IS 'Physical node identifier (e.g., Node 1, Node 2)';
COMMENT ON COLUMN devices.sim_number IS 'SIM card number for cellular connectivity';
COMMENT ON COLUMN devices.tds_field_number IS 'ThingSpeak field number for TDS data (1-8)';
COMMENT ON COLUMN devices.temperature_field_number IS 'ThingSpeak field number for temperature data (1-8)';
COMMENT ON COLUMN devices.voltage_field_number IS 'ThingSpeak field number for voltage data (1-8)';

-- Add check constraints to ensure valid field numbers
ALTER TABLE devices 
ADD CONSTRAINT tds_field_valid CHECK (tds_field_number >= 1 AND tds_field_number <= 8),
ADD CONSTRAINT temperature_field_valid CHECK (temperature_field_number >= 1 AND temperature_field_number <= 8),
ADD CONSTRAINT voltage_field_valid CHECK (voltage_field_number >= 1 AND voltage_field_number <= 8);
