import { useQuery, useQueries } from '@tanstack/react-query'
import { type Device, type EnrichedDevice } from '../lib/supabase'
import { fetchFeeds, type FieldMapping, type ParsedSensorData } from '../lib/thingspeak'
import { queryKeys } from '../lib/queryClient'
import { cacheSensorData, getCachedSensorData } from '../lib/cache'
import { useEffect } from 'react'

/**
 * Fetch ThingSpeak data for a single device
 */
async function fetchDeviceThingSpeakData(
    device: Device
): Promise<ParsedSensorData[]> {
    if (!device.thingspeak_channel_id || !device.thingspeak_read_key) {
        return []
    }

    // Try cache first
    const cached = await getCachedSensorData(device.id)
    if (cached) {
        console.log(`📦 Using cached sensor data for ${device.location_name || device.name}`)
        return cached
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
        2000 // Fetch last 2000 readings
    )

    // Cache the result
    if (data.length > 0) {
        await cacheSensorData(device.id, data)
    }

    return data
}

/**
 * Hook to fetch ThingSpeak data for a single device
 */
export function useDeviceThingSpeakData(device: Device | undefined) {
    return useQuery({
        queryKey: queryKeys.sensorData(device?.id || ''),
        queryFn: () => fetchDeviceThingSpeakData(device!),
        enabled: !!device?.thingspeak_channel_id && !!device?.thingspeak_read_key,
        staleTime: 4 * 1000, // 4 seconds (Phase 6: UI/UX Upgrade - matches 5s polling)
        refetchInterval: 5 * 1000, // Poll every 5 seconds for real-time
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    })
}

/**
 * Hook to fetch ThingSpeak data for multiple devices (batched)
 */
export function useAllDevicesThingSpeakData(devices: Device[]) {
    // Create queries for all devices
    const queries = useQueries({
        queries: devices.map(device => ({
            queryKey: queryKeys.sensorData(device.id),
            queryFn: () => fetchDeviceThingSpeakData(device),
            enabled: !!device.thingspeak_channel_id && !!device.thingspeak_read_key,
            staleTime: 15 * 1000,
            refetchInterval: 15 * 1000,
            gcTime: 30 * 60 * 1000,
        }))
    })

    // Combine results into a map
    const deviceDataMap = new Map<string, ParsedSensorData[]>()
    const enrichedDevices: EnrichedDevice[] = []

    devices.forEach((device, index) => {
        const query = queries[index]
        const data = query.data || []

        deviceDataMap.set(device.id, data)

        // Enrich device with latest data (cast to any for runtime properties)
        const latest = data.length > 0 ? data[data.length - 1] : null
        enrichedDevices.push({
            ...device,
            latest_tds: latest?.tds,
            latest_temp: latest?.temperature,
            latest_voltage: latest?.voltage,
            last_reading_at: latest?.timestamp,
            is_offline: !latest || (Date.now() - new Date(latest.timestamp).getTime()) > 60 * 60 * 1000
        } as any)
    })

    const isLoading = queries.some(q => q.isLoading)
    const isError = queries.some(q => q.isError)

    return {
        devices: enrichedDevices,
        deviceData: deviceDataMap,
        isLoading,
        isError
    }
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
