import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { EnrichedDevice } from '../types'
import { getDeviceDisplayName } from '../lib/constants'
import { db } from '../lib/firebase'
import { collection, addDoc, query, where, getDocs, updateDoc, limit, serverTimestamp } from 'firebase/firestore'

interface AlertContextValue {
    criticalDevices: EnrichedDevice[]
    setCriticalDevices: (devices: EnrichedDevice[]) => void
    alertCount: number
    clearAlerts: () => void
    getAlertMessages: () => { title: string; device: string; tds: number | undefined }[]
}

const AlertContext = createContext<AlertContextValue>({
    criticalDevices: [],
    setCriticalDevices: () => {},
    alertCount: 0,
    clearAlerts: () => {},
    getAlertMessages: () => [],
})

export function AlertProvider({ children }: { children: ReactNode }) {
    const [criticalDevices, setCriticalDevicesState] = useState<EnrichedDevice[]>([])
    // Track previous critical device IDs to detect recovery events
    const prevCriticalIds = useRef<Set<string>>(new Set())
    // Debounce timer ref
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const setCriticalDevices = useCallback((devices: EnrichedDevice[]) => {
        setCriticalDevicesState(devices)
    }, [])

    // Persist new critical alerts and auto-resolve recovered devices
    useEffect(() => {
        const currentCriticalIds = new Set(criticalDevices.map(d => d.id))

        // Find devices that recovered (were critical, now safe)
        const recoveredIds = [...prevCriticalIds.current].filter(id => !currentCriticalIds.has(id))

        // Auto-resolve alerts for recovered devices (frontend-side backup)
        const autoResolveRecovered = async () => {
            for (const deviceId of recoveredIds) {
                try {
                    const q = query(
                        collection(db, 'alerts'),
                        where('device_id', '==', deviceId),
                        where('status', '==', 'open'),
                        limit(10)
                    )
                    const snap = await getDocs(q)
                    for (const alertDoc of snap.docs) {
                        await updateDoc(alertDoc.ref, {
                            status: 'resolved',
                            resolved_at: new Date().toISOString(),
                            resolved_by: 'frontend_auto_recovery'
                        })
                    }
                    if (!snap.empty) {
                        console.log(`✅ Frontend auto-resolved ${snap.size} alert(s) for recovered device: ${deviceId}`)
                    }
                } catch (err) {
                    console.error('Error auto-resolving alert:', err)
                }
            }
        }

        // Debounced persist to prevent alert spam
        // NOTE: Server-side deduplication is the primary guard now.
        // This frontend persist is a backup for when checkSensorData Cloud Function
        // isn't triggered (e.g., data comes via ThingSpeak client-side polling only).
        const persistNewAlerts = async () => {
            for (const device of criticalDevices) {
                try {
                    // DEDUPLICATION: Check if an open alert already exists
                    const q = query(
                        collection(db, 'alerts'),
                        where('device_id', '==', device.id),
                        where('status', '==', 'open'),
                        limit(1)
                    )
                    const snap = await getDocs(q)
                    if (snap.empty) {
                        // Build alert message with context for potential data issues
                        const tdsValue = device.latest_tds ?? 0
                        const tempValue = device.latest_temperature ?? 0
                        const isUnusuallyHigh = tdsValue > 300
                        
                        let message = `Critical TDS level detected: ${tdsValue} ppm`
                        if (isUnusuallyHigh) {
                            message += ` (Check sensor - unusually high reading, temp: ${tempValue}°C)`
                        }
                        
                        const isDev = import.meta.env.DEV
                        const ttlMinutes = isDev ? 24 * 60 : 10
                        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
                        await addDoc(collection(db, 'alerts'), {
                            device_id: device.id,
                            device_name: getDeviceDisplayName(device),
                            message: message,
                            severity: 'critical',
                            status: 'open',
                            created_at: new Date().toISOString(),
                            expiresAt: expiresAt,
                            tds_value: device.latest_tds,
                            temp_value: device.latest_temperature,
                            timestamp: serverTimestamp()
                        })
                        console.log(`🚨 Alert logged for ${device.id}: ${message}`)
                        
                        // Perfect Fit: Trigger haptic feedback for critical alerts
                        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                            navigator.vibrate([200, 100, 200]);
                        }
                    } else {
                        // Update existing alert with latest TDS value (keeps it fresh)
                        const existingDoc = snap.docs[0]
                        const tdsValue = device.latest_tds ?? 0
                        const tempValue = device.latest_temperature ?? 0
                        const isUnusuallyHigh = tdsValue > 300
                        
                        let message = `Critical TDS level detected: ${tdsValue} ppm`
                        if (isUnusuallyHigh) {
                            message += ` (Check sensor - unusually high reading, temp: ${tempValue}°C)`
                        }
                        
                        await updateDoc(existingDoc.ref, {
                            message: message,
                            tds_value: device.latest_tds,
                            temp_value: device.latest_temperature,
                            updated_at: new Date().toISOString()
                        })
                    }
                } catch (error) {
                    console.error('Error persisting alert:', error)
                }
            }
        }

        // Run auto-resolve immediately for recovered devices
        if (recoveredIds.length > 0) {
            autoResolveRecovered()
        }

        // Debounce the persist to prevent hammering Firestore
        if (criticalDevices.length > 0) {
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
            debounceTimer.current = setTimeout(persistNewAlerts, 5000) // 5s debounce
        }

        // Update the previous IDs tracker
        prevCriticalIds.current = currentCriticalIds

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
        }
    }, [criticalDevices])

    const clearAlerts = useCallback(() => {
        setCriticalDevicesState([])
    }, [])

    const getAlertMessages = useCallback(() => {
        return criticalDevices.map(d => ({
            title: 'Critical TDS Alert',
            device: getDeviceDisplayName(d),
            tds: d.latest_tds
        }))
    }, [criticalDevices])

    return (
        <AlertContext.Provider value={{
            criticalDevices,
            setCriticalDevices,
            alertCount: criticalDevices.length,
            clearAlerts,
            getAlertMessages
        }}>
            {children}
        </AlertContext.Provider>
    )
}

export function useAlerts() {
    return useContext(AlertContext)
}
