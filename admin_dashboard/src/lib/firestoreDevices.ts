/**
 * Firestore Direct Device Fetching
 *
 * This module fetches devices directly from Firebase Firestore.
 * It is used as a primary data source when the backend API is unavailable,
 * ensuring the app always has data even without a running backend server.
 */
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Device } from '../types'

const DEVICES_COLLECTION = 'devices'

/**
 * Fetch all devices directly from Firestore
 */
export async function fetchDevicesFromFirestore(): Promise<Device[]> {
    console.log('🔥 Fetching devices directly from Firestore...')
    const devicesRef = collection(db, DEVICES_COLLECTION)
    const q = query(devicesRef, orderBy('created_at', 'desc'))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
        console.log('📭 No devices found in Firestore')
        return []
    }

    const devices = snapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return {
            id: docSnap.id,
            name: data.name || 'Unnamed Device',
            location_name: data.location_name || data.locationName || undefined,
            description: data.description || undefined,
            latitude: data.latitude || data.lat || 0,
            longitude: data.longitude || data.lng || data.lon || 0,
            thingspeak_channel_id: data.thingspeak_channel_id || data.thingspeakChannelId || undefined,
            thingspeak_read_key: data.thingspeak_read_key || data.thingspeakReadKey || undefined,
            thingspeak_write_key: data.thingspeak_write_key || data.thingspeakWriteKey || undefined,
            node_number: data.node_number || data.nodeNumber || undefined,
            sim_number: data.sim_number || data.simNumber || undefined,
            serial_number: data.serial_number || data.serialNumber || undefined,
            tds_field_number: data.tds_field_number ?? data.tdsFieldNumber ?? 1,
            temperature_field_number: data.temperature_field_number ?? data.temperatureFieldNumber ?? 2,
            voltage_field_number: data.voltage_field_number ?? data.voltageFieldNumber ?? 3,
            status: data.status || 'offline',
            last_seen_at: data.last_seen_at || data.lastSeenAt || undefined,
            deployment_date: data.deployment_date || data.deploymentDate || undefined,
            metadata: data.metadata || undefined,
            confidence_score: data.confidence_score || data.confidenceScore || undefined,
            last_reading_at: data.last_reading_at || data.lastReadingAt || undefined,
            qr_rotation_pending: data.qr_rotation_pending || data.qrRotationPending || false,
            updated_at: data.updated_at || data.updatedAt || undefined,
            safe_tds_min: data.safe_tds_min ?? data.safeTdsMin ?? 50,
            safe_tds_max: data.safe_tds_max ?? data.safeTdsMax ?? 300,
            created_at: data.created_at || data.createdAt || new Date().toISOString(),
        } as Device
    })

    console.log(`✅ Loaded ${devices.length} devices from Firestore`)
    return devices
}

/**
 * Create a new device in Firestore
 */
export async function createDeviceInFirestore(deviceData: Partial<Device>): Promise<Device> {
    const devicesRef = collection(db, DEVICES_COLLECTION)
    const now = new Date().toISOString()

    const newDevice = {
        ...deviceData,
        created_at: now,
        updated_at: now,
        status: deviceData.status || 'offline',
    }

    const docRef = await addDoc(devicesRef, newDevice)
    return { ...newDevice, id: docRef.id } as Device
}

/**
 * Update a device in Firestore
 */
export async function updateDeviceInFirestore(id: string, updates: Partial<Device>): Promise<Device> {
    const docRef = doc(db, DEVICES_COLLECTION, id)
    const now = new Date().toISOString()

    const updateData = {
        ...updates,
        updated_at: now,
    }

    await updateDoc(docRef, updateData)

    // Return updated device by re-fetching
    const devices = await fetchDevicesFromFirestore()
    const updated = devices.find(d => d.id === id)
    if (!updated) throw new Error(`Device ${id} not found after update`)
    return updated
}

/**
 * Delete a device from Firestore
 */
export async function deleteDeviceFromFirestore(id: string): Promise<void> {
    const docRef = doc(db, DEVICES_COLLECTION, id)
    await deleteDoc(docRef)
    console.log(`🗑️ Deleted device ${id} from Firestore`)
}
