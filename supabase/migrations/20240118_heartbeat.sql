-- Function to update verify device is alive (heartbeat)
-- Call this from your edge devices or via a secure API endpoint
create or replace function heartbeat(device_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.devices
  set 
    last_seen_at = now(),
    status = 'online'
  where id = device_id;
end;
$$;

-- Function to check for offline devices
-- Can be called by a cron job (pg_cron) or Edge Function
create or replace function check_offline_devices()
returns table(updated_count int)
language plpgsql
security definer
as $$
declare
  count int;
begin
  -- Update devices that haven't been seen in 5 minutes
  with updated as (
    update public.devices
    set status = 'offline'
    where status = 'online' 
    and last_seen_at < (now() - interval '5 minutes')
    returning id
  )
  select count(*) into count from updated;
  
  return query select count;
end;
$$;

-- Schedule the offline check every 5 minutes using pg_cron
-- Note: Requires pg_cron extension to be enabled in Supabase Dashboard
-- select cron.schedule('check-offline-devices', '*/5 * * * *', 'select check_offline_devices()');
