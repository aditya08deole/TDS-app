import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from "npm:web-push"

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

        const { user_id, title, body, broadcast_role } = await req.json()

        if ((!user_id && !broadcast_role) || !title || !body) {
            throw new Error('Missing require fields')
        }

        // Initialize web-push with VAPID details
        webpush.setVapidDetails(
            'mailto:admin@evaratds.com',
            Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
            Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
        )

        let targetUserIds = []
        if (user_id) targetUserIds = [user_id]
        if (broadcast_role) {
            // Fetch all users with this role
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', broadcast_role)

            if (profiles) targetUserIds = profiles.map((p: { id: string }) => p.id)
        }

        // Fetch subscriptions for the users
        const { data: subscriptions, error } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .in('user_id', targetUserIds)

        if (error) throw error

        const results = []

        // Send notifications
        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: atob(sub.p256dh).split('').map(c => c.charCodeAt(0)),
                    auth: atob(sub.auth).split('').map(c => c.charCodeAt(0))
                }
            }

            // Fix for keys: web-push expects strings for keys if using the node library strictly, 
            // but let's try passing the object structure standard for PushSubscription.
            // Actually web-push npm expects { endpoint, keys: { p256dh, auth } } where p256dh and auth are strings.
            // In our DB we stored them as base64 strings (via btoa).
            // So we just need to decode them if we stored them encoded?
            // Wait, in NotificationManager.tsx:
            // p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh)))
            // So in DB they are Base64 strings.
            // web-push sendNotification keys expect strings.

            const pushSubStandard = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh, // web-push handles base64
                    auth: sub.auth
                }
            }

            try {
                await webpush.sendNotification(pushSubStandard, JSON.stringify({ title, body }))
                results.push({ id: sub.id, status: 'sent' })
            } catch (err) {
                console.error('Push error for sub', sub.id, err)

                // If 410 Gone, delete subscription
                if (err.statusCode === 410) {
                    await supabase.from('notification_subscriptions').delete().eq('id', sub.id)
                    results.push({ id: sub.id, status: 'deleted (410)' })
                } else {
                    results.push({ id: sub.id, status: 'failed', error: err.message })
                }
            }
        }

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
