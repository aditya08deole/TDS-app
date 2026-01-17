-- Phase 4: Global Search Optimization
-- Enables fast, fuzzy text search for the Command Palette

-- 1. Enable Trigram Extension (if supported by Supabase project)
-- Note: Requires superuser or specific extension grants. 
-- If this fails, standard 'ilike' will still work but slower.
create extension if not exists pg_trgm;

-- 2. Create Trigram Indexes for Fast Text Search
-- Devices: Name, Location, Description
create index if not exists idx_devices_name_trgm on public.devices using gin (name gin_trgm_ops);
create index if not exists idx_devices_location_trgm on public.devices using gin (location_name gin_trgm_ops);

-- Alerts: Message
create index if not exists idx_alerts_message_trgm on public.alerts using gin (message gin_trgm_ops);

-- 3. Search Helper Function (Optional but cleaner)
create or replace function global_search(search_term text)
returns table (
  id uuid,
  type text, -- 'device' or 'alert'
  title text,
  subtitle text,
  metadata jsonb
) 
language plpgsql
security definer
as $$
begin
  return query
  select 
    d.id, 
    'device'::text as type,
    d.name as title,
    coalesce(d.location_name, 'Unknown Location') as subtitle,
    jsonb_build_object('status', d.status) as metadata
  from public.devices d
  where d.name ilike '%' || search_term || '%'
     or d.location_name ilike '%' || search_term || '%'
  limit 5;

  return query
  select 
    a.id, 
    'alert'::text as type,
    a.message as title,
    ('Severity: ' || a.severity)::text as subtitle,
    jsonb_build_object('status', a.status) as metadata
  from public.alerts a
  where a.message ilike '%' || search_term || '%'
  limit 5;
end;
$$;
