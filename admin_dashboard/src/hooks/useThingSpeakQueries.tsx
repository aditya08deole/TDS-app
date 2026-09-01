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
    } catch {
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
        refetchInterval: 5 * 1000, // Reduced to 5 seconds for faster updates
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
        refetchInterval: 5 * 1000, // Reduced to 5 seconds for faster updates
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
        gcTime: 5 * 60 * 1000,
    })
}

/**
 * Hook to fetch live telemetry data for multiple devices (up to 50 devices)
 * Optimized: Attempts a single batched endpoint call (`GET /api/devices/telemetry/live`),
 * reducing network requests from 50 queries down to 1 single request.
 * Falls back to individual ThingSpeak endpoints if backend is offline.
 */
export function useAllDevicesThingSpeakData(devices: Device[]) {
    // Normalize devices to guarantee channelId and readApiKey fields
    const normalizedDevices = useMemo(() => {
        return devices.map(d => ({
            ...d,
            thingspeak_channel_id: d.thingspeak_channel_id || (d as any).channelId || (d as any).channel_id,
            thingspeak_read_key: d.thingspeak_read_key || (d as any).readApiKey || (d as any).read_api_key
        }))
    }, [devices])

    // 1. Batched Single-Call Query
    const batchQuery = useQuery({
        queryKey: ['devices', 'telemetry', 'live_batch', normalizedDevices.map(d => d.id).join(',')],
        queryFn: async () => {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/devices/telemetry/live`);
            if (!res.ok) throw new Error('Batch endpoint unavailable');
            const json = await res.json();
            return json.data as EnrichedDevice[];
        },
        enabled: normalizedDevices.length > 0,
        staleTime: 0,
        refetchInterval: 5 * 1000,
        retry: 1,
    });

    // 2. Individual ThingSpeak queries (Fetches direct live feeds from ThingSpeak)
    const fallbackQueries = useQueries({
        queries: normalizedDevices.map(device => {
            const channelId = device.thingspeak_channel_id;
            const readKey = device.thingspeak_read_key;

            return {
                queryKey: ['thingspeak', 'latest', device.id, channelId],
                queryFn: async () => {
                    if (!channelId || !readKey) return null;
                    const mapping = getFieldMapping(device);
                    return await fetchLastEntry(channelId, readKey, mapping);
                },
                enabled: !!channelId && !!readKey,
                staleTime: 0,
                refetchInterval: 5 * 1000,
                gcTime: 5 * 60 * 1000,
            };
        })
    });

    const enrichedDevices: EnrichedDevice[] = useMemo(() => {
        const batchMap = new Map(
            (batchQuery.data && Array.isArray(batchQuery.data)) 
                ? batchQuery.data.map(d => [d.id, d]) 
                : []
        );

        return normalizedDevices.map((device, index) => {
            const live = batchMap.get(device.id);
            const tsData = fallbackQueries[index]?.data;

            const latest_tds = live?.latest_tds ?? tsData?.tds ?? device.last_tds;
            const latest_temperature = live?.latest_temperature ?? tsData?.temperature ?? device.last_temperature;
            const latest_voltage = live?.latest_voltage ?? tsData?.voltage ?? device.last_voltage;
            const last_reading_at = live?.last_reading_at || tsData?.timestamp || device.last_reading_at || (device as any).last_seen_at;

            const connectivity = getConnectivityStatus(last_reading_at);

            return {
                ...device,
                latest_tds,
                latest_temperature,
                latest_voltage,
                last_reading_at,
                is_offline: connectivity === 'offline',
                status: connectivity === 'online' ? (live?.status === 'critical' ? 'critical' : 'online') : 'offline'
            } as EnrichedDevice;
        });
    }, [normalizedDevices, batchQuery.data, fallbackQueries]);

    const isLoading = useMemo(() => batchQuery.isLoading && fallbackQueries.some(q => q.isLoading), [batchQuery.isLoading, fallbackQueries]);

    return useMemo(() => ({
        devices: enrichedDevices,
        isLoading,
        isError: batchQuery.isError && fallbackQueries.some(q => q.isError)
    }), [enrichedDevices, isLoading, batchQuery.isError, fallbackQueries]);
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
        staleTime: 0, // Always consider stale - fetch immediately
        refetchInterval: 5 * 1000, // Reduced to 5 seconds for faster updates
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
