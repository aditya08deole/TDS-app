import { getFirestore, WriteBatch, FieldValue } from 'firebase-admin/firestore';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { l1Cache } from '../db/cache';
import { Device, SensorData } from '../types';
import { TDS_CONFIG } from '../config/tdsConfig';
import { processThresholdBreach, ACK_COOLDOWN_KEY, RESOLVED_COOLDOWN_KEY } from './notificationService';

// Lazy getters — only called after Firebase/Redis are initialized, never at import time
function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

// Redis key for telemetry buffer
const REDIS_BUFFER_KEY = 'telemetry:buffer';
const BATCH_SIZE = 450; // Firestore limit is 500, keeping buffer room
const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Auto-resolve any open/acknowledged alerts for a device once it has
 * recovered (RECOVERY_THRESHOLD consecutive safe readings). Runs server-side
 * so recovery doesn't depend on a browser tab being open (previously this
 * was only handled client-side in AlertContext.tsx as a "backup").
 */
async function autoResolveDeviceAlerts(deviceId: string): Promise<void> {
    const db = getDb();
    const redis = getRedis();
    const resolvedAt = new Date().toISOString();

    try {
        const openSnap = await db.collection('alerts')
            .where('device_id', '==', deviceId)
            .where('status', 'in', ['open', 'acknowledged'])
            .get();

        if (openSnap.empty) return;

        const batch = db.batch();
        openSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                status: 'resolved',
                resolved_at: resolvedAt,
                resolved_by: 'system_auto_recovery',
                resolution_note: 'Auto-resolved: device reported safe TDS readings',
                updated_at: resolvedAt,
            });
        });
        await batch.commit();

        console.log(`✅ [AUTO-RECOVERY] Resolved ${openSnap.size} alert(s) for recovered device ${deviceId}`);

        // Clear Redis open-alert tracking and the alert-cooldown suppression key
        // so a fresh breach on this device can alert immediately rather than
        // waiting out a stale 30-min window from before the recovery.
        await Promise.all([
            redis.del(`device:${deviceId}:alerts:open`),
            redis.del(ACK_COOLDOWN_KEY(deviceId)),
            redis.del(RESOLVED_COOLDOWN_KEY(deviceId)),
        ]);
    } catch (e) {
        console.error(`❌ [AUTO-RECOVERY] Failed to auto-resolve alerts for device ${deviceId}:`, e);
    }
}

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

        // Update device status/last reading in Redis immediately regardless of
        // notification outcome, so the dashboard always shows current TDS.
        await hset(`device:${device.id}`, { ...device, status: 'critical', last_tds: reading.tds });

        // processThresholdBreach owns the full alert lifecycle: create a new
        // alert, re-notify on every reading while unacknowledged, or reopen
        // after the 1-hour post-acknowledge quiet period if still breaching.
        const locationName = device.location_name || device.name || device.id;
        await processThresholdBreach(
            device.id,
            device.name,
            locationName,
            reading.tds,
            min,
            max,
            recordedAt.toISOString(),
        ).catch(e => console.error('processThresholdBreach failed', e));

        getDb().collection('devices').doc(device.id).update({ status: 'critical', updated_at: new Date().toISOString() })
            .catch(e => console.error('Firestore device status sync failed', e));
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

                // Auto-resolve any open/acknowledged alerts now that the device has recovered
                autoResolveDeviceAlerts(device.id).catch(e => console.error("Auto-resolve on recovery failed", e));
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
