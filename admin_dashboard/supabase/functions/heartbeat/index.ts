import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

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

        const { device_id, voltage } = await req.json()

        if (!device_id) throw new Error('Missing device_id')

        // 1. Get Current Heartbeat to compare state
        const { data: current } = await supabase
            .from('device_heartbeat')
            .select('status')
            .eq('device_id', device_id)
            .single()

        // 2. Determine New State
        // Logic: 
        // - Voltage < 11.5 => DEGRADED
        // - Voltage >= 11.5 => ONLINE (unless manually maintenance)
        // - OFFLINE is handled by a separate cron or if this isn't called, but here we assume if it's calling, it's at least online-ish.

        let newState = 'ONLINE'
        if (voltage !== undefined && voltage < 11.5) {
            newState = 'DEGRADED'
        }

        if (current?.status === 'MAINTENANCE') {
            newState = 'MAINTENANCE'
        }

        const timestamp = new Date().toISOString()

        // 3. Upsert Heartbeat
        const { error: heartbeatError } = await supabase
            .from('device_heartbeat')
            .upsert({
                device_id,
                last_seen: timestamp,
                voltage: voltage || 0,
                status: newState
            })

        if (heartbeatError) throw heartbeatError

        // 4. Log History if Changed
        if (current && current.status !== newState) {
            await supabase.from('device_state_history').insert({
                device_id,
                old_state: current.status,
                new_state: newState
            })

            // Trigger Alert if degraded or offline (though offline is detected by absence)
            if (newState === 'DEGRADED' && current.status === 'ONLINE') {
                await supabase.from('alerts').insert({
                    device_id,
                    message: `Device voltage low (${voltage}V). Status degraded.`,
                    severity: 'warning',
                    status: 'open'
                })
            }
        }

        return new Response(
            JSON.stringify({ status: newState, timestamp }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
