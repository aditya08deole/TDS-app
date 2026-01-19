import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase, type Device } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import { cacheDevices, getCachedDevices } from '../lib/cache'

/**
 * Fetch all devices from Supabase
 */
async function fetchDevices(): Promise<Device[]> {
    // Try cache first
    const cached = await getCachedDevices()
    if (cached) {
        console.log('📦 Using cached devices')
        return cached
    }

    // Fetch from Supabase
    const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw error

    // Cache the result
    if (data) {
        await cacheDevices(data)
    }

    return data || []
}

/**
 * Hook to fetch all devices with caching
 */
export function useDevices() {
    return useQuery({
        queryKey: queryKeys.devices,
        queryFn: fetchDevices,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
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

            const { data, error } = await supabase
                .from('devices')
                .select('*')
                .eq('id', deviceId)
                .single()

            if (error) throw error
            return data
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
            const { data, error } = await supabase
                .from('devices')
                .insert([newDevice])
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            // Invalidate devices query to refetch
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
            const { data, error } = await supabase
                .from('devices')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (data) => {
            // Update cache optimistically
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
            const { error } = await supabase
                .from('devices')
                .delete()
                .eq('id', deviceId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.devices })
        },
    })
}

/**
 * Subscribe to real-time device changes
 * Optimized to update cache directly instead of invalidating
 */
export function useDeviceSubscription() {
    const queryClient = useQueryClient()

    useEffect(() => {
        console.log('🔌 Setting up Supabase realtime subscription for devices')

        const subscription = supabase
            .channel('devices_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'devices'
            }, (payload) => {
                const newDevice = payload.new as Device | null
                const oldDevice = payload.old as Device | null
                console.log('🔄 Device change detected:', payload.eventType, newDevice?.name || oldDevice?.name)

                // Update cache directly based on event type
                queryClient.setQueryData<Device[]>(queryKeys.devices, (oldDevices) => {
                    if (!oldDevices) return oldDevices

                    switch (payload.eventType) {
                        case 'INSERT':
                            // Add new device to cache
                            return [payload.new as Device, ...oldDevices]

                        case 'UPDATE':
                            // Update existing device in cache
                            return oldDevices.map(device =>
                                device.id === payload.new.id ? payload.new as Device : device
                            )

                        case 'DELETE':
                            // Remove device from cache
                            return oldDevices.filter(device => device.id !== payload.old.id)

                        default:
                            return oldDevices
                    }
                })

                // Also update IndexedDB cache
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const currentDevices = queryClient.getQueryData<Device[]>(queryKeys.devices)
                    if (currentDevices) {
                        cacheDevices(currentDevices).catch(console.error)
                    }
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime subscription active')
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Realtime subscription error')
                }
            })

        return () => {
            console.log('🔌 Cleaning up realtime subscription')
            subscription.unsubscribe()
        }
    }, [queryClient])
}
