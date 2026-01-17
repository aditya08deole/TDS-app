-- Enable RLS on main tables
alter table public.devices enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;

-- 1. Devices Policies
-- Allow anyone (including anon) to read devices (Dashboard is public?)
-- If dashboard is private, change "public" to "authenticated"
create policy "Devices are viewable by everyone"
  on public.devices for select
  using ( true );

-- Allow only authenticated users (Admins/Engineers) to modify devices
create policy "Authenticated users can insert devices"
  on public.devices for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can update devices"
  on public.devices for update
  to authenticated
  using ( true );

create policy "Authenticated users can delete devices"
  on public.devices for delete
  to authenticated
  using ( true );

-- 2. Alerts Policies
-- Viewable by everyone
create policy "Alerts are viewable by everyone"
  on public.alerts for select
  using ( true );

-- Modifiable by authenticated users (Acknowledge/Resolve)
create policy "Authenticated users can update alerts"
  on public.alerts for update
  to authenticated
  using ( true );

-- Inserts usually via RPC/Edge Function (Service Role), but allow auth just in case
create policy "Authenticated users can insert alerts"
  on public.alerts for insert
  to authenticated
  with check ( true );

-- 3. Audit Logs Policies
-- Viewable only by authenticated users
create policy "Audit logs are viewable by authenticated users"
  on public.audit_logs for select
  to authenticated
  using ( true );

-- Insertable (via RPC mostly, but allow auth for testing)
create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check ( true );
