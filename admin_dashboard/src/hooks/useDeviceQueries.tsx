import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    onSnapshot,
    orderBy,
    limit as firestoreLimit
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Device, DeviceEvent } from '../types'
import { queryKeys } from '../lib/queryClient'
import { cacheDevices, getCachedDevices } from '../lib/cache'
import { 
    fetchDevices as fetchDevicesFromApi,
    createDevice as createDeviceApi,
    deleteDevice as deleteDeviceApi,
    updateDevice as updateDeviceApi
} from '../lib/api'

// Typed interface for raw Firestore sensor data records
export interface SensorDataRecord {
    id: string
    [key: string]: unknown
}

/**
 * Fetch all devices from backend API
 */
async function fetchDevices(): Promise<Device[]> {
    try {
        console.log('📡 Fetching devices from API...')
        const data = await fetchDevicesFromApi()

        // Cache the result
        if (data) {
            await cacheDevices(data)
        }

        return data || []
    } catch (error) {
        console.error('❌ Error fetching from API:', error)
        // Fallback to cache
        const cached = await getCachedDevices()
        if (cached) {
            console.log('📦 Using cached devices (API failed)')
            return cached
        }
        throw error
    }
}

/**
 * Hook to fetch all devices with caching
 */
export function useDevices() {
    return useQuery({
        queryKey: queryKeys.devices,
        queryFn: fetchDevices,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchInterval: 60 * 1000,
    })
}

/**
 * Hook to fetch a single device
 */
export function useDevice(deviceId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.device(deviceId!),
        queryFn: async () => {
            if (!deviceId) return null

            const docRef = doc(db, 'devices', deviceId)
            const docSnap = await getDoc(docRef)

            if (!docSnap.exists()) {
                throw new Error('Device not found')
            }

            return { id: docSnap.id, ...docSnap.data() } as Device
        },
        enabled: !!deviceId,
        staleTime: 5 * 60 * 1000,
    })
}

/**
 * Hook to add a new device
 */
export function useAddDevice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (newDevice: Partial<Device>) => {
            return await createDeviceApi(newDevice)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.devices })
        },
    })
}

/**
 * Hook to update a device
 */
export function useUpdateDevice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Device> }) => {
            return await updateDeviceApi(id, updates)
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKeys.device(data.id), data)
            queryClient.invalidateQueries({ queryKey: queryKeys.devices })
        },
    })
}

/**
 * Hook to delete a device
 */
export function useDeleteDevice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (deviceId: string) => {
            await deleteDeviceApi(deviceId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.devices })
        },
    })
}

/**
 * Subscribe to real-time device changes
 */
export function useDeviceSubscription() {
    const queryClient = useQueryClient()

    useEffect(() => {
        console.log('🔥 Setting up Firestore realtime subscription for devices')

        const q = collection(db, 'devices')
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const deviceData = { id: change.doc.id, ...change.doc.data() } as Device
                console.log(`🔄 Device ${change.type}:`, deviceData.name)

                queryClient.setQueryData<Device[]>(queryKeys.devices, (oldDevices) => {
                    if (!oldDevices) return oldDevices

                    switch (change.type) {
                        case 'added':
                            // If it's already in the cache, ignore (TanStack Query might have it)
                            if (oldDevices.find(d => d.id === deviceData.id)) return oldDevices
                            return [deviceData, ...oldDevices]

                        case 'modified':
                            return oldDevices.map(device =>
                                device.id === deviceData.id ? deviceData : device
                            )

                        case 'removed':
                            return oldDevices.filter(device => device.id !== deviceData.id)

                        default:
                            return oldDevices
                    }
                })
            })

            // Update IndexedDB cache
            const currentDevices = queryClient.getQueryData<Device[]>(queryKeys.devices)
            if (currentDevices) {
                cacheDevices(currentDevices).catch(console.error)
            }
        })

        return () => {
            console.log('🔥 Cleaning up Firestore subscription')
            unsubscribe()
        }
    }, [queryClient])
}

/**
 * Hook to fetch historical sensor data from Firestore (for charts)
 */
export function useDeviceSensorData(deviceId: string | undefined, limitCount: number = 100) {
    return useQuery({
        queryKey: ['sensor_data', deviceId, limitCount],
        queryFn: async () => {
            if (!deviceId) return []

            const q = query(
                collection(db, 'sensor_data'),
                where('device_id', '==', deviceId),
                orderBy('recorded_at', 'desc'),
                firestoreLimit(limitCount)
            )

            const querySnapshot = await getDocs(q)
            return querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            })) as SensorDataRecord[]
        },
        enabled: !!deviceId,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000
    })
}

/**
 * Hook to fetch device health events (state transitions)
 */
export function useDeviceHealthEvents(deviceId: string | undefined, limitCount: number = 20) {
    return useQuery({
        queryKey: queryKeys.healthEvents(deviceId!),
        queryFn: async () => {
            if (!deviceId) return []

            const q = query(
                collection(db, 'device_state_events'),
                where('device_id', '==', deviceId),
                orderBy('started_at', 'desc'),
                firestoreLimit(limitCount)
            )

            const querySnapshot = await getDocs(q)
            return querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            })) as DeviceEvent[]
        },
        enabled: !!deviceId,
        staleTime: 60 * 1000,
    })
}
