const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// Global in-memory cache for device configurations
const deviceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * DEPRECATED: Notification dispatch moved to Backend Service (notificationService.ts).
 * Keeping the trigger to avoid breaking infrastructure but returning early.
 */
exports.onAlertCreated = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {
    // Moved to Backend notificationService.ts for real-time Redis coordination.
    return null;
  });


/**
 * DEPRECATED: Threshold checking moved to Backend Service (telemetryService.ts).
 * Keeping the trigger to avoid breaking infrastructure but returning early.
 */
exports.checkSensorData = functions.firestore
  .document("sensor_data/{docId}")
  .onCreate(async (snap) => {
    // Moved to Backend telemetryService.ts for Redis-backed reliability and hysteresis.
    return null;
  });


/**
 * Scheduled task (every 5 minutes) to monitor device heartbeats
 * and clean up stale alerts.
 */
exports.scheduledHealthCheck = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
    // ⚠️ DISABLED: Heartbeat logic moved to Backend scheduler.ts
    return null;
});

/**
 * WhatsApp Bot Webhook
 * Responds to incoming WhatsApp messages from Twilio.
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // ⚠️ DISABLED: WhatsApp Webhook logic moved to Backend /api/notifications/whatsapp
    res.status(410).send('WhatsApp Webhook has been moved to the Backend Service.');
});
