import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts"
import { sha256 } from "https://deno.land/x/sha256@v1.0.2/mod.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        const { device_id, timestamp, nonce, tds, temperature, voltage, signature } = payload

        if (!device_id || !timestamp || !nonce || !signature) {
            throw new Error('Missing required fields')
        }

        // 1. Check if Blocked
        const { data: blocked } = await supabase.from('blocked_devices').select('reason').eq('device_id', device_id).single()
        if (blocked) {
            return new Response(JSON.stringify({ error: 'Device Blocked', reason: blocked.reason }), { status: 403 })
        }

        // 2. Fetch Secret & Nonce
        const { data: device } = await supabase
            .from('devices')
            .select('device_secret, last_nonce')
            .eq('id', device_id)
            .single()

        if (!device || !device.device_secret) {
            throw new Error('Device not found or not provisioned')
        }

        // 3. Replay Protection (Nonce)
        if (nonce <= (device.last_nonce || 0)) {
            await logSecurityEvent(supabase, device_id, 'REPLAY_ATTACK', { nonce, last_nonce: device.last_nonce })
            throw new Error('Invalid Nonce: Replay Detected')
        }

        // 4. Timestamp Freshness (30s)
        const now = Date.now()
        const msgTime = new Date(timestamp).getTime()
        if (Math.abs(now - msgTime) > 30000) {
            await logSecurityEvent(supabase, device_id, 'STALE_TIMESTAMP', { timestamp, now })
            throw new Error('Timestamp out of bounds')
        }

        // 5. Verify Signature (HMAC-SHA256)
        // Message: device_id + timestamp + nonce + tds + temperature + voltage
        const message = `${device_id}${timestamp}${nonce}${tds}${temperature || ''}${voltage || ''}`
        const expectedSignature = hmac(sha256, device.device_secret, message, 'utf8', 'hex')

        if (signature !== expectedSignature) {
            await logSecurityEvent(supabase, device_id, 'INVALID_SIGNATURE', { provided: signature }) //, expected: expectedSignature })
            throw new Error('Invalid Signature')
        }

        // 6. Success - Ingest Data
        // Insert Sensor Data
        const { error: insertError } = await supabase.from('sensor_data').insert({
            device_id,
            tds,
            temperature,
            voltage
        })
        if (insertError) throw insertError

        // Update Heartbeat
        await supabase.rpc('update_heartbeat', {
            p_device_id: device_id,
            p_voltage: voltage,
            p_nonce: nonce
        }).catch(async () => {
            // Fallback manual update if RPC missing
            await supabase.from('devices').update({ last_nonce: nonce }).eq('id', device_id)

            let status = 'ONLINE'
            if (voltage < 11.5) status = 'DEGRADED'

            await supabase.from('device_heartbeat').upsert({
                device_id,
                last_seen: new Date().toISOString(),
                voltage,
                status
            })
        })

        return new Response(
            JSON.stringify({ success: true, nonce }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

async function logSecurityEvent(supabase: any, device_id: string, reason: string, payload: any) {
    await supabase.from('security_events').insert({
        device_id,
        reason,
        payload,
        ip: 'Unknown' // Functions don't easily get IP without config
    })
}
