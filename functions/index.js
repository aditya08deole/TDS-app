const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// Global in-memory cache for device configurations
const deviceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Triggered when a new alert is created in Firestore.
 * Dispatches real-time push notifications to all subscribed devices.
 */
exports.onAlertCreated = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {
    const alertData = snap.data();
    console.log(`🔔 Processing alert: ${alertData.message}`);

    try {
      // 1. Fetch all unique notification tokens from Firestore
      const subscriptionsSnap = await db.collection("notification_subscriptions").get();
      
      if (subscriptionsSnap.empty) {
          console.log("ℹ️ No active push subscriptions found.");
          return null;
      }

      const tokens = [];
      subscriptionsSnap.forEach(doc => {
          const sub = doc.data();
          if (sub.token) {
              tokens.push(sub.token);
          }
      });

      if (tokens.length === 0) return null;

      // 3. Construct the FCM message
      const message = {
        notification: {
          title: alertData.device_name ? `🚨 TDS Alert: ${alertData.device_name}` : "🚨 TDS Critical Alert",
          body: alertData.message || "A critical water quality event has been detected.",
        },
        data: {
          alertId: context.params.alertId,
          deviceId: alertData.device_id || "",
          severity: alertData.severity || "critical",
          url: "/alerts"
        },
        tokens: tokens,
      };

      // 4. Send Multicast
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Successfully sent ${response.successCount} push notifications.`);

      // ═══ WHATSAPP INTEGRATION ═══
      try {
        const twilioSid = process.env.TWILIO_ACCOUNT_SID || functions.config().twilio.sid;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || functions.config().twilio.token;
        const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || functions.config().twilio.from || "whatsapp:+14155238886";
        const adminPhone = process.env.ADMIN_WHATSAPP_TO || functions.config().twilio.admin_phone;

        if (twilioSid && twilioAuthToken && adminPhone) {
          const client = require("twilio")(twilioSid, twilioAuthToken);
          await client.messages.create({
            from: twilioFrom,
            body: `🚨 *EvaraTDS Alert*\n\n*Device:* ${alertData.device_name || alertData.device_id}\n*Severity:* ${alertData.severity.toUpperCase()}\n*Message:* ${alertData.message}\n\n_Reply STATUS for real-time update._`,
            to: `whatsapp:${adminPhone}`
          });
          console.log(`📱 WhatsApp alert sent to ${adminPhone}`);
        } else {
          console.log("ℹ️ WhatsApp integration skipped: Missing credentials or admin phone.");
        }
      } catch (waError) {
        console.error("❌ WhatsApp delivery failed:", waError.message);
      }

      // 5. Cleanup invalid tokens
      if (response.failureCount > 0) {
          const failedTokens = [];
          response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                  failedTokens.push(subscriptionsSnap.docs[idx].ref.delete());
                  console.warn(`🗑️ Removing invalid token for user ${subscriptionsSnap.docs[idx].data().user_id}`);
              }
          });
          await Promise.all(failedTokens);
      }
      
      return null;
    } catch (error) {
      console.error("❌ Error sending push notification:", error);
      return null;
    }
  });

/**
 * Triggered when a new sensor reading is added.
 * Checks for TDS violations and creates alerts.
 * 
 * FIX: Server-side deduplication — won't create a new alert if one
 * is already open for the same device. Also auto-resolves open alerts
 * when the device recovers to safe range.
 */
exports.checkSensorData = functions.firestore
  .document("sensor_data/{docId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const { deviceId, payload } = data;
    const tds = payload?.tds;

    let device;
    const now = Date.now();

    if (deviceCache[deviceId] && (now - deviceCache[deviceId].timestamp < CACHE_TTL)) {
      device = deviceCache[deviceId].data;
    } else {
      const deviceSnap = await db.collection("devices").doc(deviceId).get();
      if (!deviceSnap.exists) return null;
      device = deviceSnap.data();
      deviceCache[deviceId] = { data: device, timestamp: now };
    }

    // ═══ VALIDATION: Skip invalid readings (null, undefined, or unrealistic values)
    // Use per-device config for max threshold (allows brackish/saline water monitoring)
    const maxValidTds = device?.max_tds_threshold || 2000; // Default to 2000 PPM (realistic max)
    const minValidTds = device?.min_tds_threshold || 5;
    if (tds === undefined || tds === null || tds > maxValidTds || tds < minValidTds) return null;
    
    const thresholdMin = device.safe_tds_min ? Number(device.safe_tds_min) : 35;
    const thresholdMax = device.safe_tds_max ? Number(device.safe_tds_max) : 175;
    const deviceName = device.location_name || device.name || deviceId;

    const isCritical = tds < thresholdMin || tds > thresholdMax;

    if (isCritical) {
      // ═══ DEDUPLICATION: Check if an open alert already exists ═══
      const existingAlertSnap = await db.collection("alerts")
        .where("device_id", "==", deviceId)
        .where("status", "==", "open")
        .limit(1)
        .get();

      if (!existingAlertSnap.empty) {
        // Update the existing alert with the latest value instead of creating a new one
        const existingDoc = existingAlertSnap.docs[0];
        await existingDoc.ref.update({
          message: `High TDS detected: ${tds} PPM (Safe Range: ${thresholdMin}-${thresholdMax})`,
          value_at_time: tds,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`📝 Updated existing alert for device ${deviceId} with new value: ${tds} PPM`);
        return null; // Don't create a new alert = don't trigger a new notification
      }

      // No existing open alert — create a new one (this WILL trigger onAlertCreated)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      return db.collection("alerts").add({
        device_id: deviceId,
        device_name: deviceName,
        type: "CRITICAL_TDS",
        severity: "critical",
        message: `High TDS detected: ${tds} PPM (Safe Range: ${thresholdMin}-${thresholdMax})`,
        value_at_time: tds,
        status: "open",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: expiresAt, // For Firestore TTL automatic deletion
      });
    } else {
      // ═══ AUTO-RESOLVE: TDS is now in safe range, resolve any open alerts ═══
      const openAlertsSnap = await db.collection("alerts")
        .where("device_id", "==", deviceId)
        .where("status", "==", "open")
        .get();

      if (!openAlertsSnap.empty) {
        const batch = db.batch();
        openAlertsSnap.forEach((doc) => {
          batch.update(doc.ref, {
            status: "resolved",
            resolved_at: admin.firestore.FieldValue.serverTimestamp(),
            resolved_by: "server_auto_recovery",
            resolved_value: tds,
          });
        });
        await batch.commit();
        console.log(`✅ Auto-resolved ${openAlertsSnap.size} alert(s) for device ${deviceId} — TDS now safe at ${tds} PPM`);
      }
      return null;
    }
  });

/**
 * Scheduled task (every 5 minutes) to monitor device heartbeats
 * and clean up stale alerts.
 */
exports.scheduledHealthCheck = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now().toMillis();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneHourAgoDate = new Date(oneHourAgo);

    // ═══ OPTIMIZATION: Only fetch devices that actually need checking (last_reading_at < 1 hour ago)
    // This reduces Firestore reads from O(N) to O(stale_devices) — typically 5-10 devices per run
    // Firestore will auto-build composite index if missing (24 hour delay, but function stays backward compatible)
    const devicesSnap = await db.collection("devices")
      .where("last_reading_at", "<", oneHourAgoDate)
      .get();
    const batch = db.batch();

    devicesSnap.forEach(doc => {
      const device = doc.data();
      const lastSeen = device.last_reading_at 
        ? (device.last_reading_at._seconds ? device.last_reading_at._seconds * 1000 : new Date(device.last_reading_at).getTime())
        : 0;

      if (lastSeen < oneHourAgo && device.connectivity_status !== "offline") {
        batch.update(doc.ref, { 
            connectivity_status: "offline",
            status: "offline",
            last_offline_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    // ═══ STALE ALERT CLEANUP ═══
    // Resolve any alerts older than 2 hours that are still "open"
    const twoHoursAgo = new Date(now - (2 * 60 * 60 * 1000));
    const staleAlertsSnap = await db.collection("alerts")
      .where("status", "==", "open")
      .get();

    let staleCount = 0;
    staleAlertsSnap.forEach(doc => {
      const alert = doc.data();
      const createdAt = alert.created_at;
      let alertTime;
      
      if (createdAt && createdAt._seconds) {
        alertTime = new Date(createdAt._seconds * 1000);
      } else if (createdAt) {
        alertTime = new Date(createdAt);
      }

      if (alertTime && alertTime < twoHoursAgo) {
        batch.update(doc.ref, {
          status: "resolved",
          resolved_at: admin.firestore.FieldValue.serverTimestamp(),
          resolved_by: "scheduled_stale_cleanup",
        });
        staleCount++;
      }
    });

    if (staleCount > 0) {
      console.log(`🧹 Cleaned up ${staleCount} stale alert(s)`);
    }

    return batch.commit();
  });

/**
 * WhatsApp Bot Webhook
 * Responds to incoming WhatsApp messages from Twilio.
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  const body = req.body.Body ? req.body.Body.trim().toUpperCase() : "";
  const from = req.body.From;

  console.log(`📩 Received WhatsApp from ${from}: ${body}`);

  let reply = "Hello! I am the EvaraTDS Monitor Bot. \n\nCommands:\n- STATUS: Get latest readings\n- HELP: List commands";

  if (body === "STATUS") {
    try {
      const devicesSnap = await db.collection("devices").limit(5).get();
      if (devicesSnap.empty) {
        reply = "No devices found in the system.";
      } else {
        reply = "📊 *Latest TDS Readings:*\n";
        devicesSnap.forEach(doc => {
          const d = doc.data();
          const lastReading = d.last_reading_at ? 
            (d.last_reading_at._seconds ? new Date(d.last_reading_at._seconds * 1000).toLocaleTimeString() : new Date(d.last_reading_at).toLocaleTimeString()) 
            : "N/A";
          
          reply += `\n📍 *${d.location_name || d.name}*\n`;
          reply += `TDS: ${d.last_tds || "N/A"} PPM\n`;
          reply += `Temp: ${d.last_temperature || "N/A"}°C\n`;
          reply += `Status: ${d.status === "online" ? "🟢" : "🔴"} ${d.status.toUpperCase()}\n`;
          reply += `🕒 _Last Updated: ${lastReading}_\n`;
        });
      }
    } catch (err) {
      console.error("❌ Error fetching status for WhatsApp:", err);
      reply = "Sorry, I had trouble fetching the status. Please try again later.";
    }
  }

  // Twilio Messaging Response (TwiML)
  const twilio = require("twilio");
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);

  res.set("Content-Type", "text/xml");
  res.send(twiml.toString());
});
