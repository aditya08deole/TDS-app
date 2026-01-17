-- Phase 10: QR Lifecycle - Rotation & Revocation

-- 1. Add versioning columns
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'devices' and column_name = 'qr_version') then
        alter table public.devices add column qr_version integer default 1;
    end if;
end $$;

-- 2. Update Generator to include Version
create or replace function generate_qr_payload(p_device_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text := 'evara_tds_secret_key_change_in_prod'; 
  v_sig text;
  v_payload jsonb;
  v_version int;
begin
  select qr_version into v_version from public.devices where id = p_device_id;
  
  -- If device not found, default to 0
  if v_version is null then v_version := 0; end if;

  v_payload := jsonb_build_object(
      'id', p_device_id, 
      'ts', extract(epoch from now())::bigint,
      'v', v_version
  );
  v_sig := md5(v_payload::text || v_secret);
  return jsonb_build_object('payload', v_payload, 'signature', v_sig, 'version', v_version);
end;
$$;

-- 3. Update Scanner to Verify Version
create or replace function scan_device(p_payload jsonb, p_signature text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text := 'evara_tds_secret_key_change_in_prod';
  v_calc_sig text;
  v_device_id uuid;
  v_payload_version int;
  v_device_record record;
begin
  -- 1. Verify Signature
  v_calc_sig := md5(p_payload::text || v_secret);
  if v_calc_sig != p_signature then
    raise exception 'Invalid QR Code Signature';
  end if;
  
  -- 2. Parse Payload
  v_device_id := (p_payload->>'id')::uuid;
  v_payload_version := (p_payload->>'v')::int;
  
  select * into v_device_record from public.devices where id = v_device_id;
  
  if not found then raise exception 'Device not found in registry'; end if;
  
  -- 3. Verify Version Match (Revocation Check)
  if v_device_record.qr_version != v_payload_version then
     raise exception 'QR Code Revoked (Version Mismatch)';
  end if;
  
  return jsonb_build_object(
    'id', v_device_record.id,
    'name', v_device_record.name,
    'status', v_device_record.status,
    'location', v_device_record.location_name,
    'last_seen', v_device_record.last_seen_at
  );
end;
$$;

-- 4. Rotation RPC
create or replace function rotate_qr_code(p_device_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.devices 
  set qr_version = qr_version + 1 
  where id = p_device_id;
  
  -- Log audit
  insert into public.audit_logs (actor_id, action, target_resource, details)
  values (auth.uid(), 'rotate_qr', 'device:' || p_device_id, '{}'::jsonb);
end;
$$;
