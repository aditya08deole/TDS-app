import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Device, SystemHealthLog, UptimeStat } from '../types'
import { queryKeys } from '../lib/queryClient'
import { cacheDevices, getCachedDevices } from '../lib/cache'
import { 
    fetchDevices as fetchDevicesFromApi,
    createDevice as createDeviceApi,
    deleteDevice as deleteDeviceApi,
    updateDevice as updateDeviceApi,
    getDeviceSensorData as fetchSensorDataApi,
    getDeviceHealthEvents as fetchHealthEventsApi,
    getSystemHealthLogs as fetchSystemHealthLogsApi,
    getUptimeStats as fetchUptimeStatsApi
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
        staleTime: 10 * 1000, // 10 seconds stale time for more frequent updates
        gcTime: 10 * 60 * 1000,
        refetchInterval: 15 * 1000, // Poll every 15 seconds
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
            return await fetchDevicesFromApi().then(devices => devices.find(d => d.id === deviceId) || null)
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
 * Hook to subscribe to real-time device changes (DEPRECATED: Use polling in useDevices instead)
 */
export function useDeviceSubscription() {
    // This hook is now a no-op as we use polling in useDevices
    useEffect(() => {
        console.log('ℹ️ useDeviceSubscription is now using polling via useDevices')
    }, [])
}

/**
 * Hook to fetch historical sensor data from Firestore (for charts)
 */
export function useDeviceSensorData(deviceId: string | undefined, limitCount: number = 100) {
    return useQuery({
        queryKey: ['sensor_data', deviceId, limitCount],
        queryFn: async () => {
            if (!deviceId) return []
            return await fetchSensorDataApi(deviceId, limitCount)
        },
        enabled: !!deviceId,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 30 * 1000 // Poll every 30 seconds
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
            return await fetchHealthEventsApi(deviceId, limitCount)
        },
        enabled: !!deviceId,
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000 // Poll every 30 seconds
    })
}

/**
 * Hook to fetch system health logs
 */
export function useSystemHealthLogs(limitCount: number = 100) {
    return useQuery({
        queryKey: ['system_health_logs', limitCount],
        queryFn: () => fetchSystemHealthLogsApi(limitCount),
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000 // Poll every 30 seconds
    })
}

/**
 * Hook to fetch uptime statistics
 */
export function useUptimeStats(deviceId?: string) {
    return useQuery({
        queryKey: ['uptime_stats', deviceId],
        queryFn: () => fetchUptimeStatsApi(deviceId),
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000 // Poll every 5 minutes
    })
}
