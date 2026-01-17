-- Phase 2: Device Health Timeline
-- Create the immutable event log for device state transitions

create table if not exists public.device_state_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices(id) on delete cascade,
  previous_state text,
  new_state text not null,
  reason text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  -- Auto-calculated duration when ended_at is set
  duration_seconds int generated always as ( extract(epoch from (ended_at - started_at)) ) stored
);

-- Index for timeline queries
create index idx_device_events_device_id on public.device_state_events(device_id);
create index idx_device_events_started_at on public.device_state_events(started_at);

-- Enable RLS
alter table public.device_state_events enable row level security;

-- Public read access (for Dashboard/Inspector)
create policy "Device events are viewable by everyone"
  on public.device_state_events for select
  using ( true );

-- Function to safely log a state change (closing the previous one)
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
  -- Get current state
  select status into v_current_state from public.devices where id = p_device_id;
  
  -- Idempotency: If state is same, do nothing
  if v_current_state = p_new_state then
    return;
  end if;

  -- 1. Close the previous open event for this device
  update public.device_state_events
  set ended_at = now()
  where device_id = p_device_id 
  and ended_at is null;

  -- 2. Insert new event
  insert into public.device_state_events (
    device_id, 
    previous_state, 
    new_state, 
    reason, 
    started_at
  ) values (
    p_device_id, 
    v_current_state, 
    p_new_state, 
    p_reason, 
    now()
  );

  -- 3. Update the device's actual status
  update public.devices
  set status = p_new_state,
      last_seen_at = now()
  where id = p_device_id;
end;
$$;


-- OVERRIDE: Update heartbeat to use the new logging logic
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
    -- It was offline/warning, now it's back! Log the transition.
    perform log_state_change(device_id, 'online', 'Heartbeat Received (Recovery)');
  else
    -- Just a normal heartbeat, update timestamp only
    update public.devices
    set last_seen_at = now()
    where id = device_id;
  end if;
end;
$$;


-- OVERRIDE: Update check_offline_devices to use event logging (Bulk Optimized)
create or replace function check_offline_devices()
returns table(updated_count int)
language plpgsql
security definer
as $$
declare
  count int;
begin
  -- Identify devices that timed out
  -- We use a CTE to capture them before updating
  with newly_offline as (
    select id, status as old_state 
    from public.devices
    where status = 'online' 
    and last_seen_at < (now() - interval '5 minutes')
  ),
  -- 1. Close their previous events
  close_events as (
    update public.device_state_events e
    set ended_at = now()
    from newly_offline n
    where e.device_id = n.id and e.ended_at is null
    returning e.device_id
  ),
  -- 2. Create new 'offline' events
  create_events as (
    insert into public.device_state_events (device_id, previous_state, new_state, reason, started_at)
    select id, old_state, 'offline', 'Timeout (>5min)', now()
    from newly_offline
    returning device_id
  ),
  -- 3. Update Device Status
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
