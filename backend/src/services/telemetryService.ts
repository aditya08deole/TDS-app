import { getFirestore, WriteBatch, FieldValue } from 'firebase-admin/firestore';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, SensorData } from '../types';
import { TDS_CONFIG } from '../config/tdsConfig';

const db = getFirestore();
const redis = getRedisClient();

// Local buffer for batching Firestore writes
let sensorDataBuffer: any[] = [];
const BATCH_SIZE = 400; // Leave room for other operations
const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Process incoming telemetry from devices
 */
export async function processTelemetry(data: {
    device_id: string;
    tds: number;
    temperature?: number;
    voltage?: number;
    recorded_at?: string;
}) {
    const deviceId = data.device_id;
    const now = new Date();
    const recordedAt = data.recorded_at ? new Date(data.recorded_at) : now;

    // 1. Try L1 Cache (In-Memory)
    let device = l1Cache.get<Device>(`device:${deviceId}`);

    // 2. If not in L1, try L2 Cache (Redis)
    if (!device) {
        device = await hgetall<Device>(`device:${deviceId}`);
        if (device) {
            l1Cache.set(`device:${deviceId}`, device, 60 * 1000); // Cache for 1 min
        }
    }
    
    // 3. If still not found, fetch from Firestore and cache
    if (!device) {
        const deviceDoc = await db.collection('devices').doc(deviceId).get();
        if (deviceDoc.exists) {
            device = { ...deviceDoc.data(), id: deviceId } as Device;
            await hset(`device:${deviceId}`, device);
            await redis.sAdd('devices:all', deviceId);
            l1Cache.set(`device:${deviceId}`, device, 60 * 1000);
        } else {
            throw new Error(`Device ${deviceId} not found`);
        }
    }

    // 3. Update Redis immediately (Extremely fast)
    const reading = {
        device_id: deviceId,
        tds: data.tds,
        temperature: data.temperature || null,
        voltage: data.voltage || null,
        recorded_at: recordedAt.toISOString(),
        synced_at: null // Will be updated when flushed to Firestore
    };

    // Add to history list
    const key = `sensors:${deviceId}`;
    await redis.lPush(key, JSON.stringify(reading));
    await redis.lTrim(key, 0, 999);

    // Update device metadata in Redis
    const updatedDevice: Device = {
        ...device,
        last_reading_at: recordedAt.toISOString(),
        status: 'online', // Device just checked in
        last_tds: data.tds,
        updated_at: now.toISOString()
    };
    await hset(`device:${deviceId}`, updatedDevice);
    l1Cache.set(`device:${deviceId}`, updatedDevice, 60 * 1000); // Update L1 cache

    // 4. Queue for Firestore Batching
    sensorDataBuffer.push({
        ...reading,
        created_at: FieldValue.serverTimestamp()
    });

    // 5. Threshold Checking & Alerting
    await checkThresholds(updatedDevice, reading);

    // 6. Check if buffer needs flushing
    if (sensorDataBuffer.length >= BATCH_SIZE) {
        await flushSensorData();
    }

    return updatedDevice;
}

/**
 * Check TDS thresholds and create alerts if needed
 */
async function checkThresholds(device: Device, reading: any) {
    const min = device.safe_tds_min || TDS_CONFIG.RANGES.SAFE_MIN;
    const max = device.safe_tds_max || TDS_CONFIG.RANGES.SAFE_MAX;

    if (reading.tds < min || reading.tds > max) {
        console.log(`🚨 Threshold breach for ${device.name}: ${reading.tds} PPM (Range: ${min}-${max})`);
        
        // Check if we already have an open alert for this device to avoid spamming
        const openAlertId = await redis.sMembers(`device:${device.id}:alerts:open`);
        
        if (openAlertId.length === 0) {
            const alertData = {
                device_id: device.id,
                device_name: device.name,
                type: reading.tds > max ? 'TDS_HIGH' : 'TDS_LOW',
                severity: 'critical',
                message: `Critical TDS level detected: ${reading.tds} ppm. Safe range is ${min}-${max} ppm.`,
                value_at_time: reading.tds,
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Add to Redis first (immediate response)
            const alertId = `local_alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const fullAlert = { ...alertData, id: alertId };
            await hset(`alert:${alertId}`, fullAlert);
            await redis.sAdd('alerts:all', alertId);
            await redis.sAdd(`device:${device.id}:alerts`, alertId);
            await redis.sAdd(`device:${device.id}:alerts:open`, alertId);

            // Update device status in Redis immediately
            await hset(`device:${device.id}`, { ...device, status: 'critical' });
            
            // Background / Async Firestore sync (minimize blocking write latency)
            db.collection('alerts').add(alertData).then(alertRef => {
                // Update the temporary ID with real Firestore ID later if needed, or just let sync handle it
                redis.sAdd('alerts:all', alertRef.id);
                hset(`alert:${alertRef.id}`, { ...alertData, id: alertRef.id });
                redis.sAdd(`device:${device.id}:alerts`, alertRef.id);
                redis.sAdd(`device:${device.id}:alerts:open`, alertRef.id);
            }).catch(e => console.error("Firestore alert sync failed", e));
            
            db.collection('devices').doc(device.id).update({ status: 'critical', updated_at: new Date().toISOString() })
                .catch(e => console.error("Firestore status sync failed", e));
        }
    } else if (device.status === 'critical') {
        // Automatically resolve if back in range? 
        // For now, just mark online.
        await hset(`device:${device.id}`, { ...device, status: 'online' });
        
        // Async Firestore sync
        db.collection('devices').doc(device.id).update({ status: 'online', updated_at: new Date().toISOString() })
            .catch(e => console.error("Firestore status sync failed", e));
    }
}

/**
 * Flush buffered sensor data to Firestore in batches
 */
export async function flushSensorData() {
    if (sensorDataBuffer.length === 0) return;

    console.log(`💾 Flushing ${sensorDataBuffer.length} sensor readings to Firestore...`);
    const dataToFlush = [...sensorDataBuffer];
    sensorDataBuffer = [];

    const batch: WriteBatch = db.batch();
    
    dataToFlush.forEach(reading => {
        const docRef = db.collection('sensor_data').doc();
        batch.set(docRef, reading);
    });

    try {
        await batch.commit();
        console.log('✅ Firestore batch write successful');
    } catch (error) {
        console.error('❌ Firestore batch write failed:', error);
        // Put back in buffer? Or just log. For now, we rely on Redis for history.
    }
}

// Start periodic flush
setInterval(flushSensorData, FLUSH_INTERVAL);
