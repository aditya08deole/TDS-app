-- Phase 12: Reporting Engine

create or replace function get_uptime_stats(p_days int default 30)
returns table (
  device_id uuid,
  device_name text,
  uptime_percent numeric,
  total_online_seconds bigint,
  total_tracked_seconds bigint,
  outage_count bigint
)
language plpgsql
security definer
as $$
declare
  v_start_time timestamptz;
begin
  v_start_time := now() - (p_days || ' days')::interval;

  return query
  with period_events as (
    -- Get all events that overlap with the period
    select 
      e.device_id,
      e.new_state,
      greatest(e.started_at, v_start_time) as effective_start,
      least(coalesce(e.ended_at, now()), now()) as effective_end
    from public.device_state_events e
    where e.started_at < now() -- Started before now
    and coalesce(e.ended_at, now()) > v_start_time -- Ended after start window
  ),
  durations as (
    select
      pe.device_id,
      pe.new_state,
      extract(epoch from (pe.effective_end - pe.effective_start))::bigint as duration
    from period_events pe
  ),
  aggregated as (
    select
      d.device_id,
      sum(case when d.new_state = 'online' then d.duration else 0 end)::bigint as online_secs,
      sum(d.duration)::bigint as total_secs,
      count(*) filter (where d.new_state = 'offline') as outages
    from durations d
    group by d.device_id
  )
  select 
    d.id as device_id,
    d.name as device_name,
    case 
      when coalesce(a.total_secs, 0) = 0 then 0 
      else round((coalesce(a.online_secs, 0)::numeric / a.total_secs::numeric) * 100, 2)
    end as uptime_percent,
    coalesce(a.online_secs, 0) as total_online_seconds,
    coalesce(a.total_secs, 0) as total_tracked_seconds,
    coalesce(a.outages, 0) as outage_count
  from public.devices d
  left join aggregated a on d.id = a.device_id;
end;
$$;
