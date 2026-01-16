
// Access via standard Supabase Serve signature
// Follow Deno runtime specs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { api_key, tds, temperature, voltage } = await req.json()

        if (!api_key) {
            return new Response(JSON.stringify({ error: 'Missing api_key' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Initialize Supabase Client
        // process.env is not available in Deno Edge Functions, use Deno.env.get
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Validate API Key & Get Device ID
        const { data: device, error: deviceError } = await supabaseClient
            .from('devices')
            .select('id, name')
            .eq('api_key', api_key)
            .single()

        if (deviceError || !device) {
            return new Response(JSON.stringify({ error: 'Invalid API Key' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 2. Insert Sensor Data
        const { error: insertError } = await supabaseClient
            .from('sensor_data')
            .insert([
                {
                    device_id: device.id,
                    tds: tds,
                    temperature: temperature,
                    voltage: voltage,
                },
            ])

        if (insertError) throw insertError

        // 3. Update Device Status & Last Seen
        let status = 'online'
        if (tds > 800 || voltage < 3.0) status = 'critical'
        else if (voltage < 3.3) status = 'warning'

        await supabaseClient.from('devices').update({
            status,
            last_seen: new Date().toISOString()
        }).eq('id', device.id)

        // 4. Check for Alerts & Notify
        const alerts = []
        if (tds > 800) {
            alerts.push({
                device_id: device.id,
                message: `High TDS Detected: ${tds} ppm`,
                severity: 'critical',
                status: 'open'
            })

            // Trigger Push Notification for Critical Alerts
            try {
                // Determine users to notify (e.g. admins or device owner)
                // For MVP, we notify all admins or the device owner if we had that link easily accessible here
                // Let's assume we notify the "admins" or we query profiles.
                // For efficiency in this function, we'll just hit the push-notify endpoint
                // But edge-to-edge invocation is cleaner.

                // Fetch users to notify (Admins of the org)
                // We'll need the organization_id from device first if we want to be specific,
                // but for now let's notify all Super Admins and Admins of the device's org.

                // Simplified: Trigger push-notify function
                const PROJECT_REF = Deno.env.get('SUPABASE_URL')?.split('https://')[1].split('.')[0]
                const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/push-notify`

                // We need to fetch the users to notify. 
                // Let's fetch profiles in the same org as the device with role 'admin' or 'super_admin'
                /* This query logic is getting complex for inside ingest. 
                   Ideally, we insert the alert, and a database trigger calls the function, 
                   OR we call the function with the alert details and let it decide who to notify.
                */

                fetch(FUNCTION_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: 'Critical Water Quality Alert',
                        body: `Device ${device.name} reported High TDS: ${tds} ppm`,
                        // For now we need a specific user_id to target in the push-notify function we wrote
                        // We should probably update push-notify to accept 'topic' or 'role' or handle fan-out.
                        // But let's keep it simple: We won't call it here directly if getting user_ids is hard.
                        // Let's rely on the client to poll or the push-notify to handle "broadcast" if we change it.
                        // REVISION: Let's make push-notify handle the lookup if we pass "broadcast_role": "admin"
                    })
                })

            } catch (e) {
                console.error("Failed to trigger push", e)
            }
        }
        if (voltage < 3.0) {
            alerts.push({
                device_id: device.id,
                message: `Low Battery Voltage: ${voltage}V`,
                severity: 'warning',
                status: 'open'
            })
        }

        if (alerts.length > 0) {
            await supabaseClient.from('alerts').insert(alerts)
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Data ingested', alerts_triggered: alerts.length }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
