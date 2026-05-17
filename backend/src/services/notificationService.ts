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

const LOG_BUFFER_KEY = 'cache:delivery_logs';
const LOG_BATCH_SIZE = 100;
const LOG_FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Optimized Delivery Logging
 * - Skips 'skipped' logs (console only)
 * - Samples 'success' logs (1 in 10)
 * - Buffers in Redis for batch writing
 */
async function writeDeliveryLog(entry: Record<string, any>) {
    const { status, channel, reason, alert_id } = entry;

    // 1. Skip writing 'skipped' logs to Firestore (Keep in console only)
    if (status === 'skipped') {
        console.log(`ℹ️ [LOG:SKIPPED] ${channel} for ${alert_id}: ${reason}`);
        return;
    }

    // 2. Sample successes (1 in 10) to save writes
    if (status === 'success' && Math.random() > 0.1) {
        // Still show in console for monitoring
        console.log(`✅ [LOG:SUCCESS] ${channel} for ${alert_id} (Sampled out of Firestore)`);
        return;
    }

    try {
        const logEntry = {
            ...entry,
            created_at: new Date().toISOString(),
        };

        // Failures and Sampled Successes go to Redis Buffer
        const redis = getRedis();
        await redis.rPush(LOG_BUFFER_KEY, JSON.stringify(logEntry));

        // Immediate console feedback
        if (status === 'failed' || status === 'partial') {
            console.error(`❌ [LOG:${status.toUpperCase()}] ${channel} for ${alert_id}: ${entry.error || 'Unknown error'}`);
        }

        // Trigger flush if buffer is large
        const size = await redis.lLen(LOG_BUFFER_KEY);
        if (size >= LOG_BATCH_SIZE) {
            flushDeliveryLogs().catch(e => console.error('Auto-flush logs failed', e));
        }
    } catch (error) {
        console.error('❌ Failed to buffer delivery log:', error);
    }
}

/**
 * Batch flush delivery logs to Firestore
 */
export async function flushDeliveryLogs() {
    try {
        const redis = getRedis();
        const size = await redis.lLen(LOG_BUFFER_KEY);
        if (size === 0) return;

        const count = Math.min(size, LOG_BATCH_SIZE);
        const rawData = await redis.lRange(LOG_BUFFER_KEY, 0, count - 1);
        if (!rawData || rawData.length === 0) return;

        const batch = getDb().batch();
        rawData.forEach((json: string) => {
            const entry = JSON.parse(json);
            const docRef = getDb().collection('notification_delivery_logs').doc();
            batch.set(docRef, entry);
        });

        await batch.commit();
        await redis.lTrim(LOG_BUFFER_KEY, count, -1);
        console.log(`💾 [LOG FLUSH] Flushed ${count} delivery logs to Firestore.`);
    } catch (err) {
        console.error('❌ Failed to flush delivery logs:', err);
    }
}

// Set periodic flush
setInterval(flushDeliveryLogs, LOG_FLUSH_INTERVAL);

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

async function isRateLimited(deviceId: string, channel = 'global'): Promise<boolean> {
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
        let tokens: string[] = [];

        // Targeted Routing (Fix #14)
        const deviceSnap = await db.collection('devices').doc(deviceId).get();
        const targetUserId = deviceSnap.data()?.user_id || deviceSnap.data()?.owner_id || null;

        if (targetUserId) {
            tokens = await redis.sMembers(`cache:user_tokens:${targetUserId}`);
            if (!tokens || tokens.length === 0) {
                const userTokensSnap = await db.collection('notification_subscriptions').where('user_id', '==', targetUserId).get();
                tokens = userTokensSnap.docs.map(d => d.data().token).filter(Boolean);
                if (tokens.length > 0) await redis.sAdd(`cache:user_tokens:${targetUserId}`, tokens);
            }
        } 
        
        if (tokens.length === 0) {
            tokens = await redis.sMembers(FCM_TOKEN_CACHE_KEY);
            if (!tokens || tokens.length === 0) {
                const allSnap = await db.collection('notification_subscriptions').get();
                tokens = allSnap.docs.map(d => d.data().token).filter(Boolean);
            }
        }

        if (tokens.length === 0) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'no_tokens_found' });
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

        const response = await withRetry(() => messaging.sendEachForMulticast(message), 1);
        await writeDeliveryLog({
            alert_id: alertId, channel: 'push', status: response.failureCount > 0 ? 'partial' : 'success',
            success_count: response.successCount, failure_count: response.failureCount, is_reminder: isReminder
        });

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
                'Title': `${isReminder ? '⏰ ' : '🚨 '}TDS ALERT: ${String(location).replace(/[^\x00-\xFF]/g, '')}`,
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
            const alertData = await hgetall<Alert>(`alert:${alertId}`);
            if (!alertData) continue;
            const fsAlert = await getDb().collection('alerts').doc(alertId).get();
            if (!fsAlert.exists || fsAlert.data()?.status !== 'open') {
                await redis.sRem(`device:${id}:alerts:open`, alertId);
                continue;
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

export async function triggerManualTestNotification(deviceId: string, deviceName: string, message: string) {
    const alertData = { device_id: deviceId, device_name: deviceName, severity: 'critical', message, type: 'TEST', status: 'open' };
    const alertId = 'test-' + Date.now();
    await sendPushNotification(alertId, alertData);
    await sendWhatsAppNotification(alertId, alertData);
    await sendNTFYNotification(alertId, alertData);
    await triggerIFTTTWebhook(alertId, alertData);
}

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