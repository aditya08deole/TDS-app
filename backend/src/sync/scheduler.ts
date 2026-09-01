import cron from 'node-cron';
import { syncFromFirebase } from '../services/syncService';
import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient } from '../db/redis';
import {
    sendHourlyReminders,
    triggerForceDeviceAlert,
    sendForcePushNotification,
    isDeviceSuppressed,
} from '../services/notificationService';
import { getAllDevices, updateDevice } from '../services/deviceService';
import { getLatestThingSpeakReading } from '../services/thingSpeakService';

function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

// ─── Scheduler Task Handles ──────────────────────────────────────────────────
// Fix #10: All task handles are tracked so stopScheduler() can stop ALL of them.
let scheduledTask: any = null;
let cleanupTask: any = null;
let heartbeatTask: any = null;
let reminderTask: any = null;
let thingSpeakTask: any = null;
let forceEngineTask: any = null; // Fix #10: Was untracked — leaked after stopScheduler()

/**
 * ThingSpeak Autonomous Ghost Engine
 * Fix #9: Reduced from 15-min to 2-min polling for near-real-time detection.
 * First breach fires immediately; subsequent blasts throttled to 1 per hour.
 */
export function startThingSpeakMonitorJob(): void {
    // Polls ThingSpeak every 10 minutes for threshold breaches
    thingSpeakTask = cron.schedule('*/10 * * * *', async () => {
        try {
            console.log('👻 [GHOST ENGINE] Starting autonomous ThingSpeak scan...');
            const devices = await getAllDevices();
            const criticalDevices: any[] = [];
            const now = Date.now();
            const ONE_HOUR_MS = 60 * 60 * 1000;

            for (const device of devices) {
                if (!device.thingspeak_channel_id) continue;

                const reading = await getLatestThingSpeakReading(device);
                if (!reading) continue;

                const tds = reading.tds;
                const maxLimit = device.safe_tds_max || 500;
                const isCritical = tds >= maxLimit;

                await updateDevice(device.id, {
                    last_tds: tds,
                    last_reading_at: reading.recorded_at,
                    status: isCritical ? 'critical' : (device.status === 'offline' ? 'online' : device.status)
                });

                if (isCritical) {
                    // Check if device is in 30-min alert or resolved cooldown window
                    const suppressed = await isDeviceSuppressed(device.id);
                    if (suppressed) {
                        console.log(`⏱️ [GHOST ENGINE] Device ${device.id} is in 30-min cooldown/resolution window — excluding from critical report.`);
                        continue;
                    }

                    criticalDevices.push({
                        id: device.id,
                        name: device.name,
                        location: device.location_name,
                        tds: tds,
                        time: reading.recorded_at
                    });

                    // Force-create individual alert — ensures APK shows the card immediately
                    await triggerForceDeviceAlert(device.id, tds, reading.recorded_at);
                }
            }

            if (criticalDevices.length > 0) {
                console.log(`🚨 [GHOST ENGINE] Found ${criticalDevices.length} critical devices! Checking force-timer...`);

                const redis = getRedis();
                const FORCE_TIMER_KEY = 'engine:force_report_last_sent';
                const lastSent = await redis.get(FORCE_TIMER_KEY);
                const lastSentTime = lastSent ? parseInt(lastSent) : 0;

                // Fire immediately on first breach (lastSentTime === 0), then throttle to 1hr
                if (now - lastSentTime >= ONE_HOUR_MS) {
                    // Send FCM push for the most critical device as a consolidated report
                    const worstDevice = criticalDevices.reduce((a, b) => (b.tds > a.tds ? b : a), criticalDevices[0]);
                    const reportId = `report-${Date.now()}`;
                    const consolidatedAlertData = {
                        message: `${criticalDevices.length} device(s) in critical state! Highest: ${worstDevice.tds} PPM`,
                        severity: 'critical',
                        device_id: 'SYSTEM_REPORT',
                        location_name: criticalDevices.length === 1
                            ? (worstDevice.location || worstDevice.name)
                            : `${criticalDevices.length} Critical Devices`,
                        value_at_time: worstDevice.tds,
                        recorded_at: worstDevice.time || new Date().toISOString(),
                        tds_value: worstDevice.tds,
                    };
                    await sendForcePushNotification(reportId, consolidatedAlertData, true);
                    await redis.set(FORCE_TIMER_KEY, String(now));
                    console.log('🔥 [GHOST ENGINE] FCM consolidated report dispatched.');
                } else {
                    console.log(`⏱️ [GHOST ENGINE] Force-timer active. Next report in ${Math.round((ONE_HOUR_MS - (now - lastSentTime)) / 60000)} mins.`);
                }
            } else {
                console.log('✅ [GHOST ENGINE] Scan complete. All systems healthy.');
            }
        } catch (error) {
            console.error('❌ [GHOST ENGINE] Job failed:', error);
        }
    });

    console.log('✅ ThingSpeak Ghost Engine active — polling every 10 mins.');
}

export function startScheduler(): void {
  const syncInterval = process.env.SYNC_INTERVAL_HOURS || '1';
  const hours = parseInt(syncInterval);

  if (isNaN(hours) || hours < 1 || hours > 24) {
    console.warn(`Invalid SYNC_INTERVAL_HOURS: ${syncInterval}, defaulting to 1 hour`);
  }

  const cronExpression = hours === 24 ? '0 0 * * *' : `0 */${hours} * * *`;

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log(`\n📅 [SCHEDULED SYNC] Running sync at ${new Date().toISOString()}`);
    try {
      const result = await syncFromFirebase('scheduled');
      console.log(`✅ Scheduled sync completed: ${result.devicesSynced} devices, ${result.alertsSynced} alerts`);
    } catch (error) {
      console.error('❌ Scheduled sync failed:', error);
    }
  });

  console.log(`✅ Sync scheduler started — every ${hours} hour(s) at pattern: ${cronExpression}`);
}

/**
 * Alert Cleanup Job — runs every minute.
 * Fix #14: Now only deletes RESOLVED alerts older than 24 hours.
 * Previously deleted all non-open alerts older than 10 minutes, destroying audit history.
 */
export function startAlertCleanupJob(): void {
  // Reduced to every 5 minutes — running every minute caused unnecessary Firestore full scans
  cleanupTask = cron.schedule('*/5 * * * *', async () => {
    try {
      const db = getDb();
      const redis = getRedis();

      // Fix #14: Preserve resolved alerts for 24 hours (was 10 minutes for ALL non-open alerts)
      const RESOLVED_TTL_HOURS = 24;
      const cutoffDate = new Date(Date.now() - RESOLVED_TTL_HOURS * 3600 * 1000);
      const cutoffISO = cutoffDate.toISOString();

      // Only delete alerts that are BOTH resolved AND older than 24 hours
      const resolvedSnapshot = await db
        .collection('alerts')
        .where('status', '==', 'resolved')
        .get();

      const oldAlerts = resolvedSnapshot.docs.filter(doc => {
        const resolvedAt = doc.data().resolved_at;
        return resolvedAt && new Date(resolvedAt) <= cutoffDate;
      });

      if (oldAlerts.length === 0) return;

      console.log(`🧹 [CLEANUP] Deleting ${oldAlerts.length} resolved alert(s) older than ${RESOLVED_TTL_HOURS}h...`);

      const batch = db.batch();
      let deleteCount = 0;

      for (const doc of oldAlerts) {
        const alertData = doc.data();

        // Safety guard: never delete open alerts
        if (alertData.status === 'open') {
          console.warn(`⚠️ [CLEANUP] Skipping open alert ${doc.id} (query filter mismatch)`);
          continue;
        }

        batch.delete(doc.ref);
        deleteCount++;

        const alertId = doc.id;
        const deviceId = typeof alertData.device_id === 'object' && alertData.device_id !== null
          ? (alertData.device_id as any).id
          : String(alertData.device_id || '');

        // Fire-and-forget Redis cleanup
        Promise.all([
          redis.del(`alert:${alertId}`),
          redis.sRem('alerts:all', alertId),
          deviceId ? redis.sRem(`device:${deviceId}:alerts`, alertId) : Promise.resolve(0),
          deviceId ? redis.sRem(`device:${deviceId}:alerts:open`, alertId) : Promise.resolve(0),
        ]).catch(e => console.error(`❌ Redis cleanup failed for alert ${alertId}:`, e));
      }

      if (deleteCount > 0) {
        await batch.commit();
        console.log(`✅ [CLEANUP] Deleted ${deleteCount} resolved alert(s).`);
      } else {
        console.log('✅ [CLEANUP] No eligible resolved alerts to delete.');
      }
    } catch (error) {
      console.error('❌ [CLEANUP] Alert cleanup job failed:', error);
    }
  });

  console.log('✅ Alert cleanup job started — 24hr retention for resolved alerts (runs every 5 min).');
}

/**
 * Device Heartbeat Job — runs every 5 minutes.
 * Marks devices as offline if no telemetry for 1+ hour.
 */
export function startDeviceHeartbeatJob(): void {
  heartbeatTask = cron.schedule('*/5 * * * *', async () => {
    try {
      const redis = getRedis();
      const db = getDb();

      const deviceIds = await redis.sMembers('devices:all');
      if (deviceIds.length === 0) return;

      const now = Date.now();
      const ONE_HOUR_MS = 60 * 60 * 1000;

      console.log(`💓 [HEARTBEAT] Checking connectivity for ${deviceIds.length} devices...`);

      for (const id of deviceIds) {
        const deviceJson = await redis.hGetAll(`device:${id}`);
        if (!deviceJson || Object.keys(deviceJson).length === 0) continue;

        const lastReadingAt = deviceJson.last_reading_at;
        const currentStatus = deviceJson.status;

        if (lastReadingAt && currentStatus !== 'offline') {
          const lastTime = new Date(lastReadingAt).getTime();
          if (now - lastTime > ONE_HOUR_MS) {
            console.log(`⚠️ Device ${deviceJson.name || id} inactive >1hr. Marking OFFLINE.`);

            await redis.hSet(`device:${id}`, 'status', 'offline');
            await redis.hSet(`device:${id}`, 'updated_at', new Date().toISOString());

            db.collection('devices').doc(id).update({
              status: 'offline',
              updated_at: new Date().toISOString()
            }).catch(e => console.error(`❌ Failed to sync offline status for ${id}:`, e));
          }
        }
      }
    } catch (error) {
      console.error('❌ Device heartbeat job failed:', error);
    }
  });

  console.log('✅ Device heartbeat job started — checking every 5 minutes.');
}

/**
 * Hourly Reminder Job — fires at :00 of every hour.
 * Separately: Force-Hunting Engine — every 5 min, re-dispatches if critical alert
 * still open and last notification was >1 hour ago.
 *
 * Fix #10: forceEngineTask now tracked in a module-level variable so
 * stopScheduler() can properly stop it.
 * Fix #22: Removed dynamic require() — functions imported statically at top.
 */
export function startHourlyReminderJob(): void {
    reminderTask = cron.schedule('0 * * * *', async () => {
        try {
            console.log('⏰ [CRON] Starting top-of-hour reminder job...');
            await sendHourlyReminders();
        } catch (error) {
            console.error('❌ Hourly reminder job failed:', error);
        }
    });

    // Fix #10: Store handle in module-level variable so stopScheduler() can stop it
    forceEngineTask = cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('🚀 [FORCE ENGINE] Scanning for unresolved critical alerts...');
            const db = getDb();
            const snapshot = await db.collection('alerts')
                .where('status', '==', 'open')
                .where('severity', '==', 'critical')
                .get();

            if (snapshot.empty) return;

            const now = Date.now();
            const ONE_HOUR_MS = 60 * 60 * 1000;

            for (const doc of snapshot.docs) {
                const alert = doc.data();
                const lastNotified = alert.last_notified_at ? new Date(alert.last_notified_at).getTime() : 0;

                if (now - lastNotified >= ONE_HOUR_MS) {
                    const alertData: any = { ...doc.data() };
                    const deviceId: string = alertData.device_id;

                    // Check if device is currently in 30-min resolved cooldown
                    if (deviceId) {
                        const suppressed = await isDeviceSuppressed(deviceId);
                        if (suppressed) {
                            console.log(`⏱️ [FORCE ENGINE] Device ${deviceId} is in 30-min cooldown/resolution — skipping re-delivery.`);
                            continue;
                        }
                    }

                    console.log(`🔥 [FORCE DISPATCH] Alert ${doc.id} still OPEN after 1hr. Forcing re-delivery...`);

                    // Refresh with latest device reading
                    if (deviceId && deviceId !== 'SYSTEM_REPORT') {
                        try {
                            const deviceDoc = await db.collection('devices').doc(deviceId).get();
                            if (deviceDoc.exists) {
                                const fresh = deviceDoc.data()!;
                                if (fresh.last_tds != null)  alertData.value_at_time = fresh.last_tds;
                                if (fresh.last_reading_at)   alertData.recorded_at   = fresh.last_reading_at;
                                console.log(`🔄 [FORCE DISPATCH] Refreshed device ${deviceId}: ppm=${fresh.last_tds}`);
                            }
                        } catch (refreshErr) {
                            console.warn(`⚠️ [FORCE DISPATCH] Could not refresh device ${deviceId}:`, refreshErr);
                        }
                    }

                    // Dispatch FCM-only — send push notification reminder
                    await sendForcePushNotification(doc.id, alertData, true);
                }
            }
        } catch (error) {
            console.error('❌ Force reminder engine failed:', error);
        }
    });

    console.log('✅ Hourly reminder job started — every hour at :00.');
    console.log('✅ Force Critical Engine active — checking every 5 minutes (now tracked).');
}

/**
 * Stop all scheduler tasks.
 * Fix #10: forceEngineTask is now properly stopped.
 */
export function stopScheduler(): void {
  const tasks: [string, any][] = [
    ['Sync scheduler', scheduledTask],
    ['Alert cleanup job', cleanupTask],
    ['Device heartbeat job', heartbeatTask],
    ['Hourly reminder job', reminderTask],
    ['ThingSpeak monitor job', thingSpeakTask],
    ['Force Critical Engine', forceEngineTask], // Fix #10: now tracked
  ];

  for (const [name, task] of tasks) {
    if (task) {
      task.stop();
      console.log(`⏹️ ${name} stopped`);
    }
  }

  scheduledTask = null;
  cleanupTask = null;
  heartbeatTask = null;
  reminderTask = null;
  thingSpeakTask = null;
  forceEngineTask = null; // Fix #10
}

/**
 * Returns the current status of all scheduler tasks.
 * Fix #26: Used by /health endpoint to report real scheduler state.
 */
export function getSchedulerStatus(): any {
  return {
    isRunning: !!scheduledTask,
    cleanupRunning: !!cleanupTask,
    heartbeatRunning: !!heartbeatTask,
    reminderRunning: !!reminderTask,
    thingSpeakMonitorRunning: !!thingSpeakTask,
    forceEngineRunning: !!forceEngineTask, // Fix #10: now reported
    nextRun: scheduledTask ? 'Check logs' : 'Not running',
    interval: process.env.SYNC_INTERVAL_HOURS || '1 hour',
    alertRetentionHours: 24,
    thingSpeakPollIntervalMins: 10, // Actual cron: */10 * * * *
  };
}
