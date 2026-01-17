-- Function to ensuring we don't create duplicate open alerts
-- This implements the "Deduplication" logic necessary for a clean alert log
create or replace function ensure_alert(
  p_device_id uuid,
  p_type text,
  p_severity text, -- 'info', 'warning', 'critical'
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
  -- Check for an existing OPEN alert of the same type for this device
  select id into existing_id
  from public.alerts
  where device_id = p_device_id
  and type = p_type
  and status = 'open'
  limit 1;

  if existing_id is not null then
    -- Alert already exists, maybe update the latest value to keep it fresh
    -- We don't change the created_at, so we know when it FIRST happened
    update public.alerts
    set 
      value_at_time = p_value,
      message = p_message, -- Message might evolve (e.g. value got worse)
      severity = p_severity -- Severity might escalate
    where id = existing_id;
    
    return existing_id;
  else
    -- Create new alert
    insert into public.alerts (
      device_id,
      type,
      severity,
      message,
      value_at_time,
      threshold_snapshot
    ) values (
      p_device_id,
      p_type,
      p_severity,
      p_message,
      p_value,
      p_threshold
    ) returning id into new_id;
    
    return new_id;
  end if;
end;
$$;

-- Schedule the alert check every 10 minutes using pg_cron (Edge Function integration required via pg_net or similar, or just relying on Edge Function cron triggers)
-- For now, this SQL focuses on the Logic. The scheduling happens in the Edge Function deployment (deno.json or UI).

