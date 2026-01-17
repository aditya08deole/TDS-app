
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Device {
    id: string
    name: string
    thingspeak_channel_id: number
    thingspeak_read_key?: string
    last_seen_at?: string
    status: string
    metadata?: {
        tds_threshold?: number
        temp_threshold_min?: number
        temp_threshold_max?: number
        [key: string]: any
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // 1. Fetch all online devices with a ThingSpeak Channel
        const { data: devices, error: devError } = await supabaseClient
            .from('devices')
            .select('*')
            .eq('status', 'online')
            .not('thingspeak_channel_id', 'is', null)

        if (devError) throw devError
        if (!devices || devices.length === 0) {
            return new Response(JSON.stringify({ message: 'No online devices to check' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let alertsTriggered = 0
        const results = []

        // 2. Iterate each device and check ThingSpeak
        for (const device of devices as Device[]) {
            try {
                const url = `https://api.thingspeak.com/channels/${device.thingspeak_channel_id}/feeds/last.json?api_key=${device.thingspeak_read_key || ''}`
                const res = await fetch(url)
                if (!res.ok) continue

                const feed = await res.json()
                if (!feed) continue

                // Field1: TDS, Field2: Temp
                const tds = parseFloat(feed.field1)
                const temp = parseFloat(feed.field2)

                // Update last_reading_at in DB
                await supabaseClient.rpc('record_reading', {
                    p_device_id: device.id,
                    p_ts: feed.created_at || new Date().toISOString(),
                    p_tds: isNaN(tds) ? null : tds
                })
                const temp = parseFloat(feed.field2)

                // Thresholds (Default to reasonable values if not set in metadata)
                const tdsLimit = device.metadata?.tds_threshold || 500
                const tempMin = device.metadata?.temp_threshold_min || 10
                const tempMax = device.metadata?.temp_threshold_max || 45

                // Check TDS
                if (!isNaN(tds) && tds > tdsLimit) {
                    const { error: alertErr } = await supabaseClient.rpc('ensure_alert', {
                        p_device_id: device.id,
                        p_type: 'tds_high',
                        p_severity: 'warning',
                        p_message: `High TDS Detected: ${tds} ppm (Limit: ${tdsLimit})`,
                        p_value: tds,
                        p_threshold: { limit: tdsLimit, type: 'max' }
                    })
                    if (!alertErr) alertsTriggered++
                    results.push({ device: device.name, type: 'tds_high', value: tds })
                }

                // Check Temp
                if (!isNaN(temp) && (temp > tempMax || temp < tempMin)) {
                    const { error: alertErr } = await supabaseClient.rpc('ensure_alert', {
                        p_device_id: device.id,
                        p_type: 'temp_out_of_range',
                        p_severity: 'warning',
                        p_message: `Temperature Out of Range: ${temp}°C (Range: ${tempMin}-${tempMax})`,
                        p_value: temp,
                        p_threshold: { min: tempMin, max: tempMax }
                    })
                    if (!alertErr) alertsTriggered++
                    results.push({ device: device.name, type: 'temp_out_of_range', value: temp })
                }

            } catch (err) {
                console.error(`Error checking device ${device.name}:`, err)
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Alert check completed',
                devices_checked: devices.length,
                alerts_triggered: alertsTriggered,
                details: results
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
