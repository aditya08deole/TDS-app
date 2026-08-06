import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { Device, Alert } from '../types';

// Lazy getters — called only after Firebase is initialized, never at import time
function getDb() { return getFirestore(); }
function getMsg() { return getMessaging(); }
function getRedis() { return getRedisClient(); }

// ─── Redis Key Patterns ───────────────────────────────────────────────────────

// Cache of all registered FCM tokens
export const FCM_TOKEN_CACHE_KEY = 'cache:fcm_tokens';

// Per-device 30-minute suppression key — set when first alert fires
// Prevents notification spam for the same device within 30 minutes
const SUPPRESSION_KEY = (deviceId: string) => `notif:suppressed:${deviceId}`;
const SUPPRESSION_TTL = 30 * 60; // 30 minutes in seconds

// Per-device 30-minute resolved cooldown — set when admin/maintenance resolves an alert
// Prevents re-notification even if TDS is still breaching, for 30 minutes post-resolution
export const RESOLVED_COOLDOWN_KEY = (deviceId: string) => `notif:resolved_cooldown:${deviceId}`;
export const RESOLVED_COOLDOWN_TTL = 30 * 60; // 30 minutes in seconds

// ─── Delivery Deduplication (per alert per channel, 10 min TTL) ──────────────
// Prevents the onSnapshot listener from sending duplicate FCM for the same alertId
// in the rare case of Firestore double-firing or race conditions
const DELIVERY_DEDUPE_KEY = (alertId: string) => `notif:dedupe:push:${alertId}`;
const DELIVERY_DEDUPE_TTL = 10 * 60; // 10 minutes

// ─── Formatting Helpers ───────────────────────────────────────────────────────

const IST_FORMATTER = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
});

function toIST(dateInput: unknown): string {
    try {
        const date = dateInput ? new Date(String(dateInput)) : new Date();
        if (Number.isNaN(date.getTime())) return IST_FORMATTER.format(new Date()) + ' IST';
        return `${IST_FORMATTER.format(date)} IST`;
    } catch {
        return `${IST_FORMATTER.format(new Date())} IST`;
    }
}

function formatAlertContext(alertData: any) {
    const location = alertData.location_name || alertData.device_name || alertData.device_id || 'Unknown location';
    const ppm = alertData.value_at_time ?? alertData.tds_value ?? 'N/A';
    const time = toIST(alertData.recorded_at || alertData.created_at || new Date().toISOString());
    return { location, ppm, time };
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(operation: () => Promise<T>, retries = 1): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

// ─── Suppression Check ────────────────────────────────────────────────────────

/**
 * Industry-standard per-device circuit breaker.
 * Returns true if we should SKIP sending a notification for this device.
 *
 * Two suppression sources:
 * 1. Recent alert already sent (30-min cooldown after first notification)
 * 2. Alert was manually resolved (30-min grace period post-resolution)
 */
export async function isDeviceSuppressed(deviceId: string): Promise<boolean> {
    const redis = getRedis();

    // Check 1: Was a notification already sent recently for this device?
    const suppressed = await redis.exists(SUPPRESSION_KEY(deviceId));
    if (suppressed === 1) {
        console.log(`🔕 [SUPPRESSED] Device ${deviceId} is in 30-min alert cooldown — skipping`);
        return true;
    }

    // Check 2: Was this device's alert manually resolved recently?
    const resolvedCooldown = await redis.exists(RESOLVED_COOLDOWN_KEY(deviceId));
    if (resolvedCooldown === 1) {
        console.log(`🔕 [RESOLVED COOLDOWN] Device ${deviceId} was recently resolved — skipping for 30min`);
        return true;
    }

    return false;
}

/**
 * Mark a device as "notified" — suppresses further alerts for 30 minutes.
 * Called immediately after a notification is successfully dispatched.
 */
export async function setDeviceSuppression(deviceId: string): Promise<void> {
    await getRedis().set(SUPPRESSION_KEY(deviceId), '1', { EX: SUPPRESSION_TTL });
    console.log(`🔒 [SUPPRESSION SET] Device ${deviceId} suppressed for 30 minutes`);
}

/**
 * Check whether this specific alertId already had FCM dispatched (within 10 min).
 * Protects against Firestore onSnapshot double-firing the same event.
 */
async function isAlertAlreadyDispatched(alertId: string): Promise<boolean> {
    const redis = getRedis();
    const key = DELIVERY_DEDUPE_KEY(alertId);
    const exists = await redis.exists(key);
    if (exists === 1) return true;
    await redis.set(key, '1', { EX: DELIVERY_DEDUPE_TTL });
    return false;
}

// ─── Delivery Logging ─────────────────────────────────────────────────────────

/**
 * Writes notification delivery results into the alert document and a delivery log.
 * Skips writing for virtual/internal alert IDs (test-, report-).
 */
async function writeDeliveryLog(entry: Record<string, any>) {
    const { status, channel, reason, alert_id, error } = entry;
    const db = getDb();

    if (!alert_id || alert_id.startsWith('test-') || alert_id.startsWith('report-')) {
        console.log(`ℹ️ [LOG:INTERNAL] Skipping delivery log for virtual alert: ${alert_id}`);
        return;
    }

    // Update the alert document with delivery history
    try {
        const alertRef = db.collection('alerts').doc(alert_id);
        const alertSnap = await alertRef.get();

        if (!alertSnap.exists) {
            console.log(`ℹ️ [LOG:SKIP] Alert doc ${alert_id} not found — skipping log.`);
            return;
        }

        const updateData: any = { last_notified_at: new Date().toISOString() };
        updateData[`delivery_history.${channel}`] = {
            status,
            timestamp: new Date().toISOString(),
            reason: reason || error || 'Processed',
            success: status === 'success' || status === 'partial'
        };

        await alertRef.update(updateData);
    } catch (err) {
        console.warn(`⚠️ [LOG] Could not update Alert ${alert_id}:`, (err as any).message);
    }

    // Write to delivery logs collection
    try {
        await db.collection('notification_delivery_logs').add({
            ...entry,
            created_at: new Date().toISOString(),
        });
        if (status === 'failed' || status === 'partial') {
            console.error(`❌ [PUSH LOG:${status.toUpperCase()}] Alert ${alert_id}: ${error || 'Unknown error'}`);
        } else {
            console.log(`✅ [PUSH LOG:${status.toUpperCase()}] Alert ${alert_id}`);
        }
    } catch (err) {
        console.error('❌ Failed to write delivery log:', err);
    }
}

// ─── FCM Push Notification ────────────────────────────────────────────────────

/**
 * Sends an FCM multicast push notification to ALL registered device tokens.
 *
 * Industry-grade approach:
 * - Reads tokens from Redis cache first (sub-millisecond), falls back to Firestore
 * - Sends a single multicast call for all tokens (efficient, one API call)
 * - Automatically removes stale/invalid tokens from Firestore + Redis on failure
 * - Retries once on transient errors
 *
 * @param alertId - Firestore alert document ID
 * @param alertData - Alert data object (device_id, message, severity, etc.)
 * @param isReminder - true for hourly reminder notifications (skips dedupe check)
 */
export async function sendPushNotification(alertId: string, alertData: any, isReminder = false): Promise<void> {
    try {
        const deviceId = alertData.device_id || '';

        // ── MANDATORY PER-DEVICE SUPPRESSION & RESOLVED COOLDOWN GATE ──
        if (deviceId) {
            const redis = getRedis();
            // 1. HARD STOP: If device was manually resolved in last 30 min, BLOCK ALL DISPATCH (reminders included)
            const resolvedCooldown = await redis.exists(RESOLVED_COOLDOWN_KEY(deviceId));
            if (resolvedCooldown === 1) {
                console.log(`🔒 [FCM GATE] Device ${deviceId} was recently RESOLVED — hard stop active for 30min`);
                return;
            }

            // 2. Alert Cooldown: If notification sent in last 30 min, block repeat dispatches
            if (!isReminder) {
                const suppressed = await redis.exists(SUPPRESSION_KEY(deviceId));
                if (suppressed === 1) {
                    console.log(`🔕 [FCM GATE] Device ${deviceId} is in 30-min alert cooldown — DISPATCH BLOCKED`);
                    return;
                }
            }
        }

        // Dedupe guard: don't fire twice for the same alert within 10 min
        // Reminder calls bypass this since they are intentional repeat sends
        if (!isReminder) {
            const alreadySent = await isAlertAlreadyDispatched(alertId);
            if (alreadySent) {
                console.log(`⚡ [FCM] Alert ${alertId} already dispatched (dedupe) — skipping`);
                await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'dedupe' });
                return;
            }
        }

        const messaging = getMsg();
        const redis = getRedis();
        const db = getDb();

        // ── Token Collection: Redis Cache → Firestore Fallback ──
        const tokenSet = new Set<string>();
        const allCached = await redis.sMembers(FCM_TOKEN_CACHE_KEY);
        allCached.forEach((t: string) => tokenSet.add(t));

        if (tokenSet.size === 0) {
            // Cold-start: query Firestore directly
            console.log(`[FCM] Cache cold — loading tokens from Firestore...`);
            const allSnap = await db.collection('notification_subscriptions').get();
            allSnap.docs.forEach(doc => {
                const t = doc.data().token;
                if (t) tokenSet.add(t);
            });
        }

        const tokens = Array.from(tokenSet);

        if (tokens.length === 0) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'no_tokens_found' });
            console.warn(`[FCM] ❌ No FCM tokens found for alert ${alertId}`);
            return;
        }

        const { location, ppm, time } = formatAlertContext(alertData);

        const title = isReminder
            ? `⏰ Reminder: TDS Alert at ${location}`
            : `🚨 Critical TDS Alert: ${location}`;

        const body = `${ppm} ppm detected at ${time}`;

        // ── FCM Multicast Payload ──
        const message = {
            notification: { title, body },
            data: {
                alertId,
                deviceId: String(deviceId),
                severity: alertData.severity || 'critical',
                location_name: String(location),
                ppm: String(ppm),
                recorded_at: String(time),
                isReminder: String(isReminder),
                url: '/alerts',
                click_action: 'FLUTTER_NOTIFICATION_CLICK', // Android compatibility
            },
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: 'tds_alerts',
                    sound: 'default',
                    priority: 'high' as const,
                    defaultVibrateTimings: true,
                    visibility: 'public' as const,
                },
            },
            apns: {
                headers: { 'apns-priority': '10' },
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true,
                    },
                },
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: {
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    requireInteraction: !isReminder, // Keep critical alerts persistent on screen
                },
            },
            tokens,
        };

        console.log(`[FCM] 🚀 Sending ${isReminder ? 'REMINDER' : 'ALERT'} to ${tokens.length} token(s) — Alert: ${alertId}`);
        const response = await withRetry(() => messaging.sendEachForMulticast(message), 1);

        await writeDeliveryLog({
            alert_id: alertId,
            channel: 'push',
            status: response.failureCount > 0 ? 'partial' : 'success',
            success_count: response.successCount,
            failure_count: response.failureCount,
            is_reminder: isReminder,
            token_count: tokens.length,
        });

        console.log(`[FCM] ✅ Alert ${alertId}: ${response.successCount}/${tokens.length} delivered, ${response.failureCount} failed`);

        // ── Stale Token Cleanup ──
        // If a token is invalid, remove it from Firestore and Redis cache immediately
        if (response.failureCount > 0) {
            const staleTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code ?? '';
                    const isStale =
                        code === 'messaging/registration-token-not-registered' ||
                        code === 'messaging/invalid-registration-token';
                    if (isStale) {
                        staleTokens.push(tokens[idx]);
                        console.warn(`[FCM] Stale token detected — scheduling removal: ...${tokens[idx].slice(-8)}`);
                    }
                }
            });

            if (staleTokens.length > 0) {
                // Fire-and-forget cleanup — don't block the main flow
                (async () => {
                    for (const staleToken of staleTokens) {
                        try {
                            const snap = await db.collection('notification_subscriptions')
                                .where('token', '==', staleToken)
                                .get();
                            const batch = db.batch();
                            snap.docs.forEach(d => batch.delete(d.ref));
                            await batch.commit();
                            await redis.sRem(FCM_TOKEN_CACHE_KEY, staleToken);
                            console.log(`🗑️ [FCM] Removed stale token from Firestore and Redis cache`);
                        } catch (cleanupErr) {
                            console.warn('[FCM] Stale token cleanup error:', cleanupErr);
                        }
                    }
                })().catch(() => {});
            }
        }
    } catch (error) {
        console.error('❌ [FCM] Error sending push notification:', error);
        await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'failed', error: String(error) });
    }
}

// ─── FCM Token Cache Management ───────────────────────────────────────────────

/**
 * Pre-warm the FCM token Redis cache on backend startup.
 * Ensures push notifications work immediately even on first boot,
 * before any Firestore onSnapshot events have fired.
 */
export async function warmFCMCache(): Promise<void> {
    try {
        const db = getDb();
        const redis = getRedis();
        const snapshot = await db.collection('notification_subscriptions').get();

        if (snapshot.empty) {
            console.log('ℹ️ [FCM WARM] No subscriptions found — cache stays empty.');
            return;
        }

        const batch = redis.multi();
        let total = 0;
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (d.token) {
                batch.sAdd(FCM_TOKEN_CACHE_KEY, d.token);
                if (d.user_id && d.user_id !== 'anonymous') {
                    batch.sAdd(`cache:user_tokens:${d.user_id}`, d.token);
                    batch.expire(`cache:user_tokens:${d.user_id}`, 86400);
                }
                total++;
            }
        });
        await batch.exec();
        console.log(`🔥 [FCM WARM] Pre-cached ${total} FCM tokens from ${snapshot.size} subscriptions.`);
    } catch (err) {
        console.warn('⚠️ [FCM WARM] Cache warm-up failed (non-fatal):', err);
    }
}

// ─── Real-Time Firestore Listeners ────────────────────────────────────────────

/**
 * Starts real-time Firestore listeners for alerts, devices, and subscriptions.
 *
 * Alert Listener:
 * - On new open alert → sends FCM push immediately (sub-100ms after Firestore write)
 * - Validates device exists before dispatching (phantom guard)
 * - Uses delivery dedupe to prevent double-firing
 *
 * Device Listener:
 * - Keeps Redis device cache in sync
 * - Auto-resolves orphaned alerts when a device is deleted
 *
 * Subscription Listener:
 * - Keeps FCM token Redis cache in sync as users subscribe/unsubscribe
 */
export function startNotificationListeners(): void {
    console.log('📡 Starting real-time Firestore notification listeners...');
    const db = getDb();
    const redis = getRedis();

    // ── Alert Listener ──
    db.collection('alerts').onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const alertData = change.doc.data() as Alert;
            const alertId = change.doc.id;
            const deviceId = typeof alertData.device_id === 'object' && alertData.device_id !== null
                ? (alertData.device_id as any).id
                : String(alertData.device_id);

            if (change.type === 'added' || change.type === 'modified') {
                // Sync to Redis cache
                const fullAlert = { ...alertData, id: alertId, device_id: deviceId };
                await hset(`alert:${alertId}`, fullAlert);
                await redis.sAdd('alerts:all', alertId);
                await redis.sAdd(`device:${deviceId}:alerts`, alertId);

                if (alertData.status === 'open') {
                    await redis.sAdd(`device:${deviceId}:alerts:open`, alertId);
                } else {
                    await redis.sRem(`device:${deviceId}:alerts:open`, alertId);
                }

                // ── Dispatch FCM on NEW open alerts only ──
                if (change.type === 'added' && alertData.status === 'open') {
                    const createdAtRaw = alertData.created_at as any;
                    const createdAt = createdAtRaw?.toDate ? createdAtRaw.toDate() : new Date(alertData.created_at);
                    const isRecent = (Date.now() - createdAt.getTime()) < 60000; // Must be within last 60 seconds

                    if (!isRecent) {
                        console.log(`[LISTENER] Alert ${alertId} is stale (>60s old) — skipping FCM dispatch`);
                        continue;
                    }

                    // Phantom Guard: verify device actually exists
                    const deviceSnap = await db.collection('devices').doc(deviceId).get();
                    if (!deviceSnap.exists) {
                        console.warn(`⚠️ [PHANTOM GUARD] Alert ${alertId} references non-existent device ${deviceId} — skipping`);
                        continue;
                    }

                    // Check per-device suppression & resolution cooldown before listener dispatch
                    if (deviceId) {
                        const suppressed = await isDeviceSuppressed(deviceId);
                        if (suppressed) {
                            console.log(`🔕 [LISTENER] Device ${deviceId} is currently in 30-min cooldown — skipping FCM dispatch`);
                            continue;
                        }
                    }

                    // ── INSTANT FCM DISPATCH ──
                    console.log(`🚨 [LISTENER] New alert for device ${deviceId}: ${alertData.message}`);
                    await sendPushNotification(alertId, { ...alertData, device_id: deviceId });
                }

            } else if (change.type === 'removed') {
                // Clean up Redis on alert deletion
                await redis.del(`alert:${alertId}`);
                await redis.sRem('alerts:all', alertId);
                await redis.sRem(`device:${deviceId}:alerts`, alertId);
                await redis.sRem(`device:${deviceId}:alerts:open`, alertId);
                await redis.del(DELIVERY_DEDUPE_KEY(alertId));
            }
        }
    }, (error) => { console.error('❌ Firestore Alert Listener Error:', error); });

    // ── Device Listener ──
    db.collection('devices').onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const deviceData = change.doc.data() as Device;
            const deviceId = change.doc.id;

            if (change.type === 'added' || change.type === 'modified') {
                if (deviceData.name) {
                    await hset(`device:${deviceId}`, { ...deviceData, id: deviceId });
                    await redis.sAdd('devices:all', deviceId);
                }
            } else if (change.type === 'removed') {
                // Auto-resolve orphaned alerts when device is deleted
                try {
                    const openAlertsSnap = await db.collection('alerts')
                        .where('device_id', '==', deviceId)
                        .where('status', '==', 'open')
                        .get();

                    if (!openAlertsSnap.empty) {
                        const batch = db.batch();
                        const resolvedAt = new Date().toISOString();
                        openAlertsSnap.docs.forEach(doc => {
                            batch.update(doc.ref, {
                                status: 'resolved',
                                resolved_at: resolvedAt,
                                resolution_note: 'Auto-resolved: device was deleted',
                            });
                        });
                        await batch.commit();
                        console.log(`🧹 [ORPHAN CLEANUP] Resolved ${openAlertsSnap.size} alert(s) for deleted device ${deviceId}`);
                    }
                } catch (cleanupErr) {
                    console.error(`❌ [ORPHAN CLEANUP] Failed for device ${deviceId}:`, cleanupErr);
                }

                // Clean all device-related Redis keys
                const keysToDelete = [
                    `device:${deviceId}`,
                    `sensors:${deviceId}`,
                    `device:${deviceId}:alerts`,
                    `device:${deviceId}:alerts:open`,
                    `device:${deviceId}:uptime_records`,
                    SUPPRESSION_KEY(deviceId),
                    RESOLVED_COOLDOWN_KEY(deviceId),
                ];

                await Promise.all(keysToDelete.map(key => redis.del(key)));
                await redis.sRem('devices:all', deviceId);
            }
        }
    }, (error) => { console.error('❌ Firestore Device Listener Error:', error); });

    // ── Subscription / FCM Token Listener ──
    db.collection('notification_subscriptions').onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const data = change.doc.data();
            const token = data.token;
            const userId = data.user_id;
            if (!token) continue;

            if (change.type === 'added' || change.type === 'modified') {
                await redis.sAdd(FCM_TOKEN_CACHE_KEY, token);
                if (userId) {
                    await redis.sAdd(`cache:user_tokens:${userId}`, token);
                    await redis.expire(`cache:user_tokens:${userId}`, 86400);
                }
            } else if (change.type === 'removed') {
                await redis.sRem(FCM_TOKEN_CACHE_KEY, token);
                if (userId) await redis.sRem(`cache:user_tokens:${userId}`, token);
            }
        }

        // Seed cache if it is empty but we have subscriptions
        const count = await redis.sCard(FCM_TOKEN_CACHE_KEY);
        if (count === 0 && !snapshot.empty) {
            console.log(`🚀 Seeding FCM token cache from ${snapshot.size} subscriptions...`);
            const batch = redis.multi();
            let total = 0;
            snapshot.docs.forEach(doc => {
                const d = doc.data();
                if (d.token) {
                    batch.sAdd(FCM_TOKEN_CACHE_KEY, d.token);
                    if (d.user_id) batch.sAdd(`cache:user_tokens:${d.user_id}`, d.token);
                    total++;
                }
            });
            await batch.exec();
            console.log(`✅ Pre-cached ${total} FCM tokens in Redis.`);
        }
    }, (error) => { console.error('❌ Firestore Subscription Listener Error:', error); });
}

// ─── Hourly Reminder Job ──────────────────────────────────────────────────────

/**
 * Sends FCM reminder notifications for all devices that still have open critical alerts.
 * Runs every hour via the scheduler cron job.
 *
 * Algorithm:
 * 1. Scan all device IDs in Redis
 * 2. For each device with open alert(s), verify the alert is still open in Firestore
 * 3. Refresh PPM from the device's latest Firestore reading (not stale cache)
 * 4. Send FCM reminder (isReminder = true → skips delivery dedupe)
 */
export async function sendHourlyReminders(): Promise<void> {
    console.log('⏰ [REMINDER JOB] Starting hourly FCM reminder scan...');
    const redis = getRedis();
    const db = getDb();
    const deviceIds = await redis.sMembers('devices:all');

    if (!deviceIds || deviceIds.length === 0) {
        console.log('ℹ️ [REMINDER JOB] No devices in Redis — nothing to remind.');
        return;
    }

    let dispatchCount = 0;

    for (const id of deviceIds) {
        try {
            const device = await hgetall<Device>(`device:${id}`);
            if (!device) continue;

            // Only remind for devices actively in critical state
            const deviceStatus = String((device as any).status || '').toLowerCase();
            if (deviceStatus !== 'critical') continue;

            const openAlertIds = await redis.sMembers(`device:${id}:alerts:open`);
            if (!openAlertIds || openAlertIds.length === 0) continue;

            const alertId = openAlertIds[0];

            // Verify alert is still open in Firestore (source of truth)
            const fsAlert = await db.collection('alerts').doc(alertId).get();
            if (!fsAlert.exists || fsAlert.data()?.status !== 'open') {
                // Alert was resolved externally — clean up stale Redis tracking
                await redis.sRem(`device:${id}:alerts:open`, alertId);
                continue;
            }

            // Build alert data with FRESH PPM from the device's latest reading
            // (cached alertData has the original breach time frozen — we want current)
            const alertData: any = { ...fsAlert.data() };
            try {
                const deviceDoc = await db.collection('devices').doc(id).get();
                if (deviceDoc.exists) {
                    const fresh = deviceDoc.data()!;
                    if (fresh.last_tds != null)    alertData.value_at_time = fresh.last_tds;
                    if (fresh.last_reading_at)     alertData.recorded_at   = fresh.last_reading_at;
                    console.log(`🔄 [REMINDER JOB] Refreshed device ${device.name || id}: ppm=${fresh.last_tds}`);
                }
            } catch (refreshErr) {
                console.warn(`⚠️ [REMINDER JOB] Could not refresh device ${id}:`, refreshErr);
            }

            console.log(`🔔 [REMINDER JOB] Sending FCM hourly reminder for device: ${device.name || id}`);
            await sendPushNotification(alertId, alertData, true); // isReminder = true
            dispatchCount++;

        } catch (error) {
            console.error(`❌ [REMINDER JOB] Failed for device ${id}:`, error);
        }
    }

    console.log(`✅ [REMINDER JOB] Completed. Reminded ${dispatchCount} device(s).`);
}

// ─── Force Critical Alert (Ghost Engine / ThingSpeak) ────────────────────────

/**
 * Triggered by the ThingSpeak Ghost Engine for a single device.
 * Uses a stable per-device alert ID to update the same Firestore card
 * and fires an FCM notification if it's been more than 1 hour since last notify.
 */
export async function triggerForceDeviceAlert(deviceId: string, tds: number, timestamp: string): Promise<void> {
    // ── Per-Device Suppression & Cooldown Gate ──
    // Check if device is in 30-min alert cooldown OR 30-min resolved cooldown.
    // Respects operator resolution: if resolved, wait 30 min before allowing new alerts for this device.
    const suppressed = await isDeviceSuppressed(deviceId);
    if (suppressed) {
        console.log(`⏱️ [GHOST] Device ${deviceId} is currently suppressed/in cooldown (30-min window). Skipping alert update & push.`);
        return;
    }

    const db = getDb();
    const deviceSnap = await db.collection('devices').doc(deviceId).get();
    if (!deviceSnap.exists) return;

    const deviceData = deviceSnap.data() as any;
    const alertId = `active-alert-${deviceId}`; // Stable ID for this device

    const existingAlert = await db.collection('alerts').doc(alertId).get();
    const isNew = !existingAlert.exists || existingAlert.data()?.status !== 'open';

    const alertData = {
        device_id: deviceId,
        device_name: deviceData.name || deviceId,
        location_name: deviceData.location_name || deviceData.name || 'N/A',
        message: `CRITICAL TDS DETECTED: ${tds} PPM (Autonomous Scan)`,
        severity: 'critical',
        status: 'open',
        value_at_time: tds,
        recorded_at: timestamp,
        created_at: isNew ? timestamp : existingAlert.data()?.created_at,
        updated_at: timestamp,
        type: 'AUTO_SCAN',
    };

    // Persist to Firestore
    try {
        await db.collection('alerts').doc(alertId).set(alertData, { merge: true });
        console.log(`📡 [GHOST] Updated alert: ${alertId} | TDS=${tds} PPM`);
    } catch (e) {
        console.error('[GHOST] Failed to update ghost alert record', e);
    }

    // Fire FCM if brand new or last notify was >1 hour ago
    const lastNotified = existingAlert.data()?.last_notified_at
        ? new Date(existingAlert.data()!.last_notified_at).getTime()
        : 0;
    const ONE_HOUR_MS = 60 * 60 * 1000;

    if (isNew || (Date.now() - lastNotified >= ONE_HOUR_MS)) {
        console.log(`🔥 [GHOST] FCM notification for device ${deviceId} | TDS=${tds} PPM`);
        await sendPushNotification(alertId, alertData, false);
        await setDeviceSuppression(deviceId);
    }
}

// Export sendPushNotification for use by the scheduler's force engine
export { sendPushNotification as sendForcePushNotification };