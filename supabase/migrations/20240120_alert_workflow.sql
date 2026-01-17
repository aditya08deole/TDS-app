-- Phase 7: Alert Ownership & Escalation

-- 1. Acknowledge Alert RPC
create or replace function acknowledge_alert(
  p_alert_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update public.alerts
  set status = 'acknowledged',
      acknowledged_at = now()
  where id = p_alert_id
  and status = 'open';

  -- Log to audit (optional, could rely on triggers, but explicit is good)
  -- Trigger 'on_alert_update' handled in prod_setup.sql might handle this if checked
end;
$$;

-- 2. Resolve Alert RPC
create or replace function resolve_alert(
  p_alert_id uuid,
  p_actor_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.alerts
  set status = 'resolved',
      resolved_at = now(),
      resolved_by = p_actor_id
      -- potentially store p_notes in a separate notes table or add column?
      -- For now, we'll assume audit log captures it via separate insert or triggering event
  where id = p_alert_id
  and status != 'resolved';
  
  -- If notes provided, log them
  if p_notes is not null then
    insert into public.audit_logs (actor_id, action, target_resource, details)
    values (p_actor_id, 'resolve_alert', 'alert:' || p_alert_id, jsonb_build_object('notes', p_notes));
  end if;
end;
$$;

-- 3. Escalation Logic
create or replace function check_escalations()
returns void
language plpgsql
security definer
as $$
begin
  -- Escalate to Level 1 (Warning) if open > 4 hours
  update public.alerts
  set escalation_level = 1
  where status = 'open'
  and escalation_level = 0
  and created_at < (now() - interval '4 hours');

  -- Escalate to Level 2 (Critical) if open > 24 hours
  update public.alerts
  set escalation_level = 2
  where status = 'open'
  and escalation_level < 2
  and created_at < (now() - interval '24 hours');
end;
$$;
