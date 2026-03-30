import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '../lib/firebase'
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore'
import { Bell, BellOff, Volume2, VolumeX, X, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

interface Toast {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: Date
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

// Sound effects using Web Audio API
const createAlertSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

        return {
            playWarning: () => {
                const oscillator = audioContext.createOscillator()
                const gainNode = audioContext.createGain()

                oscillator.connect(gainNode)
                gainNode.connect(audioContext.destination)

                oscillator.frequency.value = 800
                oscillator.type = 'sine'
                gainNode.gain.value = 0.3

                oscillator.start()
                oscillator.stop(audioContext.currentTime + 0.2)
            },
            playCritical: () => {
                const oscillator = audioContext.createOscillator()
                const gainNode = audioContext.createGain()

                oscillator.connect(gainNode)
                gainNode.connect(audioContext.destination)

                oscillator.frequency.value = 1000
                oscillator.type = 'square'
                gainNode.gain.value = 0.4

                const now = audioContext.currentTime
                oscillator.start(now)
                oscillator.frequency.setValueAtTime(1000, now)
                oscillator.frequency.setValueAtTime(800, now + 0.1)
                oscillator.frequency.setValueAtTime(1000, now + 0.2)
                oscillator.stop(now + 0.3)
            },
            playSuccess: () => {
                const oscillator = audioContext.createOscillator()
                const gainNode = audioContext.createGain()

                oscillator.connect(gainNode)
                gainNode.connect(audioContext.destination)

                oscillator.frequency.value = 600
                oscillator.type = 'sine'
                gainNode.gain.value = 0.2

                const now = audioContext.currentTime
                oscillator.frequency.setValueAtTime(600, now)
                oscillator.frequency.linearRampToValueAtTime(800, now + 0.1)
                oscillator.start(now)
                oscillator.stop(now + 0.15)
            }
        }
    } catch {
        return null
    }
}

export default function NotificationManager() {
    const { user } = useAuth()
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [soundEnabled, setSoundEnabled] = useState(() => {
        return localStorage.getItem('alert-sound') !== 'false'
    })
    const [toasts, setToasts] = useState<Toast[]>([])
    const soundRef = useRef(createAlertSound())

    // Toggle sound
    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('alert-sound', String(newValue))
            return newValue
        })
    }, [])

    // Show toast notification
    const showToast = useCallback((toast: Omit<Toast, 'id' | 'timestamp'>) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newToast: Toast = { ...toast, id, timestamp: new Date() }

        setToasts(prev => [...prev, newToast])

        // Play sound based on type
        if (soundEnabled && soundRef.current) {
            if (toast.type === 'error') {
                soundRef.current.playCritical()
            } else if (toast.type === 'warning') {
                soundRef.current.playWarning()
            } else if (toast.type === 'success') {
                soundRef.current.playSuccess()
            }
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }, [soundEnabled])

    // Remove toast
    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    // Show desktop notification
    const showDesktopNotification = useCallback((title: string, body: string, icon?: string) => {
        if (permission === 'granted' && document.hidden) {
            new Notification(title, {
                body,
                icon: icon || '/pwa-192x192.png',
                tag: 'evaratds-alert'
            })
        }
    }, [permission])

    // Subscribe to real-time alerts via Firestore
    useEffect(() => {
        if (!user) return

        const q = query(
            collection(db, 'alerts'),
            orderBy('created_at', 'desc'),
            limit(1)
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const alert = change.doc.data() as { severity?: string; message?: string; type?: string; created_at?: any }
                    
                    // Simple debounce/check for newness (Firestore sends initial snapshot)
                    const isNew = alert.created_at?.toDate ? (new Date().getTime() - alert.created_at.toDate().getTime()) < 5000 : true;
                    if (!isNew) return;

                    const severity = alert.severity?.toLowerCase()
                    const type = severity === 'critical' ? 'error' :
                        severity === 'high' ? 'warning' :
                            severity === 'medium' ? 'warning' : 'info'

                    showToast({
                        type,
                        title: `${alert.type || 'Alert'}`.toUpperCase(),
                        message: alert.message || 'New alert received'
                    })

                    // Desktop notification for critical/high severity
                    if (severity === 'critical' || severity === 'high') {
                        showDesktopNotification(
                            `⚠️ ${alert.type || 'Critical Alert'}`,
                            alert.message || 'Immediate attention required'
                        )
                    }
                }
            })
        })

        return () => unsubscribe()
    }, [user, showToast, showDesktopNotification])

    // Check subscription status
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

    // Request notification permission
    const requestPermission = async () => {
        if ('Notification' in window) {
            const result = await Notification.requestPermission()
            setPermission(result)
            if (result === 'granted') {
                showDesktopNotification('Notifications Enabled', 'You will now receive alerts')
            }
        }
    }

    // Subscribe to push notifications
    const subscribe = async () => {
        if (!user || !VAPID_PUBLIC_KEY) {
            // If no VAPID key, just request permission for basic notifications
            requestPermission()
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
            // Fallback to basic notifications
            requestPermission()
        } finally {
            setLoading(false)
        }
    }

    const getToastStyles = (type: Toast['type']) => {
        switch (type) {
            case 'error':
                return 'border-red-500/50 bg-red-500/10'
            case 'warning':
                return 'border-orange-500/50 bg-orange-500/10'
            case 'success':
                return 'border-emerald-500/50 bg-emerald-500/10'
            default:
                return 'border-cyan-500/50 bg-cyan-500/10'
        }
    }

    const getToastIcon = (type: Toast['type']) => {
        switch (type) {
            case 'error':
                return <AlertTriangle className="h-5 w-5 text-red-400" />
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-orange-400" />
            case 'success':
                return <CheckCircle className="h-5 w-5 text-emerald-400" />
            default:
                return <Bell className="h-5 w-5 text-cyan-400" />
        }
    }

    if (!user) return null

    return (
        <>
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm animate-slide-in-right ${getToastStyles(toast.type)}`}
                    >
                        {getToastIcon(toast.type)}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{toast.title}</p>
                            <p className="text-xs text-slate-400 truncate">{toast.message}</p>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-slate-500 hover:text-white p-1"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Control Buttons */}
            <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
                {/* Sound Toggle */}
                <button
                    onClick={toggleSound}
                    className={`p-3 rounded-full shadow-lg transition-all ${soundEnabled
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                    title={soundEnabled ? 'Mute Alerts' : 'Unmute Alerts'}
                >
                    {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>

                {/* Notification Subscribe */}
                {permission !== 'denied' && !isSubscribed && (
                    <button
                        onClick={subscribe}
                        disabled={loading}
                        className="p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg transition-transform hover:scale-110 flex items-center gap-2"
                        title="Enable Notifications"
                    >
                        <Bell className="h-5 w-5" />
                        {loading && <span className="text-xs">...</span>}
                    </button>
                )}

                {/* Show notification permission denied */}
                {permission === 'denied' && (
                    <div className="p-3 bg-slate-800 text-slate-500 rounded-full" title="Notifications Blocked">
                        <BellOff className="h-5 w-5" />
                    </div>
                )}
            </div>
        </>
    )
}
