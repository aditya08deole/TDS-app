// Custom hook for fetching real-time ThingSpeak data
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchFeeds, type ParsedSensorData, type FieldMapping } from '../lib/thingspeak'
import { THINGSPEAK_POLL_INTERVAL, isDeviceOffline } from '../lib/constants'
import type { Device } from '../lib/supabase'

export interface DeviceWithSensorData extends Device {
    latest_tds?: number
    latest_temp?: number
    latest_voltage?: number
    last_reading_time?: string
    is_offline?: boolean
}

export function useThingSpeakData(devices: Device[]) {
    const [deviceData, setDeviceData] = useState<Map<string, ParsedSensorData[]>>(new Map())
    const [latestReadings, setLatestReadings] = useState<Map<string, ParsedSensorData>>(new Map())
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<number | null>(null)

    // Fetch data for a single device
    const fetchDeviceData = useCallback(async (device: Device) => {
        // Need both channel ID and read key
        if (!device.thingspeak_channel_id || !device.thingspeak_read_key) {
            console.warn(`Device ${device.name} missing channel_id or read_key`)
            return null
        }

        const mapping: FieldMapping = {
            tds: device.tds_field_number || 1,
            temperature: device.temperature_field_number || 2,
            voltage: device.voltage_field_number || 3
        }

        try {
            // Fetch historical data (last 2000 readings - approx 3 hours at 5s interval)
            const historical = await fetchFeeds(
                device.thingspeak_channel_id,
                device.thingspeak_read_key,
                mapping,
                2000
            )

            // Get latest reading
            const latest = historical.length > 0 ? historical[historical.length - 1] : null

            console.log(`Device ${device.name}: fetched ${historical.length} readings, latest TDS: ${latest?.tds}`)

            return { historical, latest }
        } catch (err) {
            console.error(`Error fetching data for device ${device.name}:`, err)
            return null
        }
    }, [])

    // Fetch data for all devices
    const fetchAllDevices = useCallback(async () => {
        if (devices.length === 0) {
            setLoading(false)
            return
        }

        try {
            const results = await Promise.all(
                devices.map(device => fetchDeviceData(device))
            )

            const newDeviceData = new Map<string, ParsedSensorData[]>()
            const newLatestReadings = new Map<string, ParsedSensorData>()

            devices.forEach((device, index) => {
                const result = results[index]
                if (result) {
                    if (result.historical.length > 0) {
                        newDeviceData.set(device.id, result.historical)
                    }
                    if (result.latest) {
                        newLatestReadings.set(device.id, result.latest)
                    }
                }
            })

            setDeviceData(newDeviceData)
            setLatestReadings(newLatestReadings)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch ThingSpeak data')
        } finally {
            setLoading(false)
        }
    }, [devices, fetchDeviceData])

    // Initial fetch
    useEffect(() => {
        fetchAllDevices()
    }, [fetchAllDevices])

    // Set up polling interval
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }

        intervalRef.current = setInterval(() => {
            fetchAllDevices()
        }, THINGSPEAK_POLL_INTERVAL)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [fetchAllDevices])

    // Enrich devices with sensor data
    const enrichedDevices: DeviceWithSensorData[] = devices.map(device => {
        const latest = latestReadings.get(device.id)
        const lastReadingTime = latest?.timestamp
        const offline = isDeviceOffline(lastReadingTime)

        return {
            ...device,
            latest_tds: latest?.tds,
            latest_temp: latest?.temperature,
            latest_voltage: latest?.voltage,
            last_reading_time: lastReadingTime,
            is_offline: offline
        }
    })

    return {
        devices: enrichedDevices,
        deviceData,
        latestReadings,
        loading,
        error,
        refresh: fetchAllDevices
    }
}
