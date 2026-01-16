
-- 0. MISSING BASE TABLES (Dependencies)
-- We noticed 'alerts' and 'sensor_data' were missing. Creating them now.

create table if not exists alerts (
  id bigint generated always as identity primary key,
  device_id uuid references devices(id) on delete cascade,
  message text,
  severity text check (severity in ('info', 'warning', 'critical')),
  status text check (status in ('open', 'acknowledged', 'resolved')) default 'open',
  created_at timestamp default now(),
  resolved_at timestamp,
  resolved_by uuid references auth.users(id) -- Changed from profiles(id) to auth.users(id) to be safe if profiles is empty/rls issues
);

alter table alerts enable row level security;
drop policy if exists "Enable all access for authenticated users" on alerts;
create policy "Enable all access for authenticated users" on alerts for all using (auth.role() = 'authenticated');

create table if not exists sensor_data (
  id bigint generated always as identity primary key,
  device_id uuid references devices(id) on delete cascade,
  tds numeric,
  temperature numeric,
  voltage numeric,
  recorded_at timestamp default now()
);

alter table sensor_data enable row level security;
drop policy if exists "Enable all access for authenticated users" on sensor_data;
create policy "Enable all access for authenticated users" on sensor_data for all using (auth.role() = 'authenticated');


-- PHASE 1: DEVICE RELIABILITY & HEALTH ENGINE

-- Device Heartbeat: Tracks real-time status
create table if not exists device_heartbeat (
  device_id uuid references devices(id) primary key,
  last_seen timestamp with time zone not null,
  voltage numeric,
  status text check (status in ('ONLINE','DEGRADED','OFFLINE','MAINTENANCE'))
);

alter table device_heartbeat enable row level security;

drop policy if exists "Workers can insert/update heartbeat" on device_heartbeat;
create policy "Workers can insert/update heartbeat"
  on device_heartbeat for all
  using (true)
  with check (true);

drop policy if exists "Everyone can view heartbeat" on device_heartbeat;
create policy "Everyone can view heartbeat"
  on device_heartbeat for select
  using (true);


-- Device State History: Tracks lifecycle changes for analytics
create table if not exists device_state_history (
  id bigint generated always as identity primary key,
  device_id uuid references devices(id),
  old_state text,
  new_state text,
  changed_at timestamp with time zone default now()
);

alter table device_state_history enable row level security;

drop policy if exists "Workers can insert history" on device_state_history;
create policy "Workers can insert history"
  on device_state_history for insert
  with check (true);

drop policy if exists "Admins can view history" on device_state_history;
create policy "Admins can view history"
  on device_state_history for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'operator')
    )
  );

-- PHASE 2: ALERT ACCOUNTABILITY & ESCALATION ENGINE

-- Update Alerts Table
alter table alerts
add column if not exists acknowledged_by uuid references auth.users(id),
add column if not exists acknowledged_at timestamp with time zone,
add column if not exists resolved_by uuid references auth.users(id),
add column if not exists resolved_at timestamp with time zone,
add column if not exists escalation_level integer default 0;

-- Escalation Rules
create table if not exists escalation_rules (
  severity text primary key,
  minutes_to_escalate integer,
  next_role text
);

alter table escalation_rules enable row level security;
drop policy if exists "Read rules" on escalation_rules;
create policy "Read rules" on escalation_rules for select using (true);

-- Default Rules
insert into escalation_rules (severity, minutes_to_escalate, next_role)
values 
  ('critical', 10, 'admin'),
  ('warning', 30, 'operator')
on conflict (severity) do nothing;

-- PHASE 3: DATA LEGALITY & FORENSICS

-- 1. Immutable Sensor Data
alter table sensor_data enable row level security;

-- Prevent Updates (make it append-only)
drop policy if exists "No updates on sensor data" on sensor_data;
create policy "No updates on sensor data"
on sensor_data
for update
using (false);

-- Prevent Deletes
drop policy if exists "No deletes on sensor data" on sensor_data;
create policy "No deletes on sensor data"
on sensor_data
for delete
using (false);

-- 2. Audit Logs
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  action text,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  source text default 'dashboard',
  created_at timestamp with time zone default now()
);

alter table audit_logs enable row level security;
drop policy if exists "Admins View Audit Logs" on audit_logs;
create policy "Admins View Audit Logs" on audit_logs for select using (
  exists (select 1 from profiles where profiles.id = auth.uid() and role in ('admin','super_admin'))
);

-- 3. Audit Trigger
create or replace function log_audit()
returns trigger as $$
begin
  insert into audit_logs(user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    NEW.id::text,
    row_to_json(OLD),
    row_to_json(NEW)
  );
  return NEW;
end;
$$ language plpgsql;

-- Attach Triggers
drop trigger if exists audit_devices on devices;
create trigger audit_devices
after insert or update on devices
for each row execute function log_audit();

drop trigger if exists audit_alerts on alerts;
create trigger audit_alerts
after insert or update on alerts
for each row execute function log_audit();

-- PHASE 4: SECURITY & DATA AUTHENTICITY

-- 1. Device Secrets & Nonce
alter table devices
add column if not exists device_secret text,
add column if not exists last_nonce bigint default 0;

-- 2. Security Events (Log attacks)
create table if not exists security_events (
  id bigint generated always as identity primary key,
  device_id uuid,
  ip text,
  reason text,
  payload jsonb,
  created_at timestamp with time zone default now()
);

alter table security_events enable row level security;
drop policy if exists "Admins view security logs" on security_events;
create policy "Admins view security logs" on security_events for select using (
  exists (select 1 from profiles where profiles.id = auth.uid() and role in ('admin','super_admin'))
);

-- 3. Blocked Devices (Rate limiting / Abuse)
create table if not exists blocked_devices (
  device_id uuid primary key,
  blocked_at timestamp with time zone default now(),
  reason text
);

alter table blocked_devices enable row level security;

-- PHASE 5: OPERATIONS & STABILITY

-- 1. Backup Logs
create table if not exists backup_logs (
  id bigint generated always as identity primary key,
  backup_time timestamp with time zone default now(),
  status text,
  location text
);

-- 2. Health Checks
create table if not exists health_checks (
  id bigint generated always as identity primary key,
  component text,
  status text,
  checked_at timestamp with time zone default now()
);

-- 3. Frontend Errors (Global Error Boundary)
create table if not exists frontend_errors (
  id bigint generated always as identity primary key,
  user_id uuid,
  error text,
  stack text,
  url text,
  user_agent text,
  created_at timestamp with time zone default now()
);

alter table frontend_errors enable row level security;
drop policy if exists "Public insert errors" on frontend_errors;
create policy "Public insert errors" on frontend_errors for insert with check (true); 
-- Allow public insert for unauthenticated crashes, or restrict if strictly internal.

-- 4. Function Logs
create table if not exists function_logs (
  id bigint generated always as identity primary key,
  function_name text,
  status text,
  device_id uuid,
  duration_ms integer,
  created_at timestamp with time zone default now()
);

-- PHASE 6: FIELD-GRADE UX

-- 1. Alert Photos & Notes
alter table alerts
add column if not exists photo_url text,
add column if not exists notes text,
add column if not exists note_author uuid references auth.users(id);

-- 2. Command Center Settings (Optional)
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id),
  theme text,
  dashboard_layout jsonb
);

alter table user_settings enable row level security;
drop policy if exists "Users manage own settings" on user_settings;
create policy "Users manage own settings" on user_settings for all using (user_id = auth.uid());
