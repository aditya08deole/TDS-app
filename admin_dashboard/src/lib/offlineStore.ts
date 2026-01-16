import { openDB, type DBSchema } from 'idb'
import type { Device, Alert } from './supabase'

interface EvaraDB extends DBSchema {
    devices: {
        key: string
        value: Device
    }
    alerts: {
        key: string
        value: Alert
    }
    actionQueue: {
        key: number
        value: {
            id: number
            type: 'ACKNOWLEDGE_ALERT' | 'RESOLVE_ALERT'
            payload: any
            timestamp: number
        }
        indexes: { 'by-timestamp': number }
    }
}

const dbPromise = openDB<EvaraDB>('evara-tds-db', 1, {
    upgrade(db) {
        db.createObjectStore('devices', { keyPath: 'id' })
        db.createObjectStore('alerts', { keyPath: 'id' })
        const actions = db.createObjectStore('actionQueue', { keyPath: 'id', autoIncrement: true })
        actions.createIndex('by-timestamp', 'timestamp')
    },
})

export const offlineStore = {
    async cacheDevices(devices: Device[]) {
        const db = await dbPromise
        const tx = db.transaction('devices', 'readwrite')
        await Promise.all([
            ...devices.map(d => tx.store.put(d)),
            tx.done
        ])
    },

    async getDevices(): Promise<Device[]> {
        const db = await dbPromise
        return db.getAll('devices')
    },

    async cacheAlerts(alerts: Alert[]) {
        const db = await dbPromise
        const tx = db.transaction('alerts', 'readwrite')
        await Promise.all([
            ...alerts.map(a => tx.store.put(a)),
            tx.done
        ])
    },

    async getAlerts(): Promise<Alert[]> {
        const db = await dbPromise
        return db.getAll('alerts')
    },

    async queueAction(type: 'ACKNOWLEDGE_ALERT' | 'RESOLVE_ALERT', payload: any) {
        const db = await dbPromise
        await db.add('actionQueue', {
            type,
            payload,
            timestamp: Date.now()
        } as any)
    },

    async getPendingActions() {
        const db = await dbPromise
        return db.getAllFromIndex('actionQueue', 'by-timestamp')
    },

    async removeAction(id: number) {
        const db = await dbPromise
        await db.delete('actionQueue', id)
    }
}
