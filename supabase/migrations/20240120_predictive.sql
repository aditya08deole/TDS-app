-- Phase 13: Predictive Warning System

-- 1. Add caching columns for Analysis
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'devices' and column_name = 'last_tds_value') then
        alter table public.devices add column last_tds_value numeric;
        alter table public.devices add column last_tds_change_at timestamptz default now();
    end if;
end $$;

-- 2. Enhanced record_reading with Anomaly Detection
create or replace function record_reading(
  p_device_id uuid,
  p_ts timestamptz,
  p_tds numeric default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_old_tds numeric;
  v_old_change_at timestamptz;
  v_threshold numeric := 50.0; -- PPM change that triggers warning
begin
  select last_tds_value, last_tds_change_at 
  into v_old_tds, v_old_change_at 
  from public.devices where id = p_device_id;

  -- 1. Rate of Change Detection (Rapid Spike)
  if v_old_tds is not null and p_tds is not null then
     if abs(p_tds - v_old_tds) > v_threshold then
        -- Trigger Alert: Rapid Change
        perform ensure_alert(
          p_device_id,
          'rapid_change',
          'warning',
          'TDS level spiked by ' || (p_tds - v_old_tds) || ' PPM instantly (Possible Contamination)',
          0,
          jsonb_build_object('old', v_old_tds, 'new', p_tds)
        );
     end if;

     -- 2. Stuck Sensor Detection Logic (Update Timestamp if changed)
     if abs(p_tds - v_old_tds) > 0.5 then
        update public.devices set last_tds_change_at = p_ts where id = p_device_id;
     else
        -- Value is "Stuck". Check duration.
        if v_old_change_at < (now() - interval '24 hours') then
           perform ensure_alert(
             p_device_id, 
             'sensor_stuck', 
             'warning', 
             'Sensor value unchanged for > 24 hours (Stuck Sensor)', 
             0, 
             jsonb_build_object('val', p_tds)
           );
        end if;
     end if;
  end if;

  -- 3. Update Device State
  update public.devices
  set last_reading_at = p_ts,
      last_tds_value = coalesce(p_tds, last_tds_value)
  where id = p_device_id;
end;
$$;
