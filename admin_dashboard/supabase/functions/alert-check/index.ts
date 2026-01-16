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

        // 1. Fetch all OPEN alerts
        const { data: alerts, error: fetchError } = await supabase
            .from('alerts')
            .select('*')
            .neq('status', 'resolved')
            .is('acknowledged_at', null) // Only unacknowledged

        if (fetchError) throw fetchError

        // 2. Fetch Escalation Rules
        const { data: rules } = await supabase.from('escalation_rules').select('*')
        const ruleMap = new Map(rules?.map(r => [r.severity, r]))

        const updates = []
        const escalatedIds = []

        const now = new Date()

        for (const alert of alerts || []) {
            const rule = ruleMap.get(alert.severity)
            if (!rule) continue

            const created = new Date(alert.created_at)
            const diffMinutes = (now.getTime() - created.getTime()) / 60000

            // If time exceeded and not yet escalated deeply
            // (Simplified logic: if level is 0 and time > threshold, bump to 1)
            if (diffMinutes > rule.minutes_to_escalate && alert.escalation_level < 1) {
                updates.push({
                    id: alert.id,
                    escalation_level: 1,
                    // In a real app, we might change severity or assign to next_role
                })
                escalatedIds.push(alert.id)

                // Notify Next Role (Mock)
                console.log(`Escalating Alert ${alert.id} to ${rule.next_role}`)
            }
        }

        // 3. Apply Updates
        if (updates.length > 0) {
            const { error: updateError } = await supabase
                .from('alerts')
                .upsert(updates)

            if (updateError) throw updateError
        }

        return new Response(
            JSON.stringify({ escalated: escalatedIds.length, ids: escalatedIds }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
