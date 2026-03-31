const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// Global in-memory cache for device configurations (persists across warm starts)
const deviceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Triggered when a new sensor reading is added.
 * Checks for TDS violations and creates alerts.
 */
exports.checkSensorData = functions.firestore
  .document("sensor_data/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { deviceId, payload } = data;
    const tds = payload?.tds;

    if (tds === undefined) return null;

    let device;
    const now = Date.now();

    // Check cache first
    if (deviceCache[deviceId] && (now - deviceCache[deviceId].timestamp < CACHE_TTL)) {
      device = deviceCache[deviceId].data;
      console.log(`ℹ️ Using cached config for device ${deviceId}`);
    } else {
      // Get device configuration for dynamic thresholds
      const deviceSnap = await db.collection("devices").doc(deviceId).get();
      if (!deviceSnap.exists) {
        console.warn(`Device ${deviceId} not found for sensor check.`);
        return null;
      }
      device = deviceSnap.data();
      // Update cache
      deviceCache[deviceId] = {
        data: device,
        timestamp: now
      };
      console.log(`📥 Fetched and cached config for device ${deviceId}`);
    }
    
    const threshold = device.safe_tds_max ? Number(device.safe_tds_max) : 1000;
    const deviceName = device.location_name || device.name || deviceId;

    // Dynamic threshold logic
    if (tds > threshold) {
      console.log(`🚨 TDS Violation: ${tds} ppm for device ${deviceName} (Threshold: ${threshold})`);

      // Create an alert
      return db.collection("alerts").add({
        device_id: deviceId,
        device_name: deviceName,
        type: "CRITICAL_TDS",
        severity: "critical",
        message: `High TDS detected: ${tds} PPM (Threshold: ${threshold})`,
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
        ? (device.last_reading_at._seconds ? device.last_reading_at._seconds * 1000 : new Date(device.last_reading_at).getTime())
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
