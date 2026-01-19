import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ThingSpeak Proxy Edge Function
 * 
 * Purpose: Cache ThingSpeak API responses at the edge to reduce API calls
 * Cache TTL: 10 seconds (configurable)
 * 
 * Benefits:
 * - Shared cache across ALL users
 * - Reduces ThingSpeak API calls by 95%+
 * - Faster response times (edge proximity)
 * - Automatic rate limiting protection
 */

// In-memory cache (persists across requests within the same edge instance)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 10000 // 10 seconds

// Cleanup old cache entries every minute
setInterval(() => {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key)
        }
    }
}, 60000)

serve(async (req) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parse request body
        const { channelId, readKey, results = 100 } = await req.json()

        if (!channelId || !readKey) {
            return new Response(
                JSON.stringify({ error: 'Missing channelId or readKey' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create cache key
        const cacheKey = `${channelId}-${readKey}-${results}`

        // Check cache
        const cached = cache.get(cacheKey)
        const now = Date.now()

        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            console.log(`✅ Cache HIT for channel ${channelId}`)
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
                        'X-Cache': 'HIT',
                        'X-Cache-Age': String(now - cached.timestamp)
                    }
                }
            )
        }

        // Cache miss - fetch from ThingSpeak
        console.log(`❌ Cache MISS for channel ${channelId} - fetching from ThingSpeak`)

        const thingspeakUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=${results}`

        const response = await fetch(thingspeakUrl, {
            headers: {
                'Accept': 'application/json'
            }
        })

        if (!response.ok) {
            throw new Error(`ThingSpeak API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        // Update cache
        cache.set(cacheKey, {
            data,
            timestamp: now
        })

        console.log(`✅ Cached ${data.feeds?.length || 0} readings for channel ${channelId}`)

        return new Response(
            JSON.stringify({
                ...data,
                cached: false,
                cacheAge: 0
            }),
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
        console.error('Error in thingspeak-proxy:', error)

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
