-- Phase 1: Core Backend Philosophy & Schema
-- Source of Truth: Supabase (Metadata/State), ThingSpeak (Telemetry)

-- 1. DEVICES TABLE (Registry of Physical Assets)
-- Note: internal_id is the primary key UUID. thingpeak_channel_id is a unique external reference.
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location_name TEXT,
    description TEXT,
    
    -- Geospatial (Stored as simple lat/long for now, could be PostGIS later)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- ThingSpeak Integration (Source of Truth for Data)
    thingspeak_channel_id BIGINT UNIQUE,
    thingspeak_read_key TEXT, -- Encrypted/Secured in application layer if needed, or RLS
    thingspeak_write_key TEXT, -- Only if needed for commands
    
    -- Hardware Identity
    sim_number TEXT UNIQUE,
    serial_number TEXT,
    
    -- Device State (Managed by Backend Logic/Edge Functions)
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'critical', 'maintenance', 'warning')),
    last_seen_at TIMESTAMPTZ,
    deployment_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Configuration & Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- For flexible config (polling_interval, thresholds)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALERTS TABLE (Immutable Event Log)
-- Stores incidence history. State changes tracked via status updates and audit logs.
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    
    -- Alert Details
    type TEXT NOT NULL, -- e.g., 'tds_high', 'no_flow', 'device_offline'
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    
    -- Context Snapshot (What was the value when it triggered?)
    value_at_time NUMERIC, 
    threshold_snapshot JSONB, -- Stores the rule that was breached
    
    -- Lifecycle
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    escalation_level INTEGER DEFAULT 0,
    
    -- Timestamps & Actors
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

-- 3. AUDIT LOGS TABLE (System Trust & Compliance)
-- Immutable record of all key actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id), -- Nullable for system actions
    action TEXT NOT NULL, -- e.g., 'create_device', 'resolve_alert', 'update_config'
    target_resource TEXT NOT NULL, -- e.g., 'device:123'
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLEANUP / ENFORCEMENT
-- Ensure no queryable 'readings' table exists that duplicates ThingSpeak
-- DROP TABLE IF EXISTS public.readings;      -- Uncomment to enforce
-- DROP TABLE IF EXISTS public.sensor_data;   -- Uncomment to enforce

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_thingspeak_id ON public.devices(thingspeak_channel_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON public.alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

-- 5. REALTIME SUBSCRIPTIONS
-- Enable Realtime for Dashboard/Map updates
alter publication supabase_realtime add table devices;
alter publication supabase_realtime add table alerts;
