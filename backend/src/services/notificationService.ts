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

// Twilio Config
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const adminPhone = process.env.ADMIN_WHATSAPP_TO;

let twilioClient: any = null;
if (twilioSid && twilioAuthToken) {
    twilioClient = twilio(twilioSid, twilioAuthToken);
    console.log('✅ Twilio initialized in Notification Service');
}

// ─── Rate Limiting (1 notification per device per hour) ──────────────────────

const RATE_LIMIT_TTL = 3600; // 1 hour in seconds
const RATE_LIMIT_KEY = (deviceId: string) => `notif:sent:${deviceId}`;

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
                        await sendWhatsAppNotification(alertData);
                        await sendNTFYNotification(alertData);
                        await triggerIFTTTWebhook(alertData);

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
        const db = getDb();
        const messaging = getMsg();
        const subscriptionsSnap = await db.collection('notification_subscriptions').get();
        if (subscriptionsSnap.empty) return;

        const tokens: string[] = [];
        subscriptionsSnap.forEach(doc => {
            const sub = doc.data();
            if (sub.token) tokens.push(sub.token);
        });

        if (tokens.length === 0) return;

        const message = {
            notification: {
                title: alertData.device_name ? `🚨 TDS Alert: ${alertData.device_name}` : '🚨 TDS Critical Alert',
                body: alertData.message || 'A critical water quality event has been detected.',
            },
            data: {
                alertId: alertId,
                deviceId: alertData.device_id || '',
                severity: alertData.severity || 'critical',
                url: '/alerts'
            },
            tokens: tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`✅ Sent ${response.successCount} push notifications.`);
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
    }
}

async function sendWhatsAppNotification(alertData: any) {
    if (!twilioClient || !adminPhone) {
        console.log('ℹ️ WhatsApp skipped: Missing Twilio config or Admin phone.');
        return;
    }

    try {
        await twilioClient.messages.create({
            from: twilioFrom,
            body: `🚨 *EvaraTDS Alert*\n\n*Device:* ${alertData.device_name || alertData.device_id}\n*Severity:* ${alertData.severity.toUpperCase()}\n*Message:* ${alertData.message}\n\n_Reply STATUS for real-time update._`,
            to: `whatsapp:${adminPhone}`
        });
        console.log(`📱 WhatsApp alert sent to ${adminPhone}`);
    } catch (error: any) {
        console.error('❌ WhatsApp delivery failed:', error.message);
    }
}

/**
 * NTFY.sh - Free System Notification Service
 * To receive these: Download 'ntfy' app on phone and subscribe to topic set in .env
 */
async function sendNTFYNotification(alertData: any) {
    const topic = process.env.NTFY_TOPIC;
    if (!topic) return;

    try {
        const response = await fetch(`https://ntfy.sh/${topic}`, {
            method: 'POST',
            body: `ALERT: ${alertData.message}`,
            headers: {
                'Title': `🚨 TDS Critical Alert: ${alertData.device_name || 'System'}`,
                'Priority': '5', // Urgent
                'Tags': 'warning,skull'
            }
        });
        if (response.ok) {
            console.log(`📲 NTFY System Notification sent to topic: ${topic}`);
        }
    } catch (error) {
        console.error('❌ NTFY delivery failed:', error);
    }
}

/**
 * IFTTT Webhook Trigger — fires only when rate limit allows
 */
async function triggerIFTTTWebhook(alertData: any) {
    const key = process.env.IFTTT_WEBHOOK_KEY;
    const event = process.env.IFTTT_EVENT_NAME || 'tds_alert';
    if (!key) {
        console.log('ℹ️ IFTTT skipped: IFTTT_WEBHOOK_KEY not set.');
        return;
    }

    try {
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
        } else {
            console.warn(`⚠️ IFTTT responded with status ${response.status}`);
        }
    } catch (error) {
        console.error('❌ IFTTT trigger failed:', error);
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
    await sendPushNotification('test-' + Date.now(), alertData);
    await sendWhatsAppNotification(alertData);
    await sendNTFYNotification(alertData);
    await triggerIFTTTWebhook(alertData);
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
