import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getRedisClient, hset, hgetall } from '../db/redis';
import { Device, Alert } from '../types';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Lazy getters — called only after Firebase is initialized, never at import time
function getDb() { return getFirestore(); }
function getMsg() { return getMessaging(); }
function getRedis() { return getRedisClient(); }

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

function normalizeIndianNumber(phone: string): string {
    const trimmed = phone.trim();
    if (!/^\+91\d{10}$/.test(trimmed)) {
        throw new Error('Phone must be in +91XXXXXXXXXX format');
    }
    return trimmed;
}

// Fix #6: Recipient cache TTL
const RECIPIENT_CACHE_KEY = 'cache:wa_recipients';
const RECIPIENT_CACHE_TTL = 60; // 1 minute

async function getWhatsAppRecipientsForDelivery(): Promise<string[]> {
    const redis = getRedis();
    // Try cache
    const cached = await redis.get(RECIPIENT_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const recipients = new Set<string>();
    if (adminPhone && /^\+\d{8,15}$/.test(adminPhone)) {
        recipients.add(adminPhone);
    }

    const snapshot = await getDb()
        .collection('notification_recipients')
        .where('channel', '==', 'whatsapp')
        .get();

    snapshot.docs.forEach((doc) => {
        const data = doc.data() as any;
        if (data.active !== false && data.phone_e164 && /^\+\d{8,15}$/.test(String(data.phone_e164))) {
            recipients.add(String(data.phone_e164));
        }
    });

    const result = Array.from(recipients);
    // Cache for 60s
    await redis.set(RECIPIENT_CACHE_KEY, JSON.stringify(result), { EX: RECIPIENT_CACHE_TTL });
    return result;
}

export async function listWhatsAppRecipients() {
    const snapshot = await getDb()
        .collection('notification_recipients')
        .where('channel', '==', 'whatsapp')
        .get();

    const recipients = snapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
        .sort((a: any, b: any) => String(a.phone_e164 || '').localeCompare(String(b.phone_e164 || '')));
    return recipients;
}

export async function addWhatsAppRecipient(phone: string, addedBy: string) {
    const normalized = normalizeIndianNumber(phone);
    const db = getDb();
    const existing = await db
        .collection('notification_recipients')
        .where('phone_e164', '==', normalized)
        .limit(10)
        .get();

    if (!existing.empty) {
        const match = existing.docs.find((doc) => (doc.data() as any).channel === 'whatsapp') || existing.docs[0];
        const docRef = match.ref;
        await docRef.set({
            channel: 'whatsapp',
            phone_e164: normalized,
            active: true,
            updated_at: new Date().toISOString(),
            updated_by: addedBy,
        }, { merge: true });
        return { id: docRef.id, phone_e164: normalized, active: true };
    }

    const created = await db.collection('notification_recipients').add({
        channel: 'whatsapp',
        phone_e164: normalized,
        active: true,
        created_at: new Date().toISOString(),
        created_by: addedBy,
    });

    return { id: created.id, phone_e164: normalized, active: true };
}

export async function removeWhatsAppRecipient(phone: string, removedBy: string) {
    const normalized = normalizeIndianNumber(phone);
    const db = getDb();
    const snapshot = await db
        .collection('notification_recipients')
        .where('phone_e164', '==', normalized)
        .limit(10)
        .get();

    if (snapshot.empty) return false;

    const match = snapshot.docs.find((doc) => (doc.data() as any).channel === 'whatsapp') || snapshot.docs[0];
    await match.ref.set({
        channel: 'whatsapp',
        phone_e164: normalized,
        active: false,
        updated_at: new Date().toISOString(),
        updated_by: removedBy,
    }, { merge: true });
    return true;
}

// Twilio Config
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim();
const adminPhone = process.env.ADMIN_WHATSAPP_TO?.trim();

let twilioClient: any = null;
if (twilioSid && twilioAuthToken) {
    twilioClient = twilio(twilioSid, twilioAuthToken);
    console.log('✅ Twilio initialized in Notification Service');
}

// ─── Rate Limiting & Configuration ────────────────────────────────────────────

const RATE_LIMIT_TTL = 3600; // 1 hour in seconds
const RATE_LIMIT_KEY = (deviceId: string, channel = 'global') => `notif:rate:${deviceId}:${channel}`;
const DELIVERY_DEDUPE_TTL_SEC = 10 * 60;
const FCM_TOKEN_CACHE_KEY = 'cache:fcm_tokens';
const PHANTOM_DEBOUNCE_KEY = (deviceId: string) => `notif:debounce:${deviceId}`;
const PHANTOM_DEBOUNCE_TTL = 5; // seconds
const LAST_SEVERITY_KEY = (deviceId: string) => `notif:last_severity:${deviceId}`;

const ESCALATION_INTERVALS = {
    whatsapp: [
        0,              // T0: immediate
        30 * 60,        // T30: 30 minutes later
        120 * 60        // T120: 2 hours later
    ]
};

/**
 * Optimized Delivery Logging (Nested in Alert Doc)
 * - Updates the Alert document directly with delivery info (low cost)
 * - Only writes to technical logs on FAILURE.
 */
async function writeDeliveryLog(entry: Record<string, any>) {
    const { status, channel, reason, alert_id, error } = entry;
    const db = getDb();

    // 1. Filter out Virtual IDs that don't exist as documents in Firestore
    if (!alert_id || alert_id.startsWith('test-') || alert_id.startsWith('report-')) {
        console.log(`ℹ️ [LOG:INTERNAL] Skipping Firestore nested log for virtual alert: ${alert_id}`);
        return;
    }

    // 2. Update the Alert document with the last delivery attempt
    try {
        const alertRef = db.collection('alerts').doc(alert_id);
        const alertSnap = await alertRef.get();
        
        if (!alertSnap.exists) {
            console.log(`ℹ️ [LOG:SKIP] Alert doc ${alert_id} not found — skipping nested log.`);
            return;
        }

        const updateData: any = {
            last_notified_at: new Date().toISOString(),
        };
        updateData[`delivery_history.${channel}`] = {
            status,
            timestamp: new Date().toISOString(),
            reason: reason || error || 'Processed',
            success: status === 'success' || status === 'partial'
        };

        await alertRef.update(updateData);
        console.log(`📝 [NESTED LOG] Updated Alert ${alert_id} with ${channel} status.`);
    } catch (err) {
        console.warn(`⚠️ [NESTED LOG] Could not update Alert ${alert_id}:`, (err as any).message);
    }

    // 2. Write every attempt to the technical logs collection so the Alerts page
    // can show success, partial, failed, and skipped deliveries consistently.
    try {
        await db.collection('notification_delivery_logs').add({
            ...entry,
            created_at: new Date().toISOString(),
        });
        if (status === 'failed' || status === 'partial') {
            console.error(`❌ [LOG:ERROR] ${channel} for ${alert_id}: ${error || 'Unknown error'}`);
        } else {
            console.log(`✅ [LOG:${status.toUpperCase()}] ${channel} for ${alert_id}`);
        }
    } catch (err) {
        console.error('❌ Failed to write technical log:', err);
    }
}

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

// Fix: Decouple delivery from rate-limiting to ensure Escalations (30m, 120m) work
// even if the 1-hour global safety lock is active.
async function isRateLimited(deviceId: string, channel = 'global'): Promise<boolean> {
    // For WhatsApp, we rely on the specific Tier state logic in shouldSkipByDedupe
    // so we return false here to let the Tier logic decide.
    if (channel === 'whatsapp') return false;
    
    const exists = await getRedis().exists(RATE_LIMIT_KEY(deviceId, channel));
    return exists === 1;
}

async function setRateLimitKey(deviceId: string, channel = 'global'): Promise<void> {
    await getRedis().set(RATE_LIMIT_KEY(deviceId, channel), '1', { EX: RATE_LIMIT_TTL });
}

async function isPhantomDebounced(deviceId: string): Promise<boolean> {
    const redis = getRedis();
    const key = PHANTOM_DEBOUNCE_KEY(deviceId);
    const exists = await redis.exists(key);
    if (exists === 1) return true;
    await redis.set(key, '1', { EX: PHANTOM_DEBOUNCE_TTL });
    return false;
}

async function deviceExists(deviceId: string): Promise<boolean> {
    const snap = await getDb().collection('devices').doc(deviceId).get();
    return snap.exists;
}

/**
 * Enhanced Deduplication & Escalation Logic
 * Fix #5: WhatsApp now uses strict time-intervals for tiers.
 * Fix #8: Escalation to 'critical' always bypasses dedupe.
 */
async function shouldSkipByDedupe(alertId: string, channel: string, deviceId?: string, currentSeverity?: string): Promise<boolean> {
    const redis = getRedis();

    // ── Fix #8: Severity Escalation Bypass ──
    if (deviceId && currentSeverity === 'critical') {
        const lastSev = await redis.get(LAST_SEVERITY_KEY(deviceId));
        if (lastSev && lastSev !== 'critical') {
            console.log(`🚀 [ESCALATION] Bypassing dedupe for ${deviceId} (escalated to critical)`);
            await redis.set(LAST_SEVERITY_KEY(deviceId), 'critical', { EX: 86400 });
            return false;
        }
    }
    if (deviceId && currentSeverity) {
        await redis.set(LAST_SEVERITY_KEY(deviceId), currentSeverity, { EX: 86400 });
    }

    // ── Fix #5: WhatsApp Escalation Tiering (Time-based) ──
    if (channel === 'whatsapp' && deviceId) {
        const dataKey = `notif:wa_tier_state:${deviceId}`;
        const rawState = await redis.get(dataKey);
        const now = Math.floor(Date.now() / 1000);
        
        let state = rawState ? JSON.parse(rawState) : { lastSent: 0, tierIndex: -1 };

        if (now - state.lastSent > 86400) state = { lastSent: 0, tierIndex: -1 };

        const nextTierIndex = state.tierIndex + 1;
        if (nextTierIndex >= ESCALATION_INTERVALS.whatsapp.length) return true;

        const requiredInterval = ESCALATION_INTERVALS.whatsapp[nextTierIndex];
        const timeSinceLast = now - state.lastSent;

        if (timeSinceLast >= requiredInterval) {
            state.lastSent = now;
            state.tierIndex = nextTierIndex;
            await redis.set(dataKey, JSON.stringify(state), { EX: 86400 });
            console.log(`📡 [WHATSAPP TIER] Advancing to tier ${nextTierIndex} for device ${deviceId}`);
            return false;
        }
        return true;
    }

    const key = `notif:dedupe:${channel}:${alertId}`;
    const exists = await redis.exists(key);
    if (exists === 1) return true;
    await redis.set(key, '1', { EX: DELIVERY_DEDUPE_TTL_SEC });
    return false;
}

/**
 * Starts real-time listeners for Firestore collections
 */
export function startNotificationListeners() {
    console.log('📡 Starting real-time Firestore listeners...');
    const db = getDb();
    const redis = getRedis();

    db.collection('alerts').onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const alertData = change.doc.data() as Alert;
            const alertId = change.doc.id;
            const deviceId = typeof alertData.device_id === 'object' && alertData.device_id !== null
                ? (alertData.device_id as any).id
                : String(alertData.device_id);

            if (change.type === 'added' || change.type === 'modified') {
                const fullAlert = { ...alertData, id: alertId, device_id: deviceId };
                await hset(`alert:${alertId}`, fullAlert);
                await redis.sAdd('alerts:all', alertId);
                await redis.sAdd(`device:${deviceId}:alerts`, alertId);

                if (alertData.status === 'open') {
                    await redis.sAdd(`device:${deviceId}:alerts:open`, alertId);
                } else {
                    await redis.sRem(`device:${deviceId}:alerts:open`, alertId);
                }

                if (change.type === 'added') {
                    const createdAtRaw = alertData.created_at as any;
                    const createdAt = createdAtRaw?.toDate ? createdAtRaw.toDate() : new Date(alertData.created_at);
                    const isRecent = (Date.now() - createdAt.getTime()) < 60000;

                    if (alertData.status === 'open' && isRecent) {
                        const exists = await deviceExists(deviceId);
                        if (!exists) {
                            console.warn(`⚠️ [PHANTOM GUARD] Alert ${alertId} references non-existent device ${deviceId}.`);
                            return;
                        }

                        const debounced = await isPhantomDebounced(deviceId);
                        if (debounced) return;

                        const channels: Array<'push' | 'whatsapp' | 'ntfy' | 'ifttt'> = ['push', 'whatsapp', 'ntfy', 'ifttt'];
                        const dispatchers = [
                            { channel: 'push' as const,     fn: () => sendPushNotification(alertId, alertData) },
                            { channel: 'whatsapp' as const, fn: () => sendWhatsAppNotification(alertId, alertData) },
                            { channel: 'ntfy' as const,     fn: () => sendNTFYNotification(alertId, alertData) },
                            { channel: 'ifttt' as const,    fn: () => triggerIFTTTWebhook(alertId, alertData) },
                        ];

                        console.log(`🚨 [ALERT] New alert for device ${deviceId}: ${alertData.message}`);
                        await Promise.all(
                            dispatchers.map(async ({ channel, fn }) => {
                                const limited = await isRateLimited(deviceId, channel);
                                if (limited) {
                                    await writeDeliveryLog({ alert_id: alertId, channel, status: 'skipped', reason: `rate_limited_${channel}` });
                                    return;
                                }
                                await fn();
                                await setRateLimitKey(deviceId, channel);
                            })
                        );
                    }
                }
            } else if (change.type === 'removed') {
                await redis.del(`alert:${alertId}`);
                await redis.sRem('alerts:all', alertId);
                await redis.sRem(`device:${deviceId}:alerts`, alertId);
                await redis.sRem(`device:${deviceId}:alerts:open`, alertId);

                // Clean up channel deduplication keys
                const channels = ['global', 'push', 'whatsapp', 'ntfy', 'ifttt'];
                for (const channel of channels) {
                    await redis.del(`notif:dedupe:${channel}:${alertId}`);
                }
            }
        });
    }, (error) => { console.error('❌ Firestore Alert Listener Error:', error); });

    db.collection('devices').onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const deviceData = change.doc.data() as Device;
            const deviceId = change.doc.id;
            if (change.type === 'added' || change.type === 'modified') {
                if (deviceData.name) {
                    await hset(`device:${deviceId}`, { ...deviceData, id: deviceId });
                    await redis.sAdd('devices:all', deviceId);
                }
            } else if (change.type === 'removed') {
                // ── FIX #1: AUTO-RESOLVE ORPHANED ALERTS ──
                // When a device is deleted, immediately resolve all its open alerts in Firestore.
                // This prevents "phantom" alert badges on the dashboard after device removal.
                try {
                    const openAlertsSnap = await getDb()
                        .collection('alerts')
                        .where('device_id', '==', deviceId)
                        .where('status', '==', 'open')
                        .get();

                    if (!openAlertsSnap.empty) {
                        const batch = getDb().batch();
                        const resolvedAt = new Date().toISOString();
                        openAlertsSnap.docs.forEach(doc => {
                            batch.update(doc.ref, {
                                status: 'resolved',
                                resolved_at: resolvedAt,
                                resolution_note: 'Auto-resolved: device was deleted',
                            });
                        });
                        await batch.commit();
                        console.log(`🧹 [ORPHAN CLEANUP] Resolved ${openAlertsSnap.size} open alert(s) for deleted device ${deviceId}`);
                    }
                } catch (cleanupErr) {
                    console.error(`❌ [ORPHAN CLEANUP] Failed for device ${deviceId}:`, cleanupErr);
                }

                const keysToDelete = [
                    `device:${deviceId}`,
                    `sensors:${deviceId}`,
                    `device:${deviceId}:alerts`,
                    `device:${deviceId}:alerts:open`,
                    `device:${deviceId}:uptime_records`,
                    `notif:debounce:${deviceId}`,
                    `notif:last_severity:${deviceId}`,
                    `notif:wa_tier_state:${deviceId}`
                ];

                const channels = ['global', 'push', 'whatsapp', 'ntfy', 'ifttt'];
                channels.forEach(channel => {
                    keysToDelete.push(`notif:rate:${deviceId}:${channel}`);
                });

                await Promise.all(keysToDelete.map(key => redis.del(key)));
                await redis.sRem('devices:all', deviceId);
            }
        });
    }, (error) => { console.error('❌ Firestore Device Listener Error:', error); });
    
    db.collection('notification_subscriptions').onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const data = change.doc.data();
            const token = data.token;
            const userId = data.user_id;
            if (!token) return;
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
        });
        const count = await redis.sCard(FCM_TOKEN_CACHE_KEY);
        if (count === 0 && !snapshot.empty) {
            console.log(`🚀 Initializing FCM token caches in Redis from ${snapshot.size} subscriptions...`);
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
            console.log(`✅ Pre-cached ${total} FCM tokens in memory.`);
        }
    }, (error) => { console.error('❌ Firestore Subscription Listener Error:', error); });
}

/**
 * FIX #2a: Warm the FCM token Redis cache on backend startup.
 * Ensures push notifications work immediately — even on first boot before any Firestore events.
 * Call this once from server.ts after initializeRedis().
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

// ─── Notification Channels ────────────────────────────────────────────────────

async function sendPushNotification(alertId: string, alertData: any, isReminder = false) {
    try {
        if (!isReminder && await shouldSkipByDedupe(alertId, 'push', alertData.device_id, alertData.severity)) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'dedupe' });
            return;
        }

        const messaging = getMsg();
        const redis = getRedis();
        const db = getDb();
        const deviceId = alertData.device_id;

        // Broadcast every push notification to every registered token so it reaches
        // all logged-in web and app users, regardless of role.
        let tokens: string[] = [];
        const tokenSet = new Set<string>();

        const allCached = await redis.sMembers(FCM_TOKEN_CACHE_KEY);
        allCached.forEach((t: string) => tokenSet.add(t));
        if (tokenSet.size === 0) {
            // Cold-start fallback: query Firestore directly
            const allSnap = await db.collection('notification_subscriptions').get();
            allSnap.docs.forEach(doc => {
                const t = doc.data().token;
                if (t) tokenSet.add(t);
            });
            console.log(`[FCM-PUSH] Broadcast loaded ${tokenSet.size} tokens from Firestore`);
        } else {
            console.log(`[FCM-PUSH] Broadcast loaded ${tokenSet.size} tokens from Redis cache`);
        }

        tokens = Array.from(tokenSet);

        if (tokens.length === 0) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'no_tokens_found' });
            console.warn(`[FCM-PUSH] ❌ No tokens found for alert ${alertId}`);
            return;
        }

        const { location, ppm, time } = formatAlertContext(alertData);
        const message = {
            notification: {
                title: `${isReminder ? '⏰ Reminder: ' : '🚨 '}TDS Alert: ${location}`,
                body: `${ppm} ppm recorded at ${time}`,
            },
            data: {
                alertId, deviceId, severity: alertData.severity || 'critical',
                location_name: String(location), ppm: String(ppm), recorded_at: String(time),
                isReminder: String(isReminder), url: '/alerts'
            },
            tokens,
        };

        console.log(`[FCM-PUSH] Sending to ${tokens.length} tokens for alert ${alertId}`);
        const response = await withRetry(() => messaging.sendEachForMulticast(message), 1);
        await writeDeliveryLog({
            alert_id: alertId, channel: 'push', status: response.failureCount > 0 ? 'partial' : 'success',
            success_count: response.successCount, failure_count: response.failureCount, is_reminder: isReminder
        });
        
        console.log(`[FCM-PUSH] ✅ Alert ${alertId}: ${response.successCount} success, ${response.failureCount} failed`);

        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code ?? '';
                    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                        const staleToken = tokens[idx];
                        db.collection('notification_subscriptions').where('token', '==', staleToken).get().then((snap) => {
                            const b = db.batch();
                            snap.docs.forEach(d => b.delete(d.ref));
                            redis.sRem(FCM_TOKEN_CACHE_KEY, staleToken);
                            b.commit();
                        });
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
        await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'failed', error: String(error) });
    }
}

async function sendWhatsAppNotification(alertId: string, alertData: any, isReminder = false) {
    if (!twilioClient) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'skipped', reason: 'missing_config' });
        return;
    }
    try {
        if (!isReminder && await shouldSkipByDedupe(alertId, 'whatsapp', alertData.device_id, alertData.severity)) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'skipped', reason: 'dedupe' });
            return;
        }
        const recipients = await getWhatsAppRecipientsForDelivery();
        if (recipients.length === 0) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'skipped', reason: 'no_recipients' });
            return;
        }
        const { location, ppm, time } = formatAlertContext(alertData);
        for (const recipient of recipients) {
            try {
                const body = isReminder 
                    ? `⏰ *Hourly Reminder: EvaraTDS Alert*\n\n*Location:* ${location}\n*TDS:* ${ppm} ppm\n*Time:* ${time}\n*Status:* Still Critical`
                    : `🚨 *EvaraTDS Alert*\n\n*Location:* ${location}\n*TDS:* ${ppm} ppm\n*Time:* ${time}\n*Severity:* ${String(alertData.severity || 'critical').toUpperCase()}\n\n_Reply STATUS for real-time update._`;
                await withRetry(() => twilioClient.messages.create({ from: twilioFrom, body, to: `whatsapp:${recipient}` }), 1);
                await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'success', recipient, is_reminder: isReminder });
            } catch (err: any) {
                await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'failed', recipient, error: String(err?.message || err) });
            }
        }
    } catch (error: any) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'failed', error: String(error?.message || error) });
    }
}

async function sendNTFYNotification(alertId: string, alertData: any, isReminder = false) {
    const deviceId = alertData.device_id;
    let topic = process.env.NTFY_TOPIC?.trim();
    try {
        const deviceSnap = await getDb().collection('devices').doc(deviceId).get();
        const customTopic = deviceSnap.data()?.ntfy_topic;
        if (customTopic) topic = customTopic;
    } catch (e) {}
    if (!topic) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'skipped', reason: 'missing_topic' });
        return;
    }
    try {
        if (!isReminder && await shouldSkipByDedupe(alertId, 'ntfy', deviceId, alertData.severity)) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'skipped', reason: 'dedupe' });
            return;
        }
        const { location, ppm, time } = formatAlertContext(alertData);
        const prefix = isReminder ? '[REMINDER] ' : '[CRITICAL ALERT] ';
        const response = await fetch(`https://ntfy.sh/${topic}`, {
            method: 'POST',
            body: `${prefix}Location: ${location} | TDS: ${ppm} ppm | Time: ${time} | Severity: ${String(alertData.severity || 'critical').toUpperCase()}\n\nMessage: ${alertData.message}`,
            headers: {
                'Title': `${isReminder ? 'Reminder: ' : ''}TDS ALERT: ${String(location).replace(/[^\x00-\xFF]/g, '')}`,
                'Priority': 'urgent',
                'Tags': isReminder ? 'alarm_clock' : 'rotating_light,skull'
            }
        });
        if (response.ok) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'success', topic, is_reminder: isReminder });
        } else {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'failed', error: `HTTP ${response.status}` });
        }
    } catch (error) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'failed', error: String(error) });
    }
}

async function fetchWithBackoff(url: string, options: RequestInit, maxAttempts = 3): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.ok || res.status < 500) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            lastError = err;
            if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        }
    }
    throw lastError;
}

async function triggerIFTTTWebhook(alertId: string, alertData: any, isReminder = false) {
    const key = process.env.IFTTT_WEBHOOK_KEY;
    const event = process.env.IFTTT_EVENT_NAME || 'tds_alert';
    if (!key) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'skipped', reason: 'missing_key' });
        return;
    }
    try {
        if (!isReminder && await shouldSkipByDedupe(alertId, 'ifttt', alertData.device_id, alertData.severity)) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'skipped', reason: 'dedupe' });
            return;
        }
        const response = await fetchWithBackoff(`https://maker.ifttt.com/trigger/${event}/with/key/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                value1: alertData.device_name || alertData.device_id,
                value2: isReminder ? 'reminder' : alertData.severity,
                value3: alertData.message,
            }),
        });
        if (response.ok) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'success', event, is_reminder: isReminder });
        } else {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'failed', error: `HTTP ${response.status}`, reason: 'bad_status' });
        }
    } catch (error) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'failed', error: String(error), reason: 'exception_after_retry' });
    }
}

export async function sendHourlyReminders() {
    console.log('⏰ [REMINDER JOB] Starting hourly reminder dispatch...');
    const redis = getRedis();
    const db = getDb();
    const deviceIds = await redis.sMembers('devices:all');
    if (!deviceIds || deviceIds.length === 0) return;
    let dispatchCount = 0;
    for (const id of deviceIds) {
        try {
            const device = await hgetall<Device>(`device:${id}`);
            if (!device) continue;
            const deviceSeverity = String((device as any).severity || device.status || '').toLowerCase();
            const isEscalated = deviceSeverity === 'critical' || deviceSeverity === 'high' || device.status === 'critical';
            if (!isEscalated) continue;
            const openAlertIds = await redis.sMembers(`device:${id}:alerts:open`);
            if (!openAlertIds || openAlertIds.length === 0) continue;
            const alertId = openAlertIds[0];
            const alertData: any = await hgetall<Alert>(`alert:${alertId}`);
            if (!alertData) continue;
            const fsAlert = await db.collection('alerts').doc(alertId).get();
            if (!fsAlert.exists || fsAlert.data()?.status !== 'open') {
                await redis.sRem(`device:${id}:alerts:open`, alertId);
                continue;
            }

            // ── FIX RC-2/RC-7: Refresh PPM and timestamp from the device's latest reading ──
            // The cached alertData has the original breach time frozen in it.
            // We always want to show the most current reading in the reminder.
            try {
                const deviceDoc = await db.collection('devices').doc(id).get();
                if (deviceDoc.exists) {
                    const fresh = deviceDoc.data();
                    if (fresh?.last_tds != null)      alertData.value_at_time = fresh.last_tds;
                    if (fresh?.last_reading_at)       alertData.recorded_at   = fresh.last_reading_at;
                    if (fresh?.tds_value != null)     alertData.tds_value     = fresh.last_tds;
                    console.log(`🔄 [REMINDER JOB] Refreshed: device=${device.name || id}, ppm=${fresh?.last_tds}, ts=${fresh?.last_reading_at}`);
                }
            } catch (refreshErr) {
                console.warn(`⚠️ [REMINDER JOB] Could not refresh device data for ${id}:`, refreshErr);
            }

            console.log(`🔔 [REMINDER JOB] Dispatching hourly reminder for device: ${device.name || id}`);
            await Promise.all([
                sendPushNotification(alertId, alertData, true),
                sendWhatsAppNotification(alertId, alertData, true),
                sendNTFYNotification(alertId, alertData, true),
                triggerIFTTTWebhook(alertId, alertData, true)
            ]);
            dispatchCount++;
        } catch (error) { console.error(`❌ [REMINDER JOB] Failed for device ${id}:`, error); }
    }
    console.log(`✅ [REMINDER JOB] Finished for ${dispatchCount} devices.`);
}

/**
 * Forceful Notification Engine (Ghost Mode)
 * Triggers a consolidated report of all critical devices directly from ThingSpeak data.
 */
export async function sendForceConsolidatedReport(criticalDevices: any[]) {
    if (criticalDevices.length === 0) return;

    console.log(`🔥 [GHOST ENGINE] Forcing consolidated report for ${criticalDevices.length} devices...`);

    let report = `🚨 *EvaraTDS: Critical System Report*\n\n`;
    criticalDevices.forEach(d => {
        report += `📍 *${d.name}* (${d.location || 'N/A'})\n`;
        report += `💧 TDS: *${d.tds} PPM* | 🕒 ${toIST(d.time)}\n\n`;
    });
    report += `_Immediate action required on all above devices._`;

    // 1. Create a "Virtual Alert" ID for logging
    const reportId = `report-${Date.now()}`;

    // 2. Dispatch WhatsApp consolidated report
    // For consolidated reports, we bypass device-specific dedupe as this is a master admin blast
    const recipients = await getWhatsAppRecipientsForDelivery();
    if (recipients.length > 0) {
        for (const recipient of recipients) {
            try {
                await withRetry(() => twilioClient.messages.create({
                    from: twilioFrom,
                    body: report,
                    to: `whatsapp:${recipient}`
                }), 1);
                console.log(`✅ [GHOST] Consolidated report sent to WhatsApp: ${recipient}`);
            } catch (err) {
                console.error(`❌ [GHOST] WhatsApp failed for ${recipient}`);
            }
        }
    }

    // 3. FIX RC-1: Send Push with real aggregated PPM & timestamp so it shows meaningful data
    // Use the most critical device's TDS and timestamp instead of empty fields that cause "N/A".
    const worstDevice = criticalDevices.reduce((a, b) => (b.tds > a.tds ? b : a), criticalDevices[0]);
    const consolidatedAlertData = {
        message: `${criticalDevices.length} device(s) in critical state! Highest: ${worstDevice.tds} PPM`,
        severity: 'critical',
        device_id: 'SYSTEM_REPORT',
        location_name: criticalDevices.length === 1
            ? (worstDevice.location || worstDevice.name)
            : `${criticalDevices.length} Critical Devices`,
        value_at_time: worstDevice.tds,       // ← real PPM — prevents "N/A"
        recorded_at:   worstDevice.time || new Date().toISOString(), // ← real timestamp
        tds_value:     worstDevice.tds,
    };
    await sendPushNotification(reportId, consolidatedAlertData, true);
}

/**
 * Triggered by the Ghost Engine for a single device escalation
 */
export async function triggerForceDeviceAlert(deviceId: string, tds: number, timestamp: string) {
    const db = getDb();
    const deviceSnap = await db.collection('devices').doc(deviceId).get();
    if (!deviceSnap.exists) return;
    const deviceData = deviceSnap.data() as any;

    // Use a STABLE alert ID for this device so we update the SAME card in the APK
    const alertId = `active-alert-${deviceId}`;
    
    // Check if an open alert already exists
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
        // FIX RC-4: Always store recorded_at as the current ThingSpeak reading's timestamp.
        // This is what formatAlertContext() checks FIRST — previously it was missing, causing
        // the fallback to created_at (the original breach time = frozen "02:33").
        recorded_at: timestamp,
        created_at: isNew ? timestamp : existingAlert.data()?.created_at,
        updated_at: timestamp,
        type: 'AUTO_SCAN'
    };

    // 1. Persist to Firestore (Updates existing card or creates new)
    try {
        await db.collection('alerts').doc(alertId).set(alertData, { merge: true });
        console.log(`📡 [GHOST] Updated Firestore Alert document: ${alertId} | TDS=${tds} PPM | ts=${timestamp}`);
    } catch (e) {
        console.error('Failed to update ghost alert record', e);
    }

    // 2. Fire notifications forcefully if it's been more than 1 hour (or if brand new)
    const lastNotified = existingAlert.data()?.last_notified_at
        ? new Date(existingAlert.data()!.last_notified_at).getTime()
        : 0;
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    if (isNew || (now - lastNotified >= ONE_HOUR)) {
        console.log(`🔥 [GHOST] Forcing notification blast for ${deviceId} | TDS=${tds} PPM | ts=${timestamp}`);
        await Promise.all([
            sendPushNotification(alertId, alertData, true),
            sendWhatsAppNotification(alertId, alertData, true),
            sendNTFYNotification(alertId, alertData, true),
            triggerIFTTTWebhook(alertId, alertData, true)
        ]);
    }
}

// Expose these for the scheduler
export { sendPushNotification, sendWhatsAppNotification, sendNTFYNotification, triggerIFTTTWebhook };

export async function handleWhatsAppWebhook(reqBody: any) {
    const body = reqBody.Body ? reqBody.Body.trim().toUpperCase() : "";
    const from = reqBody.From;
    console.log(`📩 Received WhatsApp from ${from}: ${body}`);
    let reply = "Hello! I am the EvaraTDS Monitor Bot. \n\nCommands:\n- STATUS: Get latest readings\n- HELP: List commands";
    if (body === "STATUS") {
        try {
            const db = getDb();
            const devicesSnap = await db.collection("devices").limit(5).get();
            if (devicesSnap.empty) {
                reply = "No devices found in the system.";
            } else {
                reply = "📊 *Latest TDS Readings:*\n";
                devicesSnap.forEach(doc => {
                    const d = doc.data();
                    reply += `\n📍 *${d.location_name || d.name}*\nTDS: ${d.last_tds || "N/A"} PPM\nStatus: ${d.status === "online" ? "🟢" : "🔴"} ${d.status.toUpperCase()}\n`;
                });
            }
        } catch (err) { reply = "Sorry, I had trouble fetching the status."; }
    }
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);
    return twiml.toString();
}