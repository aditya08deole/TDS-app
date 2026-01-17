-- Function to scan and verify a device QR code
create or replace function scan_device(p_payload jsonb, p_signature text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text := 'evara_tds_secret_key_change_in_prod'; -- Must match generation key
  v_calc_sig text;
  v_device_id uuid;
  v_device_record record;
begin
  -- 1. Re-calculate signature
  -- v_calc_sig := encode(hmac(p_payload::text, v_secret, 'sha256'), 'hex');
  v_calc_sig := md5(p_payload::text || v_secret);
  
  -- 2. Verify Signature
  if v_calc_sig != p_signature then
    raise exception 'Invalid QR Code Signature';
  end if;
  
  -- 3. Extract Device ID
  v_device_id := (p_payload->>'id')::uuid;
  
  -- 4. Fetch Device Details
  select * into v_device_record
  from public.devices
  where id = v_device_id;
  
  if not found then
    raise exception 'Device not found in registry';
  end if;
  
  -- 5. Return Public Metadata
  return jsonb_build_object(
    'id', v_device_record.id,
    'name', v_device_record.name,
    'status', v_device_record.status,
    'location', v_device_record.location_name,
    'last_seen', v_device_record.last_seen_at
  );
end;
$$;
