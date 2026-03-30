const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * Triggered when a new sensor reading is added.
 * Checks for TDS violations and creates alerts.
 */
exports.checkSensorData = functions.firestore
  .document("sensor_data/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { deviceId, payload, recorded_at } = data;
    const tds = payload?.tds;

    if (tds === undefined) return null;

    // Threshold logic (matching getTDSCategory in constants.ts)
    if (tds > 1000) {
      console.log(`🚨 TDS Violation: ${tds} ppm for device ${deviceId}`);
      
      // Get device name for the alert
      const deviceSnap = await db.collection("devices").doc(deviceId).get();
      const deviceName = deviceSnap.exists ? deviceSnap.data().name : deviceId;

      // Create an alert
      return db.collection("alerts").add({
        device_id: deviceId,
        device_name: deviceName,
        type: "CRITICAL_TDS",
        severity: "critical",
        message: `High TDS detected: ${tds} PPM`,
        value_at_time: tds,
        status: "open",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  });

/**
 * Scheduled task (every 5 minutes) to monitor device heartbeats.
 * Marks devices as OFFLINE if no data received for > 1 hour.
 */
exports.scheduledHealthCheck = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now().toMillis();
    const oneHourAgo = now - (60 * 60 * 1000);

    const devicesSnap = await db.collection("devices").get();
    const batch = db.batch();

    devicesSnap.forEach(doc => {
      const device = doc.data();
      const lastSeen = device.last_reading_at 
        ? new Date(device.last_reading_at).getTime() 
        : 0;

      if (lastSeen < oneHourAgo && device.connectivity_status !== "offline") {
        console.log(`🔌 Marking device ${doc.id} as OFFLINE`);
        batch.update(doc.ref, { 
            connectivity_status: "offline",
            status: "offline" 
        });
      }
    });

    return batch.commit();
  });
