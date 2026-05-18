const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// Global in-memory cache for device configurations
const deviceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes



/**
 * WhatsApp Bot Webhook
 * Responds to incoming WhatsApp messages from Twilio.
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // ⚠️ DISABLED: WhatsApp Webhook logic moved to Backend /api/notifications/whatsapp
    res.status(410).send('WhatsApp Webhook has been moved to the Backend Service.');
});
