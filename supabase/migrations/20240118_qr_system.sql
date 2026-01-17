-- Function to generate a secure QR payload for a device
create or replace function generate_qr_payload(p_device_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_secret text := 'evara_tds_secret_key_change_in_prod'; -- In prod, use a vault or env var
  v_sig text;
  v_payload jsonb;
begin
  -- payload matches the TypeScript type we'll use in the app
  v_payload := jsonb_build_object(
    'id', p_device_id,
    'ts', extract(epoch from now())::bigint
  );
  
  -- Simple HMAC-like signature (mock for demonstration, use pgcrypto for real HMAC)
  -- For real security: perform proper HMAC-SHA256 using pgcrypto extension
  -- v_sig := encode(hmac(v_payload::text, v_secret, 'sha256'), 'hex');
  
  -- Simplified Mock Signature for this phase
  v_sig := md5(v_payload::text || v_secret);
  
  return jsonb_build_object(
    'payload', v_payload,
    'signature', v_sig
  );
end;
$$;
