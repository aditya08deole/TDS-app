import { getFirestore, WriteBatch, FieldValue } from 'firebase-admin/firestore';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, SensorData } from '../types';
import { TDS_CONFIG } from '../config/tdsConfig';
import { isDeviceSuppressed, setDeviceSuppression } from './notificationService';

// Lazy getters — only called after Firebase/Redis are initialized, never at import time
function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

// Redis key for telemetry buffer
const REDIS_BUFFER_KEY = 'telemetry:buffer';
const BATCH_SIZE = 450; // Firestore limit is 500, keeping buffer room
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
        const deviceDoc = await getDb().collection('devices').doc(deviceId).get();
        if (deviceDoc.exists) {
            device = { ...deviceDoc.data(), id: deviceId } as Device;
            await hset(`device:${deviceId}`, device);
            await getRedis().sAdd('devices:all', deviceId);
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
    await getRedis().lPush(key, JSON.stringify(reading));
    await getRedis().lTrim(key, 0, 999);

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

    // 4. Queue for Firestore Batching via Redis (Persistent Buffer)
    const firestoreEntry = {
        ...reading,
        created_at: FieldValue.serverTimestamp()
    };
    await getRedis().rPush(REDIS_BUFFER_KEY, JSON.stringify(firestoreEntry));

    // 5. Threshold Checking & Alerting
    await checkThresholds(updatedDevice, reading, recordedAt);

    // 6. Check if buffer needs flushing (Active check for high traffic)
    const bufferSize = await getRedis().lLen(REDIS_BUFFER_KEY);
    if (bufferSize >= BATCH_SIZE) {
        // Trigger async flush, don't wait to avoid blocking telemetry ingestion
        flushSensorData().catch(e => console.error("Auto-flush failed", e));
    }

    return updatedDevice;
}

/**
 * Check TDS thresholds and create alerts if needed
 */
async function checkThresholds(device: Device, reading: any, recordedAt: Date) {
    const min = device.safe_tds_min || TDS_CONFIG.RANGES.SAFE_MIN;
    const max = device.safe_tds_max || TDS_CONFIG.RANGES.SAFE_MAX;
    const RECOVERY_THRESHOLD = 3;
    const recoveryKey = `device:${device.id}:recovery_count`;

    const isBreached = reading.tds < min || reading.tds > max;

    if (isBreached) {
        // 1. Reset recovery counter if we are still in breach
        await getRedis().del(recoveryKey);

        console.log(`🚨 Threshold breach for ${device.name}: ${reading.tds} PPM (Range: ${min}-${max})`);

        // ── Per-Device Circuit Breaker ──
        // Check both suppression keys BEFORE creating any alert or triggering FCM.
        // This is the primary anti-spam gate — each device has its own independent key.
        // Devices in cooldown still get their Redis state updated (last_tds, status)
        // but no new Firestore alert or push notification is created.
        const suppressed = await isDeviceSuppressed(device.id);
        if (suppressed) {
            // Still update device status in Redis so dashboard shows current TDS
            await hset(`device:${device.id}`, { ...device, status: 'critical', last_tds: reading.tds });
            return;
        }

        // Check if we already have an open alert tracked in Redis
        const openAlertIds = await getRedis().sMembers(`device:${device.id}:alerts:open`);

        if (openAlertIds.length === 0) {
            const locationName = device.location_name || device.name || device.id;
            const recordedAtISO = recordedAt.toISOString();
            const alertData = {
                device_id: device.id,
                device_name: device.name,
                location_name: locationName,
                type: reading.tds > max ? 'TDS_HIGH' : 'TDS_LOW',
                severity: 'critical',
                message: `Critical TDS level detected at ${locationName}: ${reading.tds} ppm. Safe range is ${min}-${max} ppm.`,
                value_at_time: reading.tds,
                recorded_at: recordedAtISO,
                status: 'open',
                created_at: recordedAtISO,
                updated_at: recordedAtISO
            };

            // Update device status in Redis immediately (before Firestore write)
            await hset(`device:${device.id}`, { ...device, status: 'critical' });

            // Set 30-min suppression key BEFORE Firestore write
            // This ensures no duplicate alerts even if the onSnapshot fires rapidly
            await setDeviceSuppression(device.id);

            // Write alert to Firestore — this triggers the onSnapshot listener
            // which dispatches the FCM push notification
            getDb().collection('alerts').add(alertData).then(alertRef => {
                getRedis().sAdd('alerts:all', alertRef.id);
                hset(`alert:${alertRef.id}`, { ...alertData, id: alertRef.id });
                getRedis().sAdd(`device:${device.id}:alerts`, alertRef.id);
                getRedis().sAdd(`device:${device.id}:alerts:open`, alertRef.id);
                console.log(`✅ [ALERT CREATED] Alert ${alertRef.id} for device ${device.id} written to Firestore`);
            }).catch(e => console.error('Firestore alert sync failed', e));

            getDb().collection('devices').doc(device.id).update({ status: 'critical', updated_at: new Date().toISOString() })
                .catch(e => console.error('Firestore device status sync failed', e));
        }
    } else {
        // 2. Reading is safe. Check if we need to recover.
        if (device.status === 'critical') {
            const currentCount = await getRedis().incr(recoveryKey);
            await getRedis().expire(recoveryKey, 300); // 5 min TTL for recovery counter

            if (currentCount >= RECOVERY_THRESHOLD) {
                console.log(`✅ Device ${device.name} recovered after ${currentCount} safe readings.`);
                await getRedis().del(recoveryKey);
                
                // Update state to online
                await hset(`device:${device.id}`, { ...device, status: 'online' });
                
                // Async Firestore sync
                getDb().collection('devices').doc(device.id).update({ status: 'online', updated_at: new Date().toISOString() })
                    .catch(e => console.error("Firestore recovery sync failed", e));
                
                // Note: Auto-resolving alerts can be added here if desired.
            } else {
                console.log(`ℹ️ Device ${device.name} reading safe (${reading.tds} PPM), recovery count: ${currentCount}/${RECOVERY_THRESHOLD}`);
            }
        } else {
            // Already online, just ensure counter is clean
            await getRedis().del(recoveryKey);
        }
    }
}

/**
 * Flush buffered sensor data from Redis to Firestore in batches.
 * Uses a "read-then-trim" strategy to ensure zero data loss on failures.
 */
export async function flushSensorData() {
    try {
        const redis = getRedis();
        const bufferSize = await redis.lLen(REDIS_BUFFER_KEY);
        
        if (bufferSize === 0) return;

        // Limit the number of items to process in one batch
        const count = Math.min(bufferSize, BATCH_SIZE);
        console.log(`💾 Flushing ${count} sensor readings from Redis to Firestore...`);

        // 1. Get items from Redis
        const rawData = await redis.lRange(REDIS_BUFFER_KEY, 0, count - 1);
        if (!rawData || rawData.length === 0) return;

        const batch: WriteBatch = getDb().batch();
        
        rawData.forEach((json: string) => {
            try {
                const reading = JSON.parse(json);
                const docRef = getDb().collection('sensor_data').doc();
                batch.set(docRef, reading);
            } catch (pError) {
                console.error("Failed to parse buffered telemetry JSON", pError);
            }
        });

        // 2. Commit to Firestore
        await batch.commit();
        
        // 3. ONLY trim from Redis after successful Firestore commit
        await redis.lTrim(REDIS_BUFFER_KEY, count, -1);
        
        console.log(`✅ Successfully flushed ${count} readings to Firestore.`);
        
        // If there's still a lot of data, trigger another flush immediately
        const remaining = await redis.lLen(REDIS_BUFFER_KEY);
        if (remaining >= BATCH_SIZE) {
            setImmediate(() => flushSensorData().catch(e => console.error("Recursive flush failed", e)));
        }
    } catch (error) {
        console.error('❌ Firestore batch flush failed. Data remains in Redis for retry:', error);
    }
}

// ─── Telemetry Auto-Flush ────────────────────────────────────────────────────
// Fix #11: setInterval was previously called at module import time, before
// Firebase/Redis were initialized. On slow startups this caused:
// "Redis client not initialized. Call initializeRedis() first."
//
// Now the interval is started explicitly by server.ts AFTER all services init.
let flushInterval: ReturnType<typeof setInterval> | null = null;

export function startTelemetryFlusher(): void {
    if (flushInterval) return; // already running
    flushInterval = setInterval(() => {
        flushSensorData().catch(e => console.error('❌ Periodic telemetry flush failed:', e));
    }, FLUSH_INTERVAL);
    console.log(`✅ Telemetry auto-flush started (every ${FLUSH_INTERVAL / 60000} min).`);
}

export function stopTelemetryFlusher(): void {
    if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
        console.log('⏹️ Telemetry auto-flush stopped.');
    }
}
