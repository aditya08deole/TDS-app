import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { EnrichedDevice } from '../types'
import { getDeviceDisplayName } from '../lib/constants'
import { db } from '../lib/firebase'
import { collection, addDoc, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore'

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

    const setCriticalDevices = useCallback((devices: EnrichedDevice[]) => {
        setCriticalDevicesState(devices)
    }, [])

    // Background effect to persist alerts to Firestore
    useEffect(() => {
        const persistAlerts = async () => {
            for (const device of criticalDevices) {
                try {
                    // 1. Check if an "open" alert already exists for this device to prevent spam
                    const q = query(
                        collection(db, 'alerts'),
                        where('device_id', '==', device.id),
                        where('status', '==', 'open'),
                        limit(1)
                    )
                    const snap = await getDocs(q)
                    
                    if (snap.empty) {
                        // 2. Create new alert if none exists
                        await addDoc(collection(db, 'alerts'), {
                            device_id: device.id,
                            device_name: getDeviceDisplayName(device),
                            message: `Critical TDS level detected: ${device.latest_tds} ppm`,
                            severity: 'critical',
                            status: 'open',
                            created_at: new Date().toISOString(),
                            tds_value: device.latest_tds,
                            temp_value: device.latest_temperature,
                            timestamp: serverTimestamp()
                        })
                        console.log(`✅ Alert logged for ${device.id}`)
                    }
                } catch (error) {
                    console.error('Error persisting alert:', error)
                }
            }
        }

        if (criticalDevices.length > 0) {
            persistAlerts()
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
