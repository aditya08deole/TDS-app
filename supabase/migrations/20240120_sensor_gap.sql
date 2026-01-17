-- Phase 8: Sensor Gap Detection (Data Gaps)

-- 1. Add last_reading_at column (if not exists)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'devices' and column_name = 'last_reading_at') then
        alter table public.devices add column last_reading_at timestamptz;
    end if;
end $$;

-- 2. Function to update last_reading_at (to be called by Edge Function)
-- We can reuse 'heartbeat' or make a specific one. Let's make a specific one 'record_reading'.
create or replace function record_reading(p_device_id uuid, p_ts timestamptz)
returns void
language plpgsql
security definer
as $$
begin
  update public.devices
  set last_reading_at = p_ts
  where id = p_device_id;
end;
$$;

-- 3. Logic to detect Sensor Failures (Online but No Data)
create or replace function check_sensor_failures()
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  -- Find devices that are ONLINE/WARNING but haven't sent READINGS in > 15 mins
  for r in select * from public.devices 
           where status in ('online', 'warning') 
           and last_reading_at < (now() - interval '15 minutes')
           and last_seen_at > (now() - interval '5 minutes') -- Heartbeats are fine
  loop
     -- Create Alert
     perform ensure_alert(
       r.id,
       'sensor_gap',
       'warning',
       'Device is Online but Sensor Data is stale (>15min)',
       0,
       '{}'::jsonb
     );
     
     -- Update Status to Warning if not already critical/maintenance
     update public.devices set status = 'warning' where id = r.id and status != 'critical';
  end loop;
end;
$$;
