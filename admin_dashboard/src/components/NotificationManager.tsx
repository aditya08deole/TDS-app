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

    const showDesktopNotification = useCallback((title: string, body: string, icon?: string) => {
        if (permission === 'granted' && document.hidden) {
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

                    // Only process very recent alerts (within last 30 seconds)
                    const createdAt = alert.created_at?.toDate ? alert.created_at.toDate().getTime() : Date.now()
                    const isNew = (Date.now() - createdAt) < 30000
                    
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
