import { QueryClient } from '@tanstack/react-query'

/**
 * Optimized QueryClient configuration for EvaraTDS
 * 
 * Key features:
 * - 5 minute stale time (data considered fresh)
 * - 10 minute cache time (data kept in memory)
 * - Automatic refetching on window focus
 * - Exponential backoff retry strategy
 * - Request deduplication
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 5 minutes
            staleTime: 5 * 60 * 1000,

            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,

            // Refetch on window focus for real-time updates
            refetchOnWindowFocus: true,

            // Don't refetch on mount if data is fresh
            refetchOnMount: false,

            // Retry failed requests with exponential backoff
            retry: (failureCount, error: any) => {
                // Don't retry on 404 or 401
                if (error?.status === 404 || error?.status === 401) {
                    return false
                }
                // Max 3 retries
                return failureCount < 3
            },

            // Exponential backoff: 1s, 2s, 4s
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // Enable request deduplication
            networkMode: 'online',
        },
        mutations: {
            // Retry mutations once
            retry: 1,

            // Network mode for mutations
            networkMode: 'online',
        },
    },
})

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
    // Devices
    devices: ['devices'] as const,
    device: (id: string) => ['devices', id] as const,

    // Sensor data
    sensorData: (deviceId: string) => ['sensor-data', deviceId] as const,
    allSensorData: ['sensor-data'] as const,

    // ThingSpeak
    thingspeakFeeds: (channelId: string) => ['thingspeak', 'feeds', channelId] as const,
    thingspeakLatest: (channelId: string) => ['thingspeak', 'latest', channelId] as const,

    // Aggregated stats
    dashboardStats: ['dashboard-stats'] as const,

    // Alerts
    alerts: ['alerts'] as const,
    activeAlerts: ['alerts', 'active'] as const,
}

/**
 * Prefetch data for faster navigation
 */
export async function prefetchDevices() {
    await queryClient.prefetchQuery({
        queryKey: queryKeys.devices,
        staleTime: 5 * 60 * 1000,
    })
}

/**
 * Invalidate all queries (force refetch)
 */
export function invalidateAllQueries() {
    queryClient.invalidateQueries()
}

/**
 * Clear all cached data
 */
export function clearQueryCache() {
    queryClient.clear()
}
