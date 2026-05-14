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

async function getWhatsAppRecipientsForDelivery(): Promise<string[]> {
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

    return Array.from(recipients);
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
// Trim all env strings to prevent CRLF-poisoned values from Windows-style .env files
const twilioFrom = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim();
const adminPhone = process.env.ADMIN_WHATSAPP_TO?.trim();

let twilioClient: any = null;
if (twilioSid && twilioAuthToken) {
    twilioClient = twilio(twilioSid, twilioAuthToken);
    console.log('✅ Twilio initialized in Notification Service');
}

// ─── Rate Limiting (1 notification per device per hour) ──────────────────────

const RATE_LIMIT_TTL = 3600; // 1 hour in seconds
const RATE_LIMIT_KEY = (deviceId: string) => `notif:sent:${deviceId}`;
const DELIVERY_DEDUPE_TTL_SEC = 10 * 60;

async function writeDeliveryLog(entry: Record<string, any>) {
    try {
        await getDb().collection('notification_delivery_logs').add({
            ...entry,
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('❌ Failed to write delivery log:', error);
    }
}

async function shouldSkipByDedupe(alertId: string, channel: string): Promise<boolean> {
    const key = `notif:dedupe:${channel}:${alertId}`;
    const redis = getRedis();
    const exists = await redis.exists(key);
    if (exists === 1) return true;
    await redis.set(key, '1', { EX: DELIVERY_DEDUPE_TTL_SEC });
    return false;
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

async function isRateLimited(deviceId: string): Promise<boolean> {
    const exists = await getRedis().exists(RATE_LIMIT_KEY(deviceId));
    return exists === 1;
}

async function setRateLimitKey(deviceId: string): Promise<void> {
    await getRedis().set(RATE_LIMIT_KEY(deviceId), '1', { EX: RATE_LIMIT_TTL });
}

// ─── Device Existence Guard (anti-phantom alerts) ─────────────────────────────

async function deviceExists(deviceId: string): Promise<boolean> {
    const device = await hgetall<Device>(`device:${deviceId}`);
    return device !== null && device.name !== undefined;
}

/**
 * Starts real-time listeners for Firestore collections
 * This handles synchronization between Firestore and Redis for metadata and alerts.
 */
export function startNotificationListeners() {
    console.log('📡 Starting real-time Firestore listeners...');
    const db = getDb();
    const redis = getRedis();

    // 1. Listen for Alerts Changes
    db.collection('alerts').onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const alertData = change.doc.data() as Alert;
            const alertId = change.doc.id;
            const deviceId = typeof alertData.device_id === 'object' && alertData.device_id !== null
                ? (alertData.device_id as any).id
                : String(alertData.device_id);

            if (change.type === 'added' || change.type === 'modified') {
                // Sync to Redis
                const fullAlert = { ...alertData, id: alertId, device_id: deviceId };
                await hset(`alert:${alertId}`, fullAlert);
                await redis.sAdd('alerts:all', alertId);
                await redis.sAdd(`device:${deviceId}:alerts`, alertId);

                if (alertData.status === 'open') {
                    await redis.sAdd(`device:${deviceId}:alerts:open`, alertId);
                } else {
                    await redis.sRem(`device:${deviceId}:alerts:open`, alertId);
                }

                // Process new alerts for notification delivery
                if (change.type === 'added') {
                    const createdAtRaw = alertData.created_at as any;
                    const createdAt = createdAtRaw?.toDate ? createdAtRaw.toDate() : new Date(alertData.created_at);
                    const isRecent = (Date.now() - createdAt.getTime()) < 60000; // < 60 seconds old

                    if (alertData.status === 'open' && isRecent) {
                        // ── Guard 1: Verify device actually exists (anti-phantom) ──
                        const exists = await deviceExists(deviceId);
                        if (!exists) {
                            console.warn(`⚠️ [PHANTOM GUARD] Alert ${alertId} references non-existent device ${deviceId} — skipping notifications.`);
                            return;
                        }

                        // ── Guard 2: Rate limit — 1 notification per device per hour ──
                        const limited = await isRateLimited(deviceId);
                        if (limited) {
                            console.log(`⏱️ [RATE LIMITED] Skipping notifications for device ${deviceId} — already notified within the last hour.`);
                            return;
                        }

                        // ── All guards passed — fire notifications ──
                        console.log(`🚨 [ALERT] New critical alert for device ${deviceId}: ${alertData.message}`);
                        await sendPushNotification(alertId, alertData);
                        await sendWhatsAppNotification(alertId, alertData);
                        await sendNTFYNotification(alertId, alertData);
                        await triggerIFTTTWebhook(alertId, alertData);

                        // Stamp the rate limit key AFTER successful dispatch
                        await setRateLimitKey(deviceId);
                        console.log(`✅ [RATE LIMIT SET] Device ${deviceId} will not receive another notification for 1 hour.`);
                    }
                }
            } else if (change.type === 'removed') {
                await redis.del(`alert:${alertId}`);
                await redis.sRem('alerts:all', alertId);
                await redis.sRem(`device:${deviceId}:alerts`, alertId);
                await redis.sRem(`device:${deviceId}:alerts:open`, alertId);
            }
        });
    }, (error) => {
        console.error('❌ Firestore Alert Listener Error:', error);
    });

    // 2. Listen for Devices Changes (Metadata sync)
    db.collection('devices').onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const deviceData = change.doc.data() as Device;
            const deviceId = change.doc.id;

            if (change.type === 'added' || change.type === 'modified') {
                // Only sync if it's a valid device
                if (deviceData.name) {
                    await hset(`device:${deviceId}`, { ...deviceData, id: deviceId });
                    await redis.sAdd('devices:all', deviceId);
                }
            } else if (change.type === 'removed') {
                await redis.del(`device:${deviceId}`);
                await redis.sRem('devices:all', deviceId);
            }
        });
    }, (error) => {
        console.error('❌ Firestore Device Listener Error:', error);
    });
}

// ─── Notification Channels ────────────────────────────────────────────────────

async function sendPushNotification(alertId: string, alertData: any) {
    try {
        if (await shouldSkipByDedupe(alertId, 'push')) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'dedupe' });
            return;
        }

        const db = getDb();
        const messaging = getMsg();
        const subscriptionsSnap = await db.collection('notification_subscriptions').get();
        if (subscriptionsSnap.empty) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'no_tokens' });
            return;
        }

        const tokens: string[] = [];
        subscriptionsSnap.forEach(doc => {
            const sub = doc.data();
            if (sub.token) tokens.push(sub.token);
        });

        if (tokens.length === 0) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'skipped', reason: 'empty_tokens' });
            return;
        }

        const { location, ppm, time } = formatAlertContext(alertData);

        const message = {
            notification: {
                title: `🚨 TDS Alert: ${location}`,
                body: `${ppm} ppm recorded at ${time}`,
            },
            data: {
                alertId: alertId,
                deviceId: alertData.device_id || '',
                severity: alertData.severity || 'critical',
                location_name: String(location),
                ppm: String(ppm),
                recorded_at: String(time),
                url: '/alerts'
            },
            tokens: tokens,
        };

        const response = await withRetry(() => messaging.sendEachForMulticast(message), 1);
        console.log(`✅ Sent ${response.successCount} push notifications (${response.failureCount} failed).`);
        await writeDeliveryLog({
            alert_id: alertId,
            channel: 'push',
            status: response.failureCount > 0 ? 'partial' : 'success',
            success_count: response.successCount,
            failure_count: response.failureCount,
        });

        // ── Auto-cleanup stale / invalid FCM tokens ────────────────────────
        if (response.failureCount > 0) {
            const staleCleanups: Promise<void>[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code ?? '';
                    const isStale = (
                        code === 'messaging/registration-token-not-registered' ||
                        code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/invalid-argument'
                    );
                    if (isStale) {
                        const staleToken = tokens[idx];
                        console.warn(`🗑️ Removing stale FCM token (${code}): ${staleToken.substring(0, 20)}...`);
                        const cleanup = db.collection('notification_subscriptions')
                            .where('token', '==', staleToken)
                            .get()
                            .then(snap => {
                                const batch = db.batch();
                                snap.docs.forEach(d => batch.delete(d.ref));
                                return snap.empty ? Promise.resolve() : batch.commit().then(() => {});
                            })
                            .catch(e => { console.error('Failed to remove stale token:', e); });
                        staleCleanups.push(cleanup as Promise<void>);
                    }
                }
            });
            if (staleCleanups.length > 0) {
                // Non-blocking — run cleanup in background
                Promise.all(staleCleanups).then(() =>
                    console.log(`🗑️ Cleaned ${staleCleanups.length} stale FCM subscription(s).`)
                );
            }
        }
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
        await writeDeliveryLog({ alert_id: alertId, channel: 'push', status: 'failed', error: String(error) });
    }
}

async function sendWhatsAppNotification(alertId: string, alertData: any) {
    if (!twilioClient) {
        console.log('ℹ️ WhatsApp skipped: Missing Twilio config.');
        await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'skipped', reason: 'missing_config' });
        return;
    }

    try {
        if (await shouldSkipByDedupe(alertId, 'whatsapp')) {
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
                await withRetry(() => twilioClient.messages.create({
                    from: twilioFrom,
                    body: `🚨 *EvaraTDS Alert*\n\n*Location:* ${location}\n*TDS:* ${ppm} ppm\n*Time:* ${time}\n*Severity:* ${String(alertData.severity || 'critical').toUpperCase()}\n\n_Reply STATUS for real-time update._`,
                    to: `whatsapp:${recipient}`
                }), 1);
                await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'success', recipient });
            } catch (recipientError: any) {
                await writeDeliveryLog({
                    alert_id: alertId,
                    channel: 'whatsapp',
                    status: 'failed',
                    recipient,
                    error: String(recipientError?.message || recipientError)
                });
            }
        }
    } catch (error: any) {
        console.error('❌ WhatsApp delivery failed:', error.message);
        await writeDeliveryLog({ alert_id: alertId, channel: 'whatsapp', status: 'failed', error: String(error?.message || error) });
    }
}

/**
 * NTFY.sh - Free System Notification Service
 * To receive these: Download 'ntfy' app on phone and subscribe to topic set in .env
 */
async function sendNTFYNotification(alertId: string, alertData: any) {
    const topic = process.env.NTFY_TOPIC?.trim();
    if (!topic) {
        await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'skipped', reason: 'missing_topic' });
        return;
    }

    try {
        if (await shouldSkipByDedupe(alertId, 'ntfy')) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'skipped', reason: 'dedupe' });
            return;
        }
        const { location, ppm, time } = formatAlertContext(alertData);
        // NOTE: HTTP headers are Latin-1 only (code points 0-255).
        // Emojis (e.g. U+1F6A8) are multi-byte and will crash undici fetch with a ByteString error.
        // All emojis must stay in the body, never in headers.
        const response = await fetch(`https://ntfy.sh/${topic}`, {
            method: 'POST',
            body: `[CRITICAL ALERT] Location: ${location} | TDS: ${ppm} ppm | Time: ${time} | Severity: ${String(alertData.severity || 'critical').toUpperCase()}\n\nMessage: ${alertData.message}`,
            headers: {
                'Title': `TDS ALERT: ${String(location).replace(/[^\x00-\xFF]/g, '')}`,
                'Priority': 'urgent',
                'Tags': 'rotating_light,skull'
            }
        });
        if (response.ok) {
            console.log(`📲 NTFY System Notification sent to topic: ${topic}`);
            await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'success', topic });
        } else {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'failed', error: `HTTP ${response.status}` });
        }
    } catch (error) {
        console.error('❌ NTFY delivery failed:', error);
        await writeDeliveryLog({ alert_id: alertId, channel: 'ntfy', status: 'failed', error: String(error) });
    }
}

/**
 * IFTTT Webhook Trigger — fires only when rate limit allows
 */
async function triggerIFTTTWebhook(alertId: string, alertData: any) {
    const key = process.env.IFTTT_WEBHOOK_KEY;
    const event = process.env.IFTTT_EVENT_NAME || 'tds_alert';
    if (!key) {
        console.log('ℹ️ IFTTT skipped: IFTTT_WEBHOOK_KEY not set.');
        await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'skipped', reason: 'missing_key' });
        return;
    }

    try {
        if (await shouldSkipByDedupe(alertId, 'ifttt')) {
            await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'skipped', reason: 'dedupe' });
            return;
        }
        const response = await fetch(`https://maker.ifttt.com/trigger/${event}/with/key/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                value1: alertData.device_name || alertData.device_id,
                value2: alertData.severity,
                value3: alertData.message
            })
        });
        if (response.ok) {
            console.log(`🔗 IFTTT Webhook triggered: event="${event}" device="${alertData.device_name || alertData.device_id}"`);
            await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'success', event });
        } else {
            console.warn(`⚠️ IFTTT responded with status ${response.status}`);
            await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'failed', error: `HTTP ${response.status}` });
        }
    } catch (error) {
        console.error('❌ IFTTT trigger failed:', error);
        await writeDeliveryLog({ alert_id: alertId, channel: 'ifttt', status: 'failed', error: String(error) });
    }
}

/**
 * Manual test notification — triggered via POST /api/notifications/test
 * Bypasses rate limiting (it's a manual test)
 */
export async function triggerManualTestNotification(deviceId: string, deviceName: string, message: string) {
    const alertData = {
        device_id: deviceId,
        device_name: deviceName,
        severity: 'critical',
        message,
        type: 'TEST',
        status: 'open',
    };

    console.log(`🧪 [TEST] Firing manual test notification for device ${deviceId}`);
    const alertId = 'test-' + Date.now();
    await sendPushNotification(alertId, alertData);
    await sendWhatsAppNotification(alertId, alertData);
    await sendNTFYNotification(alertId, alertData);
    await triggerIFTTTWebhook(alertId, alertData);
    console.log(`✅ [TEST] Manual test notification dispatched.`);
}

/**
 * Logic for the WhatsApp Webhook (responding to messages)
 */
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
                    reply += `\n📍 *${d.location_name || d.name}*\n`;
                    reply += `TDS: ${d.last_tds || "N/A"} PPM\n`;
                    reply += `Status: ${d.status === "online" ? "🟢" : "🔴"} ${d.status.toUpperCase()}\n`;
                });
            }
        } catch (err) {
            reply = "Sorry, I had trouble fetching the status.";
        }
    }

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);
    return twiml.toString();
}
