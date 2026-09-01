import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { type Device } from '../types'
import { type ParsedSensorData } from './thingspeak'

interface EvaraTdsDB extends DBSchema {
    devices: {
        key: string
        value: {
            id: string
            data: Device
            timestamp: number
        }
    }
    sensorData: {
        key: string
        value: {
            deviceId: string
            data: ParsedSensorData[]
            timestamp: number
        }
    }
    metadata: {
        key: string
        value: {
            key: string
            value: unknown
            timestamp: number
        }
    }
}

const DB_NAME = 'evaratds-cache'
const DB_VERSION = 1
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

let dbInstance: IDBPDatabase<EvaraTdsDB> | null = null

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBPDatabase<EvaraTdsDB>> {
    if (dbInstance) return dbInstance

    dbInstance = await openDB<EvaraTdsDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Create object stores
            if (!db.objectStoreNames.contains('devices')) {
                db.createObjectStore('devices', { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains('sensorData')) {
                db.createObjectStore('sensorData', { keyPath: 'deviceId' })
            }
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' })
            }
        },
    })

    return dbInstance
}

/**
 * Store devices in IndexedDB
 */
export async function cacheDevices(devices: Device[]): Promise<void> {
    const db = await initDB()
    const tx = db.transaction('devices', 'readwrite')

    await Promise.all([
        ...devices.map(device =>
            tx.store.put({
                id: device.id,
                data: device,
                timestamp: Date.now()
            })
        ),
        tx.done
    ])
}

/**
 * Get cached devices from IndexedDB
 */
export async function getCachedDevices(): Promise<Device[] | null> {
    try {
        const db = await initDB()
        const allDevices = await db.getAll('devices')

        // Filter out stale data
        const now = Date.now()
        const validDevices = allDevices.filter(
            item => now - item.timestamp < CACHE_TTL
        )

        if (validDevices.length === 0) return null

        return validDevices.map(item => item.data)
    } catch (error) {
        console.error('Error reading cached devices:', error)
        return null
    }
}

/**
 * Store sensor data in IndexedDB
 */
export async function cacheSensorData(deviceId: string, data: ParsedSensorData[]): Promise<void> {
    const db = await initDB()
    await db.put('sensorData', {
        deviceId,
        data,
        timestamp: Date.now()
    })
}

/**
 * Get cached sensor data from IndexedDB
 */
export async function getCachedSensorData(deviceId: string): Promise<ParsedSensorData[] | null> {
    try {
        const db = await initDB()
        const cached = await db.get('sensorData', deviceId)

        if (!cached) return null

        // Check if stale
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            return null
        }

        return cached.data
    } catch (error) {
        console.error('Error reading cached sensor data:', error)
        return null
    }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
    const db = await initDB()
    await Promise.all([
        db.clear('devices'),
        db.clear('sensorData'),
        db.clear('metadata')
    ])
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    deviceCount: number
    sensorDataCount: number
    totalSize: number
}> {
    const db = await initDB()
    const [devices, sensorData] = await Promise.all([
        db.getAll('devices'),
        db.getAll('sensorData')
    ])

    return {
        deviceCount: devices.length,
        sensorDataCount: sensorData.length,
        totalSize: devices.length + sensorData.length
    }
}
