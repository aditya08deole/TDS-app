import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { db, messaging } from '../lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { onMessage, getToken } from 'firebase/messaging'
import { toast } from 'sonner'
import { storage } from '../lib/storage'
import { initPushNotifications, getFCMToken } from '../lib/pushNotifications'
import { Capacitor } from '@capacitor/core'

const VAPID_PUBLIC_KEY = (import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string) || "";
const isNative = Capacitor.isNativePlatform();

interface NotificationContextType {
    soundEnabled: boolean
    toggleSound: () => void
    isSubscribed: boolean
    permission: string
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

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth()
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [soundProfile, setSoundProfileState] = useState('classic')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [permission, setPermission] = useState('default')

    // Load persistent state from storage
    useEffect(() => {
        const loadSettings = async () => {
            const savedSound = await storage.get<boolean>('alert-sound');
            if (savedSound !== null) setSoundEnabled(savedSound);

            const savedProfile = await storage.get<string>('alert-sound-profile');
            if (savedProfile) setSoundProfileState(savedProfile);
            
            if (isNative) {
                // Check native token to see if we're subscribed
                const token = await getFCMToken();
                if (token) setIsSubscribed(true);
                setPermission('granted'); // Usually handled by initPushNotifications
            } else if (typeof Notification !== 'undefined') {
                setPermission(Notification.permission);
            }
        };
        loadSettings();
    }, []);

    const setSoundProfile = useCallback(async (profile: string) => {
        setSoundProfileState(profile)
        await storage.set('alert-sound-profile', profile)
    }, [])

    const playSound = useCallback((type: 'success' | 'warning' | 'error' = 'success') => {
        if (!soundEnabled) return
        try {
            interface WindowWithAudio extends Window {
                webkitAudioContext?: typeof AudioContext;
            }
            const AudioContextClass = (window.AudioContext || (window as WindowWithAudio).webkitAudioContext);
            if (!AudioContextClass) return;
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            oscillator.connect(gainNode); gainNode.connect(audioContext.destination)
            const now = audioContext.currentTime

            if (soundProfile === 'modern') {
                oscillator.type = 'sine'
                if (type === 'error') {
                    oscillator.frequency.setValueAtTime(440, now); oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.5)
                    gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
                    oscillator.start(now); oscillator.stop(now + 0.5)
                } else {
                    oscillator.frequency.setValueAtTime(880, now); oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.3)
                    gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
                    oscillator.start(now); oscillator.stop(now + 0.3)
                }
            } else if (soundProfile === 'digital') {
                oscillator.type = 'square'
                if (type === 'error') {
                    oscillator.frequency.setValueAtTime(150, now); oscillator.frequency.setValueAtTime(100, now + 0.1)
                    gainNode.gain.value = 0.2
                    oscillator.start(now); oscillator.stop(now + 0.2)
                } else {
                    oscillator.frequency.setValueAtTime(1200, now); gainNode.gain.setValueAtTime(0.1, now)
                    gainNode.gain.setValueAtTime(0, now + 0.05)
                    oscillator.start(now); oscillator.stop(now + 0.05)
                }
            } else if (soundProfile === 'sonar') {
                oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(2000, now)
                gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1)
                oscillator.start(now); oscillator.stop(now + 1)
            } else {
                if (type === 'error') {
                    oscillator.type = 'square'; oscillator.frequency.setValueAtTime(1000, now)
                    oscillator.frequency.setValueAtTime(800, now + 0.1); oscillator.frequency.setValueAtTime(1000, now + 0.2)
                    gainNode.gain.value = 0.4; oscillator.start(now); oscillator.stop(now + 0.3)
                } else if (type === 'warning') {
                    oscillator.type = 'sine'; oscillator.frequency.value = 800; gainNode.gain.value = 0.3
                    oscillator.start(now); oscillator.stop(now + 0.2)
                } else {
                    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(600, now)
                    oscillator.frequency.linearRampToValueAtTime(800, now + 0.1); gainNode.gain.value = 0.2
                    oscillator.start(now); oscillator.stop(now + 0.15)
                }
            }
        } catch (err) { console.error('Failed to play sound:', err) }
    }, [soundEnabled, soundProfile])

    const testSound = useCallback(() => {
        playSound('success')
        toast.success('Sound Diagnostic', { description: `Profile "${soundProfile}" is playing correctly.` })
    }, [playSound, soundProfile])

    // Initialize native push if applicable
    useEffect(() => {
        if (isNative) {
            initPushNotifications();
        }
    }, []);

    // Handle incoming messages
    useEffect(() => {
        if (!messaging || isNative) return // Native has its own listeners in pushNotifications.ts
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('🔔 Foreground Message:', payload)
            toast.error(payload.notification?.title || 'System Alert', {
                description: payload.notification?.body,
                duration: 5000,
                action: {
                    label: 'View',
                    onClick: () => {
                        window.focus()
                        if (payload.data?.url) window.location.href = payload.data.url
                    }
                }
            })
            playSound(payload.data?.severity === 'critical' ? 'error' : 'warning')
        })
        return () => unsubscribe()
    }, [playSound])

    const testNotification = useCallback(() => {
        if (isNative) {
            toast.info('Test Alert', { description: 'Native push test is handled via Firebase Console.' })
            return
        }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🔔 EvaraTDS Test Notification', {
                body: 'Your notification system is working correctly!',
                icon: '/pwa-192x192.png'
            })
        } else {
            toast('Notifications not granted', { description: 'Please subscribe/enable from settings.' })
        }
    }, [])

    const toggleSound = useCallback(async () => {
        const newValue = !soundEnabled
        setSoundEnabled(newValue)
        await storage.set('alert-sound', newValue)
    }, [soundEnabled])

    const subscribe = async () => {
        if (!user) return
        
        setLoading(true)
        try {
            let token: string | null = null;

            if (isNative) {
                // For native, initPushNotifications handles the initial registration
                // We just need to make sure we have the token and save it to Firestore
                token = await getFCMToken();
                if (!token) {
                    await initPushNotifications();
                    token = await getFCMToken();
                }
            } else {
                if (!messaging) return;
                if (typeof Notification === 'undefined') return

                if (Notification.permission === 'default') {
                    const result = await Notification.requestPermission()
                    setPermission(result)
                    if (result !== 'granted') return
                }

                if (!VAPID_PUBLIC_KEY) {
                    toast.error('VAPID Key Missing', { description: 'Contact admin to configure push keys.' })
                    return
                }

                token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY })
            }

            if (!token) {
                throw new Error('No FCM registration token available.')
            }

            const tokenHash = btoa(token).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24)
            const docId = `${user.uid}_${tokenHash}`
            await setDoc(doc(db, 'notification_subscriptions', docId), {
                user_id: user.uid,
                token,
                platform: isNative ? 'android_native' : 'web_pwa',
                userAgent: navigator.userAgent,
                updated_at: serverTimestamp(),
                created_at: serverTimestamp(),
            }, { merge: true })

            setIsSubscribed(true)
            toast.success('Real-time alerts enabled!', {
                description: 'You will now receive push notifications for critical TDS events.'
            })
        } catch (error) {
            console.error('Subscription error:', error)
            toast.error('Subscription failed', { description: 'Please check your connectivity and permissions.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <NotificationContext.Provider value={{
            soundEnabled, toggleSound, isSubscribed, permission, loading,
            subscribe, soundProfile, setSoundProfile, playSound, testSound, testNotification
        }}>
            {children}
        </NotificationContext.Provider>
    )
}
