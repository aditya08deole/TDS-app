import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export default function NotificationManager() {
    const { user } = useAuth()
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')

    useEffect(() => {
        const checkSubscription = async () => {
            if (!user) return
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready
                const subscription = await registration.pushManager.getSubscription()
                setIsSubscribed(!!subscription)
            }
        }

        if ('Notification' in window) {
            setPermission(Notification.permission)
            checkSubscription()
        }
    }, [user])

    const subscribe = async () => {
        if (!user) return
        setLoading(true)
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            })

            const p256dh = subscription.getKey('p256dh')
            const auth = subscription.getKey('auth')

            if (!p256dh || !auth) throw new Error('Missing keys')

            await supabase.from('notification_subscriptions').insert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh) as unknown as number[])),
                auth: btoa(String.fromCharCode.apply(null, new Uint8Array(auth) as unknown as number[]))
            })

            setIsSubscribed(true)
            setPermission('granted')
        } catch (error) {
            console.error('Subscription error:', error)
            alert('Failed to subscribe: ' + error)
        } finally {
            setLoading(false)
        }
    }

    if (permission === 'denied' || !user) return null

    return (
        <div className="fixed bottom-4 left-4 z-50">
            {!isSubscribed ? (
                <button
                    onClick={subscribe}
                    disabled={loading}
                    className="p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg transition-transform hover:scale-110 flex items-center gap-2"
                    title="Enable Notifications"
                >
                    <Bell className="h-5 w-5" />
                    {loading && <span className="text-xs">...</span>}
                </button>
            ) : null}
        </div>
    )
}
