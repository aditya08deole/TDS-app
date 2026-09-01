import cron from 'node-cron';
import { syncFromFirebase } from '../services/syncService';
import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient } from '../db/redis';
import { triggerForceDeviceAlert } from '../services/notificationService';
import { getAllDevices, updateDevice } from '../services/deviceService';
import { getLatestThingSpeakReading } from '../services/thingSpeakService';

function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

// ─── Scheduler Task Handles ──────────────────────────────────────────────────
// Fix #10: All task handles are tracked so stopScheduler() can stop ALL of them.
let scheduledTask: any = null;
let cleanupTask: any = null;
let heartbeatTask: any = null;
let thingSpeakTask: any = null;

/**
 * ThingSpeak Autonomous Ghost Engine
 * Polls every 10 minutes for near-real-time detection of threshold breaches.
 * First breach fires immediately; subsequent blasts throttled to 1 per hour.
 */
export function startThingSpeakMonitorJob(): void {
    // Polls ThingSpeak every 10 minutes for threshold breaches
    thingSpeakTask = cron.schedule('*/10 * * * *', async () => {
        try {
            console.log('👻 [GHOST ENGINE] Starting autonomous ThingSpeak scan...');
            const devices = await getAllDevices();
            let criticalCount = 0;

            for (const device of devices) {
                if (!device.thingspeak_channel_id) continue;

                const reading = await getLatestThingSpeakReading(device);
                if (!reading) continue;

                const tds = reading.tds;
                const maxLimit = device.safe_tds_max ?? 500;
                const minLimit = device.safe_tds_min ?? 0;
                // Fix: this previously only checked the upper bound, so a
                // TDS_LOW breach (tds below safe_tds_min) was never detected
                // by ThingSpeak polling — only by direct telemetry ingestion.
                const isCritical = tds >= maxLimit || tds < minLimit;

                await updateDevice(device.id, {
                    last_tds: tds,
                    last_reading_at: reading.recorded_at,
                    status: isCritical ? 'critical' : (device.status === 'offline' ? 'online' : device.status)
                });

                if (isCritical) {
                    criticalCount++;
                    // triggerForceDeviceAlert -> processThresholdBreach owns the
                    // full state machine internally (new alert / re-notify while
                    // open / ack-cooldown / reopen), so no pre-check is needed here.
                    await triggerForceDeviceAlert(device.id, tds, reading.recorded_at);
                }
            }

            console.log(criticalCount > 0
                ? `🚨 [GHOST ENGINE] Scan complete. ${criticalCount} device(s) critical.`
                : '✅ [GHOST ENGINE] Scan complete. All systems healthy.');
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
 * Stop all scheduler tasks.
 */
export function stopScheduler(): void {
  const tasks: [string, any][] = [
    ['Sync scheduler', scheduledTask],
    ['Alert cleanup job', cleanupTask],
    ['Device heartbeat job', heartbeatTask],
    ['ThingSpeak monitor job', thingSpeakTask],
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
  thingSpeakTask = null;
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
    thingSpeakMonitorRunning: !!thingSpeakTask,
    nextRun: scheduledTask ? 'Check logs' : 'Not running',
    interval: process.env.SYNC_INTERVAL_HOURS || '1 hour',
    alertRetentionHours: 24,
    thingSpeakPollIntervalMins: 10, // Actual cron: */10 * * * *
  };
}
