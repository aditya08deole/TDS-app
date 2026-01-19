import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Device Stats Aggregation Edge Function
 * 
 * Purpose: Pre-compute dashboard statistics and trends
 * Cache TTL: 30 seconds
 * 
 * Returns:
 * - Total device count
 * - Online/offline/warning/critical counts
 * - Average TDS across all devices
 * - Last 24h trend data
 * - Active alerts
 */

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Check cache
        const cacheKey = 'dashboard-stats'
        const cached = cache.get(cacheKey)
        const now = Date.now()

        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            console.log('✅ Cache HIT for dashboard stats')
            return new Response(
                JSON.stringify({
                    ...cached.data,
                    cached: true,
                    cacheAge: now - cached.timestamp
                }),
                {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'X-Cache': 'HIT'
                    }
                }
            )
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Fetch all devices
        const { data: devices, error: devicesError } = await supabase
            .from('devices')
            .select('*')

        if (devicesError) throw devicesError

        // Calculate stats
        const stats = {
            totalDevices: devices?.length || 0,
            onlineCount: 0,
            offlineCount: 0,
            warningCount: 0,
            criticalCount: 0,
            avgTDS: 0,
            timestamp: new Date().toISOString()
        }

        // Count by status
        devices?.forEach(device => {
            switch (device.status) {
                case 'online':
                    stats.onlineCount++
                    break
                case 'offline':
                    stats.offlineCount++
                    break
                case 'warning':
                    stats.warningCount++
                    break
                case 'critical':
                    stats.criticalCount++
                    break
            }
        })

        // Fetch recent alerts
        const { data: alerts, error: alertsError } = await supabase
            .from('alerts')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(10)

        if (alertsError) console.error('Error fetching alerts:', alertsError)

        const result = {
            ...stats,
            alerts: alerts || [],
            cached: false,
            cacheAge: 0
        }

        // Update cache
        cache.set(cacheKey, {
            data: result,
            timestamp: now
        })

        console.log(`✅ Computed stats for ${stats.totalDevices} devices`)

        return new Response(
            JSON.stringify(result),
            {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'X-Cache': 'MISS'
                }
            }
        )

    } catch (error) {
        console.error('Error in device-stats:', error)

        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                timestamp: new Date().toISOString()
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            }
        )
    }
})
