-- EvaraTDS Production Setup Script
-- consolidated from all migrations (Phases 1-11 + Master Plan)

-- ==========================================
-- 1. BASE SCHEMA (from 20240117_thingspeak_setup.sql)
-- ==========================================

-- 1. DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.devices (
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
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'critical', 'maintenance', 'warning')),
    last_seen_at TIMESTAMPTZ,
    deployment_date TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    value_at_time NUMERIC, 
    threshold_snapshot JSONB,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    escalation_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

-- 3. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_thingspeak_id ON public.devices(thingspeak_channel_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON public.alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

-- Realtime
alter publication supabase_realtime add table devices;
alter publication supabase_realtime add table alerts;


-- ==========================================
-- 2. PHASE 2: DEVICE HEALTH TIMELINE (from 20240119_health_timeline.sql)
-- ==========================================

create table if not exists public.device_state_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices(id) on delete cascade,
  previous_state text,
  new_state text not null,
  reason text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds int generated always as ( extract(epoch from (ended_at - started_at)) ) stored
);

create index idx_device_events_device_id on public.device_state_events(device_id);
create index idx_device_events_started_at on public.device_state_events(started_at);

-- Helper to log state changes
create or replace function log_state_change(
  p_device_id uuid,
  p_new_state text,
  p_reason text
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_state text;
begin
  select status into v_current_state from public.devices where id = p_device_id;
  
  if v_current_state = p_new_state then
    return;
  end if;

  update public.device_state_events
  set ended_at = now()
  where device_id = p_device_id 
  and ended_at is null;

  insert into public.device_state_events (
    device_id, previous_state, new_state, reason, started_at
  ) values (
    p_device_id, v_current_state, p_new_state, p_reason, now()
  );

  update public.devices
  set status = p_new_state,
      last_seen_at = now()
  where id = p_device_id;
end;
$$;


-- ==========================================
-- 3. HEARTBEAT & HEALTH LOGIC (Updated from 20240119)
-- ==========================================

create or replace function heartbeat(device_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status text;
begin
  select status into v_status from public.devices where id = device_id;
  
  if v_status != 'online' then
    perform log_state_change(device_id, 'online', 'Heartbeat Received (Recovery)');
  else
    update public.devices
    set last_seen_at = now()
    where id = device_id;
  end if;
end;
$$;

create or replace function check_offline_devices()
returns table(updated_count int)
language plpgsql
security definer
as $$
declare
  count int;
begin
  with newly_offline as (
    select id, status as old_state 
    from public.devices
    where status = 'online' 
    and last_seen_at < (now() - interval '5 minutes')
  ),
  close_events as (
    update public.device_state_events e
    set ended_at = now()
    from newly_offline n
    where e.device_id = n.id and e.ended_at is null
    returning e.device_id
  ),
  create_events as (
    insert into public.device_state_events (device_id, previous_state, new_state, reason, started_at)
    select id, old_state, 'offline', 'Timeout (>5min)', now()
    from newly_offline
    returning device_id
  ),
  update_devices as (
    update public.devices d
    set status = 'offline'
    from newly_offline n
    where d.id = n.id
    returning d.id
  )
  select count(*) into count from update_devices;
  
  return query select count;
end;
$$;


-- ==========================================
-- 4. ALERT LOGIC (from 20240118_alert_logic.sql)
-- ==========================================

create or replace function ensure_alert(
  p_device_id uuid,
  p_type text,
  p_severity text,
  p_message text,
  p_value numeric,
  p_threshold jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  select id into existing_id
  from public.alerts
  where device_id = p_device_id
  and type = p_type
  and status = 'open'
  limit 1;

  if existing_id is not null then
    update public.alerts
    set 
      value_at_time = p_value,
      message = p_message,
      severity = p_severity
    where id = existing_id;
    return existing_id;
  else
    insert into public.alerts (
      device_id, type, severity, message, value_at_time, threshold_snapshot
    ) values (
      p_device_id, p_type, p_severity, p_message, p_value, p_threshold
    ) returning id into new_id;
    return new_id;
  end if;
end;
$$;


-- ==========================================
-- 5. DEVICE TRANSACTIONAL FLOW (from 20240118_add_device_flow.sql)
-- ==========================================

create or replace function add_device(
  p_name text,
  p_location_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_thingspeak_channel_id bigint,
  p_thingspeak_read_key text,
  p_thingspeak_write_key text,
  p_sim_number text, 
  p_metadata jsonb,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_device_id uuid;
begin
  insert into public.devices (
    name, location_name, latitude, longitude,
    thingspeak_channel_id, thingspeak_read_key, thingspeak_write_key,
    sim_number, metadata, status
  ) values (
    p_name, p_location_name, p_latitude, p_longitude,
    p_thingspeak_channel_id, p_thingspeak_read_key, p_thingspeak_write_key,
    p_sim_number, p_metadata, 'offline'
  ) returning id into new_device_id;

  insert into public.audit_logs (
    actor_id, action, target_resource, details
  ) values (
    p_actor_id, 'create_device', 'device:' || new_device_id::text,
    jsonb_build_object('name', p_name, 'channel_id', p_thingspeak_channel_id)
  );

  return new_device_id;
exception
  when unique_violation then
    raise exception 'Device with this ThingSpeak Channel ID or SIM Number already exists.';
end;
$$;


-- ==========================================
-- 6. QR SYSTEM & SCANNING (from 20240118_qr_system.sql & qr_scan.sql)
-- ==========================================

create or replace function generate_qr_payload(p_device_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text := 'evara_tds_secret_key_change_in_prod'; 
  v_sig text;
  v_payload jsonb;
begin
  v_payload := jsonb_build_object('id', p_device_id, 'ts', extract(epoch from now())::bigint);
  v_sig := md5(v_payload::text || v_secret); -- Replace with HMAC-SHA256 in prod
  return jsonb_build_object('payload', v_payload, 'signature', v_sig);
end;
$$;

create or replace function scan_device(p_payload jsonb, p_signature text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text := 'evara_tds_secret_key_change_in_prod';
  v_calc_sig text;
  v_device_id uuid;
  v_device_record record;
begin
  v_calc_sig := md5(p_payload::text || v_secret);
  if v_calc_sig != p_signature then
    raise exception 'Invalid QR Code Signature';
  end if;
  
  v_device_id := (p_payload->>'id')::uuid;
  select * into v_device_record from public.devices where id = v_device_id;
  
  if not found then raise exception 'Device not found in registry'; end if;
  
  return jsonb_build_object(
    'id', v_device_record.id,
    'name', v_device_record.name,
    'status', v_device_record.status,
    'location', v_device_record.location_name,
    'last_seen', v_device_record.last_seen_at
  );
end;
$$;


-- ==========================================
-- 7. SECURITY & RLS (from 20240118_rls_security.sql)
-- ==========================================

alter table public.devices enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.device_state_events enable row level security;

-- Devices
create policy "Devices are viewable by everyone" on public.devices for select using ( true );
create policy "Authenticated users can insert devices" on public.devices for insert to authenticated with check ( true );
create policy "Authenticated users can update devices" on public.devices for update to authenticated using ( true );
create policy "Authenticated users can delete devices" on public.devices for delete to authenticated using ( true );

-- Alerts
create policy "Alerts are viewable by everyone" on public.alerts for select using ( true );
create policy "Authenticated users can update alerts" on public.alerts for update to authenticated using ( true );
create policy "Authenticated users can insert alerts" on public.alerts for insert to authenticated with check ( true );

-- Audit Logs
create policy "Audit logs are viewable by authenticated users" on public.audit_logs for select to authenticated using ( true );
create policy "Authenticated users can insert audit logs" on public.audit_logs for insert to authenticated with check ( true );

-- Device Events
create policy "Device events are viewable by everyone" on public.device_state_events for select using ( true );


-- ==========================================
-- 8. AUDIT TRIGGERS (from 20240118_audit_triggers.sql)
-- ==========================================

create or replace function log_event(
  p_action text,
  p_resource text,
  p_details jsonb,
  p_actor_id uuid default auth.uid()
) returns void language plpgsql security definer as $$
begin
  insert into public.audit_logs (actor_id, action, target_resource, details)
  values (p_actor_id, p_action, p_resource, p_details);
end;
$$;

create or replace function log_alert_update() returns trigger language plpgsql security definer as $$
begin
  if new.status = 'resolved' and old.status != 'resolved' then
    insert into public.audit_logs (actor_id, action, target_resource, details)
    values (new.resolved_by, 'resolve_alert', 'alert:' || new.id, jsonb_build_object('device_id', new.device_id, 'message', new.message));
  end if;
  return new;
end;
$$;

create trigger on_alert_update after update on public.alerts for each row execute function log_alert_update();

create or replace function log_device_delete() returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_logs (actor_id, action, target_resource, details)
  values (auth.uid(), 'delete_device', 'device:' || old.id, jsonb_build_object('name', old.name, 'channel_id', old.thingspeak_channel_id));
  return old;
end;
$$;

create trigger on_device_delete after delete on public.devices for each row execute function log_device_delete();


-- ==========================================
-- 9. PHASE 3: CONFIDENCE SCORE ENGINE
-- ==========================================

-- Add confidence score to devices
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'confidence_score') THEN 
        ALTER TABLE public.devices ADD COLUMN confidence_score INTEGER DEFAULT 100 CHECK (confidence_score BETWEEN 0 AND 100); 
    END IF; 
END $$;

-- Scheduled function to decay confidence if offline
create or replace function calculate_confidence_scores()
returns void
language plpgsql
security definer
as $$
begin
  -- Example Logic: Decay score by 10 for every hour offline
  -- This is a placeholder for the advanced algorithm
  update public.devices
  set confidence_score = greatest(0, confidence_score - 10)
  where status = 'offline'
  and last_seen_at < (now() - interval '1 hour');
  
  -- Reset to 100 if online and stable (implied by heartbeat)
  update public.devices
  set confidence_score = 100
  where status = 'online'
  and confidence_score < 100;
end;
$$;


-- ==========================================
-- 10. PHASE 15: SYSTEM HEALTH MONITORING
-- ==========================================

create table if not exists public.system_health_logs (
  id uuid primary key default gen_random_uuid(),
  component text not null, -- 'supabase_db', 'thingspeak_api', 'edge_functions'
  status text not null, -- 'healthy', 'degraded', 'down'
  latency_ms integer,
  error_details text,
  checked_at timestamptz default now()
);

alter table public.system_health_logs enable row level security;
create policy "Admins can view system health" on public.system_health_logs for select to authenticated using ( true ); -- Restrict via App Logic/Role later


-- ==========================================
-- 11. FINAL CLEANUP & SCHEDULES
-- ==========================================
-- select cron.schedule('check-offline-devices', '*/5 * * * *', 'select check_offline_devices()');
-- select cron.schedule('decay-confidence', '0 * * * *', 'select calculate_confidence_scores()');

