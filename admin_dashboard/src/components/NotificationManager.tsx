import { useEffect, useCallback, useRef } from 'react'
import { db } from '../lib/firebase'
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { toast } from 'sonner'
import { isValidTDSReading } from '../lib/constants'
import { type NotificationAlert } from '../types'

export default function NotificationManager() {
    const { user } = useAuth()
    const { soundEnabled, permission, playSound } = useNotification()
    const processedAlerts = useRef<Set<string>>(new Set())
    // Fix #9: Record the exact time this component mounted.
    // Any alert created BEFORE this time is "stale" and should be silently seeded
    // into processedAlerts without showing a toast — prevents spam on every page load.
    const mountTime = useRef<number>(Date.now())
    const isFirstLoad = useRef<boolean>(true)

    const showDesktopNotification = useCallback((title: string, body: string, icon?: string) => {
        if (permission === 'granted' && document.hidden && typeof Notification !== 'undefined') {
            try {
                new Notification(title, {
                    body,
                    icon: icon || '/pwa-192x192.png',
                    tag: 'evaratds-alert'
                })
            } catch (err) {
                console.warn('Desktop notification failed:', err)
            }
        }
    }, [permission])

    useEffect(() => {
        if (!user) return
        
        // Listen for new alerts in Firestore
        const q = query(collection(db, 'alerts'), orderBy('created_at', 'desc'), limit(5))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Fix #9: On the very first snapshot callback, mark all existing alerts as
            // already-seen without showing any toasts. This prevents stale alerts from
            // spamming the user every time they open or refresh the app.
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                snapshot.docs.forEach((d) => processedAlerts.current.add(d.id));
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const alertId = change.doc.id
                    if (processedAlerts.current.has(alertId)) return

                    processedAlerts.current.add(alertId)
                    // Keep the set small
                    if (processedAlerts.current.size > 50) {
                        const firstEntry = processedAlerts.current.values().next().value
                        if (firstEntry) processedAlerts.current.delete(firstEntry)
                    }

                    const alert = change.doc.data() as NotificationAlert

                    // Fix #9: Only show toasts for alerts created after this component mounted
                    const createdAt = alert.created_at?.toDate ? alert.created_at.toDate().getTime() : Date.now()
                    const isNew = createdAt > mountTime.current

                    if (!isNew) return
                    
                    // ═══ FILTER: Skip showing alerts with invalid TDS values
                    if (alert.tds_value !== undefined && !isValidTDSReading(alert.tds_value)) {
                        console.warn(`🚫 Filtered invalid alert: TDS ${alert.tds_value} ppm (sensor noise)`)
                        return
                    }

                    const severity = (alert.severity || 'info').toLowerCase()
                    const title = (alert.type || 'System Alert').toUpperCase()
                    const message = alert.message || `New ${severity} alert received`
                    const deviceName = alert.device_name ? ` - ${alert.device_name}` : ''

                    // Show sonner toast
                    if (severity === 'critical') {
                        toast.error(title + deviceName, {
                            description: message,
                            duration: 8000,
                        })
                        if (soundEnabled) playSound('error')
                        showDesktopNotification(`🚨 ${title}`, message)
                    } else if (severity === 'high' || severity === 'warning') {
                        toast.warning(title + deviceName, {
                            description: message,
                            duration: 6000,
                        })
                        if (soundEnabled) playSound('warning')
                        showDesktopNotification(`⚠️ ${title}`, message)
                    } else if (severity === 'success') {
                        toast.success(title + deviceName, {
                            description: message,
                        })
                        if (soundEnabled) playSound('success')
                    } else {
                        toast.info(title + deviceName, {
                            description: message,
                        })
                    }
                }
            })
        })

        return () => unsubscribe()
    }, [user, soundEnabled, playSound, showDesktopNotification])

    return null // Component no longer renders its own UI, just handles side effects
}
