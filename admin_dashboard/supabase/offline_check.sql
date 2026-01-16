-- Function to mark devices as offline if silent for > 5 minutes
create or replace function mark_offline_devices()
returns void
language plpgsql
security definer
as $$
begin
  update devices
  set status = 'offline'
  where last_seen < (now() - interval '5 minutes')
  and status != 'offline';
end;
$$;
