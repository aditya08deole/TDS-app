-- Create thingspeak_channels table
CREATE TABLE IF NOT EXISTS public.thingspeak_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    read_api_key TEXT NOT NULL,
    field_mapping JSONB DEFAULT '{"tds": "field1", "temperature": "field2"}',
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id),
    UNIQUE(channel_id)
);

-- Add fields to sensor_data for source tracking
ALTER TABLE public.sensor_data 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct',
ADD COLUMN IF NOT EXISTS thingspeak_entry_id BIGINT;

-- Function to upsert sensor data from ThingSpeak (to be called by Edge Function)
CREATE OR REPLACE FUNCTION process_thingspeak_update(
    p_device_id UUID,
    p_tds NUMERIC,
    p_temperature NUMERIC,
    p_entry_id BIGINT,
    p_created_at TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
    -- Check if entry already exists
    IF NOT EXISTS (
        SELECT 1 FROM public.sensor_data 
        WHERE device_id = p_device_id AND thingspeak_entry_id = p_entry_id
    ) THEN
        INSERT INTO public.sensor_data (
            device_id, tds, temperature, thingspeak_entry_id, source, recorded_at
        ) VALUES (
            p_device_id, p_tds, p_temperature, p_entry_id, 'thingspeak', p_created_at
        );
        
        -- Update device heartbest/last seen
        UPDATE public.devices 
        SET last_seen = p_created_at 
        WHERE id = p_device_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
