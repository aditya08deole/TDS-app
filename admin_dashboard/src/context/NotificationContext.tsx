import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from './AuthContext'

const VAPID_PUBLIC_KEY = (import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string) || "";

interface NotificationContextType {
    soundEnabled: boolean
    toggleSound: () => void
    isSubscribed: boolean
    permission: NotificationPermission
    loading: boolean
    subscribe: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotification = () => {
    const context = useContext(NotificationContext)
    if (!context) throw new Error('useNotification must be used within a NotificationProvider')
    return context
}

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

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth()
    const [soundEnabled, setSoundEnabled] = useState(() => {
        return localStorage.getItem('alert-sound') !== 'false'
    })
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')

    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('alert-sound', String(newValue))
            return newValue
        })
    }, [])

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

        if (!('Notification' in window)) {
            console.error('This browser does not support desktop notification')
            return
        }

        if (Notification.permission === 'default') {
            const result = await Notification.requestPermission()
            setPermission(result)
            if (result !== 'granted') return
        }

        if (!VAPID_PUBLIC_KEY) {
            console.warn('Missing VAPID key, only basic notifications enabled')
            return
        }

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

            await addDoc(collection(db, 'notification_subscriptions'), {
                user_id: user.uid,
                endpoint: subscription.endpoint,
                p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh) as unknown as number[])),
                auth: btoa(String.fromCharCode.apply(null, new Uint8Array(auth) as unknown as number[])),
                created_at: serverTimestamp()
            })

            setIsSubscribed(true)
            setPermission('granted')
        } catch (error) {
            console.error('Subscription error:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <NotificationContext.Provider value={{
            soundEnabled,
            toggleSound,
            isSubscribed,
            permission,
            loading,
            subscribe
        }}>
            {children}
        </NotificationContext.Provider>
    )
}
