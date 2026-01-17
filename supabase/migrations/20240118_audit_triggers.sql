-- Helper for manual logging from Edge Functions
create or replace function log_event(
  p_action text,
  p_resource text,
  p_details jsonb,
  p_actor_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.audit_logs (actor_id, action, target_resource, details)
  values (p_actor_id, p_action, p_resource, p_details);
end;
$$;

-- Trigger: Log Alert Resolution
create or replace function log_alert_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'resolved' and old.status != 'resolved' then
    insert into public.audit_logs (actor_id, action, target_resource, details)
    values (
      new.resolved_by, -- Assuming this is set during update
      'resolve_alert',
      'alert:' || new.id,
      jsonb_build_object('device_id', new.device_id, 'message', new.message)
    );
  end if;
  return new;
end;
$$;

create trigger on_alert_update
  after update on public.alerts
  for each row
  execute function log_alert_update();

-- Trigger: Log Device Deletion
create or replace function log_device_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.audit_logs (actor_id, action, target_resource, details)
  values (
    auth.uid(), -- The user deleting it
    'delete_device',
    'device:' || old.id,
    jsonb_build_object('name', old.name, 'channel_id', old.thingspeak_channel_id)
  );
  return old;
end;
$$;

create trigger on_device_delete
  after delete on public.devices
  for each row
  execute function log_device_delete();
