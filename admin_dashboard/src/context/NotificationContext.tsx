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
    soundProfile: string
    setSoundProfile: (profile: string) => void
    playSound: (type?: 'success' | 'warning' | 'error') => void
    testSound: () => void
    testNotification: () => void
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
    const [soundProfile, setSoundProfileState] = useState(() => {
        return localStorage.getItem('alert-sound-profile') || 'classic'
    })
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')

    const setSoundProfile = useCallback((profile: string) => {
        setSoundProfileState(profile)
        localStorage.setItem('alert-sound-profile', profile)
    }, [])

    const playSound = useCallback((type: 'success' | 'warning' | 'error' = 'success') => {
        if (!soundEnabled) return

        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            const now = audioContext.currentTime

            if (soundProfile === 'modern') {
                // Modern Chime - Soft sine waves
                oscillator.type = 'sine'
                if (type === 'error') {
                    oscillator.frequency.setValueAtTime(440, now)
                    oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.5)
                    gainNode.gain.setValueAtTime(0.3, now)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
                    oscillator.start(now)
                    oscillator.stop(now + 0.5)
                } else {
                    oscillator.frequency.setValueAtTime(880, now)
                    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.3)
                    gainNode.gain.setValueAtTime(0.2, now)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
                    oscillator.start(now)
                    oscillator.stop(now + 0.3)
                }
            } else if (soundProfile === 'digital') {
                // Digital Pulse - Square waves
                oscillator.type = 'square'
                if (type === 'error') {
                    oscillator.frequency.setValueAtTime(150, now)
                    oscillator.frequency.setValueAtTime(100, now + 0.1)
                    gainNode.gain.value = 0.2
                    oscillator.start(now)
                    oscillator.stop(now + 0.2)
                } else {
                    oscillator.frequency.setValueAtTime(1200, now)
                    gainNode.gain.setValueAtTime(0.1, now)
                    gainNode.gain.setValueAtTime(0, now + 0.05)
                    oscillator.start(now)
                    oscillator.stop(now + 0.05)
                }
            } else if (soundProfile === 'sonar') {
                // Sonar - High pitch ping
                oscillator.type = 'sine'
                oscillator.frequency.setValueAtTime(2000, now)
                gainNode.gain.setValueAtTime(0.3, now)
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1)
                oscillator.start(now)
                oscillator.stop(now + 1)
            } else {
                // Evara Classic (Default)
                if (type === 'error') {
                    oscillator.type = 'square'
                    oscillator.frequency.setValueAtTime(1000, now)
                    oscillator.frequency.setValueAtTime(800, now + 0.1)
                    oscillator.frequency.setValueAtTime(1000, now + 0.2)
                    gainNode.gain.value = 0.4
                    oscillator.start(now)
                    oscillator.stop(now + 0.3)
                } else if (type === 'warning') {
                    oscillator.type = 'sine'
                    oscillator.frequency.value = 800
                    gainNode.gain.value = 0.3
                    oscillator.start(now)
                    oscillator.stop(now + 0.2)
                } else {
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(600, now)
                    oscillator.frequency.linearRampToValueAtTime(800, now + 0.1)
                    gainNode.gain.value = 0.2
                    oscillator.start(now)
                    oscillator.stop(now + 0.15)
                }
            }
        } catch (err) {
            console.error('Failed to play sound:', err)
        }
    }, [soundEnabled, soundProfile])

    const testSound = useCallback(() => {
        playSound('success')
    }, [playSound])

    const testNotification = useCallback(() => {
        if (!('Notification' in window)) {
            alert('This browser does not support desktop notifications')
            return
        }

        if (Notification.permission === 'granted') {
            new Notification('🔔 EvaraTDS Test Notification', {
                body: 'Your system notification system is working correctly!',
                icon: '/pwa-192x192.png'
            })
        } else {
            alert(`Notification permission is currently: ${Notification.permission}. Please enable it in browser settings.`)
        }
    }, [])

    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('alert-sound', String(newValue))
            // Play a small confirmation sound if enabling
            if (newValue) {
                // We can't use playSound yet because state hasn't updated, 
                // but we can manually trigger a small beep or just skip it.
            }
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
            subscribe,
            soundProfile,
            setSoundProfile,
            playSound,
            testSound,
            testNotification
        }}>
            {children}
        </NotificationContext.Provider>
    )
}
