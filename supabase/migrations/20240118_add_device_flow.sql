-- Secure Transactional Flow for Adding Devices
create or replace function add_device(
  p_name text,
  p_location_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_thingspeak_channel_id bigint,
  p_thingspeak_read_key text,
  p_thingspeak_write_key text,
  p_sim_number text, -- Nullable
  p_metadata jsonb,
  p_actor_id uuid -- User ID of who is adding it
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_device_id uuid;
begin
  -- 1. Insert Device
  insert into public.devices (
    name,
    location_name,
    latitude,
    longitude,
    thingspeak_channel_id,
    thingspeak_read_key,
    thingspeak_write_key,
    sim_number,
    metadata,
    status -- Default
  ) values (
    p_name,
    p_location_name,
    p_latitude,
    p_longitude,
    p_thingspeak_channel_id,
    p_thingspeak_read_key,
    p_thingspeak_write_key,
    p_sim_number,
    p_metadata,
    'offline'
  ) returning id into new_device_id;

  -- 2. Create Audit Log Entry
  insert into public.audit_logs (
    actor_id,
    action,
    target_resource,
    details
  ) values (
    p_actor_id,
    'create_device',
    'device:' || new_device_id::text,
    jsonb_build_object(
      'name', p_name,
      'channel_id', p_thingspeak_channel_id
    )
  );

  return new_device_id;
exception
  when unique_violation then
    raise exception 'Device with this ThingSpeak Channel ID or SIM Number already exists.';
end;
$$;
