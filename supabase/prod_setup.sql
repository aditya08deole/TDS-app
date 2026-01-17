-- EvaraTDS Final Production Setup
-- Master Plan Phases 1-15 Verified
-- Author: EvaraTDS Team
-- Date: 2026-01-20

-- ==========================================
-- 0. RESET DATABASE (FRESH START)
-- ==========================================
-- WARNING: This will delete all data.
DROP TABLE IF EXISTS public.device_state_events CASCADE;
DROP TABLE IF EXISTS public.alert_history CASCADE; -- Legacy name backup
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.system_health_logs CASCADE;
DROP FUNCTION IF EXISTS public.heartbeat CASCADE;
DROP FUNCTION IF EXISTS public.record_reading CASCADE;
DROP FUNCTION IF EXISTS public.ensure_alert CASCADE;
DROP FUNCTION IF EXISTS public.scan_device CASCADE;
DROP FUNCTION IF EXISTS public.generate_qr_payload CASCADE;
DROP FUNCTION IF EXISTS public.rotate_qr_code CASCADE;
DROP FUNCTION IF EXISTS public.get_uptime_stats CASCADE;
DROP FUNCTION IF EXISTS public.check_offline_devices CASCADE;
DROP FUNCTION IF EXISTS public.check_escalations CASCADE;
DROP FUNCTION IF EXISTS public.check_sensor_failures CASCADE;
DROP FUNCTION IF EXISTS public.calculate_confidence_scores CASCADE;
DROP FUNCTION IF EXISTS public.add_device CASCADE;
DROP FUNCTION IF EXISTS public.log_state_change CASCADE;
DROP FUNCTION IF EXISTS public.log_event CASCADE;
DROP FUNCTION IF EXISTS public.acknowledge_alert CASCADE;
DROP FUNCTION IF EXISTS public.resolve_alert CASCADE;
DROP FUNCTION IF EXISTS public.global_search CASCADE;

-- ==========================================
-- 1. BASE SCHEMA
-- ==========================================

-- 1.1 DEVICES
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location_name TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    thingspeak_channel_id BIGINT UNIQUE,
    thingspeak_read_key TEXT, 
    thingspeak_write_key TEXT,
    sim_number TEXT UNIQUE,
    serial_number TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'critical', 'maintenance', 'warning', 'degraded')),
    last_seen_at TIMESTAMPTZ,
    last_reading_at TIMESTAMPTZ, -- For Sensor Gap Detection
    deployment_date TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Phase 10: QR Security
    qr_version INTEGER DEFAULT 1,
    
    -- Phase 3: Confidence Score
    confidence_score INTEGER DEFAULT 100 CHECK (confidence_score BETWEEN 0 AND 100),
    
    -- Phase 13: Predictive Caching
    last_tds_value NUMERIC,
    last_tds_change_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 ALERTS
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    value_at_time NUMERIC, 
    threshold_snapshot JSONB,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    
    -- Phase 7: Escalation
    escalation_level INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

-- 1.3 AUDIT LOGS
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 DEVICE STATE HISTORY (Timeline)
CREATE TABLE public.device_state_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
  previous_state TEXT,
  new_state TEXT NOT NULL,
  reason TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT GENERATED ALWAYS AS ( EXTRACT(EPOCH FROM (ended_at - started_at)) ) STORED
);

-- 1.5 SYSTEM HEALTH LOGS (Phase 15)
CREATE TABLE public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL, -- 'supabase_db', 'thingspeak_api', 'edge_functions'
  status TEXT NOT NULL, -- 'operational', 'degraded', 'down'
  latency_ms INTEGER,
  error_details TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_devices_status ON public.devices(status);
CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_audit_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_device_events_device_id ON public.device_state_events(device_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- ==========================================
-- 2. SECURITY (RLS)
-- ==========================================
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Prod Start - Refine as needed)
CREATE POLICY "Public Read Devices" ON public.devices FOR SELECT USING (true);
CREATE POLICY "Auth Write Devices" ON public.devices FOR ALL TO authenticated USING (true);

CREATE POLICY "Public Read Alerts" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "Auth Write Alerts" ON public.alerts FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth Read Audit" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth Write Audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Public Read Events" ON public.device_state_events FOR SELECT USING (true);
CREATE POLICY "Auth Read Health" ON public.system_health_logs FOR SELECT TO authenticated USING (true);

-- ==========================================
-- 3. CORE LOGIC & RPCS
-- ==========================================

-- 3.1 Log State Change Helper
CREATE OR REPLACE FUNCTION log_state_change(
  p_device_id uuid,
  p_new_state text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state text;
BEGIN
  SELECT status INTO v_current_state FROM public.devices WHERE id = p_device_id;
  
  IF v_current_state = p_new_state THEN
    RETURN;
  END IF;

  -- Close previous event
  UPDATE public.device_state_events
  SET ended_at = now()
  WHERE device_id = p_device_id 
  AND ended_at IS NULL;

  -- Start new event
  INSERT INTO public.device_state_events (
    device_id, previous_state, new_state, reason, started_at
  ) VALUES (
    p_device_id, v_current_state, p_new_state, p_reason, now()
  );

  -- Update Device
  UPDATE public.devices
  SET status = p_new_state,
      last_seen_at = now()
  WHERE id = p_device_id;
END;
$$;

-- 3.2 Ensure Alert Helper
CREATE OR REPLACE FUNCTION ensure_alert(
  p_device_id uuid,
  p_type text,
  p_severity text,
  p_message text,
  p_value numeric,
  p_threshold jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  SELECT id INTO existing_id
  FROM public.alerts
  WHERE device_id = p_device_id
  AND type = p_type
  AND status = 'open'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    UPDATE public.alerts
    SET 
      value_at_time = p_value,
      message = p_message,
      severity = p_severity,
      updated_at = now() -- implicit if trigger, but good explicit
    WHERE id = existing_id;
    RETURN existing_id;
  ELSE
    INSERT INTO public.alerts (
      device_id, type, severity, message, value_at_time, threshold_snapshot
    ) VALUES (
      p_device_id, p_type, p_severity, p_message, p_value, p_threshold
    ) RETURNING id INTO new_id;
    RETURN new_id;
  END IF;
END;
$$;

-- 3.3 Heartbeat
CREATE OR REPLACE FUNCTION heartbeat(device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.devices WHERE id = device_id;
  
  IF v_status != 'online' THEN
    PERFORM log_state_change(device_id, 'online', 'Heartbeat Received (Recovery)');
  ELSE
    UPDATE public.devices
    SET last_seen_at = now()
    WHERE id = device_id;
  END IF;
END;
$$;

-- 3.4 Record Reading (with Predictive Warnings)
CREATE OR REPLACE FUNCTION record_reading(
    p_device_id uuid,
    p_ts timestamptz,
    p_tds numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_tds numeric;
    v_old_change_at timestamptz;
    v_threshold numeric := 50.0; -- PPM change that triggers warning
BEGIN
    SELECT last_tds_value, last_tds_change_at 
    INTO v_old_tds, v_old_change_at 
    FROM public.devices WHERE id = p_device_id;

    -- Update last_reading_at always
    UPDATE public.devices 
    SET last_reading_at = p_ts
    WHERE id = p_device_id;

    -- Predictive Analysis
    IF v_old_tds IS NOT NULL AND p_tds IS NOT NULL THEN
          -- 1. Rate of Change Detection (Rapid Spike)
          IF abs(p_tds - v_old_tds) > v_threshold THEN
                PERFORM ensure_alert(
                    p_device_id,
                    'rapid_change',
                    'warning',
                    'TDS level spiked by ' || (p_tds - v_old_tds) || ' PPM instantly',
                    p_tds,
                    jsonb_build_object('old', v_old_tds, 'new', p_tds)
                );
          END IF;

          -- 2. Stuck Sensor logic (Update timestamp only if changed significantly)
          IF abs(p_tds - v_old_tds) > 0.5 THEN
                UPDATE public.devices SET last_tds_change_at = p_ts WHERE id = p_device_id;
          ELSIF v_old_change_at < (now() - interval '24 hours') THEN
                 PERFORM ensure_alert(
                    p_device_id,
                    'sensor_stuck',
                    'warning',
                    'Sensor reading unchanged for 24 hours',
                    p_tds,
                    '{}'::jsonb
                 );
          END IF;
    END IF;

    -- Cache newest value
    IF p_tds IS NOT NULL THEN
        UPDATE public.devices SET last_tds_value = p_tds WHERE id = p_device_id;
    END IF;
END;
$$;

-- 3.5 Check Offline Devices (Cron)
CREATE OR REPLACE FUNCTION check_offline_devices()
RETURNS table(updated_count int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count int;
BEGIN
  WITH newly_offline AS (
    SELECT id, status as old_state 
    FROM public.devices
    WHERE status = 'online' 
    AND last_seen_at < (now() - interval '5 minutes')
  ),
  close_events AS (
    UPDATE public.device_state_events e
    SET ended_at = now()
    FROM newly_offline n
    WHERE e.device_id = n.id AND e.ended_at IS NULL
    RETURNING e.device_id
  ),
  create_events AS (
    INSERT INTO public.device_state_events (device_id, previous_state, new_state, reason, started_at)
    SELECT id, old_state, 'offline', 'Timeout (>5min)', now()
    FROM newly_offline
    RETURNING device_id
  ),
  update_devices AS (
    UPDATE public.devices d
    SET status = 'offline'
    FROM newly_offline n
    WHERE d.id = n.id
    RETURNING d.id
  )
  SELECT count(*) INTO count FROM update_devices;
  
  RETURN QUERY SELECT count;
END;
$$;

-- 3.6 Check Sensor Failures (Data Gap) (Cron)
CREATE OR REPLACE FUNCTION check_sensor_failures()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM public.devices 
             WHERE status IN ('online', 'warning') 
             AND last_reading_at < (now() - interval '15 minutes')
             AND last_seen_at > (now() - interval '5 minutes') -- Heartbeats functional
    LOOP
          PERFORM ensure_alert(
              r.id,
              'sensor_gap',
              'warning',
              'Device Online but Sensor Data Stale (>15min)',
              0,
              '{}'::jsonb
          );
          
          UPDATE public.devices SET status = 'warning' WHERE id = r.id AND status != 'critical';
    END LOOP;
END;
$$;


-- ==========================================
-- 4. QR CODE SYSTEM (ROTATION)
-- ==========================================

-- 4.1 Generate QR Payload
CREATE OR REPLACE FUNCTION generate_qr_payload(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_secret text := 'evara_tds_secret_key_change_in_prod'; 
    v_sig text;
    v_payload jsonb;
    v_version int;
BEGIN
    SELECT qr_version INTO v_version FROM public.devices WHERE id = p_device_id;
    IF v_version IS NULL THEN v_version := 1; END IF;

    v_payload := jsonb_build_object(
            'id', p_device_id, 
            'ts', extract(epoch from now())::bigint,
            'v', v_version
    );
    v_sig := md5(v_payload::text || v_secret);
    RETURN jsonb_build_object('payload', v_payload, 'signature', v_sig, 'version', v_version);
END;
$$;

-- 4.2 Rotate QR Code (Revocation)
CREATE OR REPLACE FUNCTION rotate_qr_code(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.devices 
    SET qr_version = qr_version + 1,
        updated_at = now()
    WHERE id = p_device_id;
    
    INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
    VALUES (auth.uid(), 'rotate_qr', 'device:' || p_device_id, '{}'::jsonb);
END;
$$;


-- ==========================================
-- 5. REPORTING ENGINE
-- ==========================================
CREATE OR REPLACE FUNCTION get_uptime_stats(p_days int DEFAULT 30)
RETURNS TABLE (
    device_id uuid,
    device_name text,
    uptime_percent numeric,
    total_online_seconds bigint,
    total_tracked_seconds bigint,
    outage_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_time timestamptz;
BEGIN
    v_start_time := now() - (p_days || ' days')::interval;

    RETURN QUERY
    WITH period_events AS (
        SELECT 
            e.device_id,
            e.new_state,
            greatest(e.started_at, v_start_time) as effective_start,
            least(coalesce(e.ended_at, now()), now()) as effective_end
        FROM public.device_state_events e
        WHERE e.started_at < now()
        AND coalesce(e.ended_at, now()) > v_start_time
    ),
    durations AS (
        SELECT
            pe.device_id,
            pe.new_state,
            extract(epoch from (pe.effective_end - pe.effective_start))::bigint as duration
        FROM period_events pe
    ),
    aggregated AS (
        SELECT
            d.device_id,
            sum(case when d.new_state = 'online' then d.duration else 0 end)::bigint as online_secs,
            sum(d.duration)::bigint as total_secs,
            count(*) filter (where d.new_state = 'offline') as outages
        FROM durations d
        GROUP BY d.device_id
    )
    SELECT 
        d.id as device_id,
        d.name as device_name,
        case 
            when coalesce(a.total_secs, 0) = 0 then 0 
            else round((coalesce(a.online_secs, 0)::numeric / a.total_secs::numeric) * 100, 2)
        end as uptime_percent,
        coalesce(a.online_secs, 0) as total_online_seconds,
        coalesce(a.total_secs, 0) as total_tracked_seconds,
        coalesce(a.outages, 0) as outage_count
    FROM public.devices d
    LEFT JOIN aggregated a ON d.id = a.device_id;
END;
$$;


-- ==========================================
-- 6. GLOBAL SEARCH (COMMAND PALETTE)
-- ==========================================
CREATE OR REPLACE FUNCTION global_search(search_term text)
RETURNS TABLE (
    id text,
    type text,
    title text,
    subtitle text,
    url text,
    metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Search Devices
    RETURN QUERY
    SELECT 
        d.id::text,
        'device'::text,
        d.name,
        d.location_name,
        '/devices/' || d.id,
        jsonb_build_object('status', d.status)
    FROM public.devices d
    WHERE d.name ILIKE '%' || search_term || '%'
    LIMIT 5;

    -- Search Alerts
    RETURN QUERY
    SELECT
        a.id::text,
        'alert'::text,
        a.type || ' - ' || a.message,
        'Created: ' || to_char(a.created_at, 'YYYY-MM-DD HH24:MI'),
        '/alerts',
        jsonb_build_object('severity', a.severity)
    FROM public.alerts a
    WHERE a.message ILIKE '%' || search_term || '%'
    LIMIT 5;
END;
$$;

-- ==========================================
-- 7. TRIGGERS
-- ==========================================

-- Trigger to Log Audit on Device Delete
CREATE OR REPLACE FUNCTION log_device_delete() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
  VALUES (auth.uid(), 'delete_device', 'device:' || old.id, jsonb_build_object('name', old.name));
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_device_delete
AFTER DELETE ON public.devices
FOR EACH ROW EXECUTE FUNCTION log_device_delete();

-- ==========================================
-- FINAL SEED DATA (OPTIONAL)
-- ==========================================
-- INSERT INTO public.devices (name, status) VALUES ('Demo Device 1', 'online');

-- End of Setup Script