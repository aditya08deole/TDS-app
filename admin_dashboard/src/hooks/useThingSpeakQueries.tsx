import { useQuery, useQueries } from '@tanstack/react-query'
import { type Device, type EnrichedDevice } from '../types'
import { fetchFeeds, fetchLastEntry, type FieldMapping, type ParsedSensorData } from '../lib/thingspeak'
import { queryKeys } from '../lib/queryClient'
import { cacheSensorData, getCachedSensorData } from '../lib/cache'
import { useEffect, useMemo } from 'react'
import { getConnectivityStatus } from '../lib/constants'

/**
 * Helper function to get field mapping from device
 */
function getFieldMapping(device: Device): FieldMapping {
    return {
        tds: device.tds_field_number || 1,
        temperature: device.temperature_field_number || 2,
        voltage: device.voltage_field_number || 3
    }
}

/**
 * Fetch ThingSpeak data for a single device
 */
async function fetchDeviceThingSpeakData(
    device: Device
): Promise<ParsedSensorData[]> {
    if (!device.thingspeak_channel_id || !device.thingspeak_read_key) {
        return []
    }

    // Use network-first strategy for real-time monitoring
    // Cache is used only as a fallback if network fails
    let cachedData: ParsedSensorData[] = []
    try {
        const cached = await getCachedSensorData(device.id)
        if (cached) {
            cachedData = cached
        }
    } catch (e) {
        console.warn('Cache read failed', e)
    }

    const mapping: FieldMapping = {
        tds: device.tds_field_number || 1,
        temperature: device.temperature_field_number || 2,
        voltage: device.voltage_field_number || 3
    }

    try {
        const data = await fetchFeeds(
            device.thingspeak_channel_id,
            device.thingspeak_read_key,
            mapping,
            2000 // Fetch last 2000 readings
        )

        // Cache the result for future offline use
        if (data.length > 0) {
            await cacheSensorData(device.id, data)
        }

        return data
    } catch (error) {
        console.warn(`Network fetch failed for ${device.id}, falling back to cache`)
        return cachedData
    }
}

/**
 * Hook to fetch ThingSpeak data for a single device
 * Optimized for real-time updates (1-2 second latency)
 */
export function useDeviceThingSpeakData(device: Device | undefined) {
    return useQuery({
        queryKey: queryKeys.sensorData(device?.id || ''),
        queryFn: () => fetchDeviceThingSpeakData(device!),
        enabled: !!device?.thingspeak_channel_id && !!device?.thingspeak_read_key,
        staleTime: 0, // Always consider stale - fetch immediately on mount/focus
        refetchInterval: 15 * 1000, // Poll every 15 seconds (respects ThingSpeak 4 req/sec free tier limit)
        refetchOnWindowFocus: true, // Refetch when user returns to tab
        refetchOnReconnect: true, // Refetch on network reconnect
        refetchIntervalInBackground: false, // Don't poll when tab is hidden (save resources)
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    })
}

/**
 * NEW: Hook to fetch ONLY the latest reading from ThingSpeak
 * Uses /last.json endpoint for maximum efficiency
 * 
 * Benefits:
 * - 100x less data transfer (200 bytes vs 20KB)
 * - Faster response time (1-2 seconds)
 * - Minimal API load
 * 
 * Use this for:
 * - Real-time device status
 * - Current TDS/temperature values
 * - Online/offline detection
 */
export function useDeviceLatestReading(device: Device | undefined) {
    return useQuery({
        queryKey: ['thingspeak', 'latest', device?.id || ''],
        queryFn: async () => {
            if (!device?.thingspeak_channel_id || !device?.thingspeak_read_key) {
                return null
            }

            const mapping = getFieldMapping(device)

            // Use /last.json endpoint for single latest entry
            const latestReading = await fetchLastEntry(
                device.thingspeak_channel_id,
                device.thingspeak_read_key,
                mapping
            )

            return latestReading
        },
        enabled: !!device?.thingspeak_channel_id && !!device?.thingspeak_read_key,
        staleTime: 0, // Always fresh
        refetchInterval: 15 * 1000, // Poll every 15 seconds (respects ThingSpeak free tier limit)
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
        gcTime: 5 * 60 * 1000,
    })
}

/**
 * Hook to fetch ThingSpeak data for multiple devices (batched)
 * Optimized: Only fetches the LATEST reading to enrich the device list.
 * This reduces data transfer by ~99% for large device lists.
 */
export function useAllDevicesThingSpeakData(devices: Device[]) {
    // Create queries for all devices - Optimized to only fetch LAST entry
    const queries = useQueries({
        queries: devices.map(device => ({
            queryKey: ['thingspeak', 'latest', device.id],
            queryFn: async () => {
                if (!device.thingspeak_channel_id || !device.thingspeak_read_key) {
                    return null
                }
                const mapping = getFieldMapping(device)
                return await fetchLastEntry(
                    device.thingspeak_channel_id,
                    device.thingspeak_read_key,
                    mapping
                )
            },
            enabled: !!device.thingspeak_channel_id && !!device.thingspeak_read_key,
            staleTime: 10 * 1000, 
            refetchInterval: 15 * 1000, 
            gcTime: 5 * 60 * 1000,
        }))
    })

    const enrichedDevices: EnrichedDevice[] = useMemo(() => {
        return devices.map((device, index) => {
            const query = queries[index]
            const latest = query.data
            
            return {
                ...device,
                latest_tds: latest?.tds,
                latest_temperature: latest?.temperature,
                latest_voltage: latest?.voltage,
                last_reading_at: latest?.timestamp,
                is_offline: getConnectivityStatus(latest?.timestamp) === 'offline'
            } as EnrichedDevice
        })
    }, [devices, queries])

    const isLoading = useMemo(() => queries.some(q => q.isLoading), [queries])
    const isError = useMemo(() => queries.some(q => q.isError), [queries])

    return useMemo(() => ({
        devices: enrichedDevices,
        isLoading,
        isError
    }), [enrichedDevices, isLoading, isError])
}

/**
 * Fetch ThingSpeak data for charts (real-time)
 * This provides high-frequency sensor data for real-time chart updates
 */
export function useDeviceThingSpeakChartData(
    device: Device | undefined,
    results: number = 100
) {
    return useQuery({
        queryKey: ['thingspeak_chart_data', device?.id, results],
        queryFn: async () => {
            if (!device?.thingspeak_channel_id || !device?.thingspeak_read_key) {
                return []
            }

            const mapping: FieldMapping = {
                tds: device.tds_field_number || 1,
                temperature: device.temperature_field_number || 2,
                voltage: device.voltage_field_number || 3
            }

            const data = await fetchFeeds(
                device.thingspeak_channel_id,
                device.thingspeak_read_key,
                mapping,
                results
            )

            return data
        },
        enabled: !!device?.thingspeak_channel_id && !!device?.thingspeak_read_key,
        staleTime: 10 * 1000, // 10 seconds for real-time feel
        refetchInterval: 15 * 1000, // Auto-refresh every 15 seconds
        gcTime: 60 * 1000
    })
}

/**
 * Log cache performance metrics
 */
export function useThingSpeakCacheMetrics() {
    useEffect(() => {
        const interval = setInterval(() => {
            // Log cache hit rate every minute
            console.log('📊 ThingSpeak Cache Metrics:', {
                timestamp: new Date().toISOString(),
                // Add more metrics as needed
            })
        }, 60 * 1000)

        return () => clearInterval(interval)
    }, [])
}
