import cron from 'node-cron';
import { syncFromFirebase } from '../services/syncService';
import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient } from '../db/redis';
import { sendHourlyReminders } from '../services/notificationService';

function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

let scheduledTask: any = null;
let cleanupTask: any = null;
let heartbeatTask: any = null;
let reminderTask: any = null;

export function startScheduler(): void {
  const syncInterval = process.env.SYNC_INTERVAL_HOURS || '1';
  const hours = parseInt(syncInterval);

  if (hours < 1 || hours > 24) {
    console.warn(`Invalid SYNC_INTERVAL_HOURS: ${syncInterval}, defaulting to 1 hour`);
  }

  // Schedule sync every N hours at :00 minutes
  // For 1 hour: "0 * * * *" (every hour at :00)
  // For 2 hours: "0 */2 * * *" (every 2 hours at :00)
  // For 24 hours: "0 0 * * *" (daily at midnight)

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

  console.log(`✅ Sync scheduler started - running every ${hours} hour(s) at pattern: ${cronExpression}`);
}

/**
 * Alert Cleanup Job — runs every minute.
 * Deletes Firestore alert documents older than 10 minutes.
 * Also cleans up associated Redis keys to keep memory in sync.
 */
export function startAlertCleanupJob(): void {
  cleanupTask = cron.schedule('* * * * *', async () => {
    try {
      const db = getDb();
      const redis = getRedis();

      // Cutoff = now minus 10 minutes (or 24 hours in dev)
      const isDev = process.env.NODE_ENV !== 'production';
      const ttlMinutes = isDev ? 24 * 60 : 10;
      const cutoffDate = new Date(Date.now() - ttlMinutes * 60 * 1000);
      const cutoffISO = cutoffDate.toISOString();

      // Query for alerts older than the cutoff
      const oldAlerts = await db
        .collection('alerts')
        .where('created_at', '<=', cutoffISO)
        .get();

      if (oldAlerts.empty) return; // Nothing to clean up

      console.log(`🧹 [CLEANUP] Deleting ${oldAlerts.size} alert(s) older than ${ttlMinutes} minutes...`);

      const batch = db.batch();
      let deleteCount = 0;

      for (const doc of oldAlerts.docs) {
        const alertData = doc.data();
        
        // Skip 'open' alerts — we want to keep them for hourly notifications
        if (alertData.status === 'open') {
            console.log(`ℹ️ [CLEANUP] Skipping open alert ${doc.id} for device ${alertData.device_id}`);
            continue;
        }

        batch.delete(doc.ref);
        deleteCount++;

        // Clean up Redis in parallel
        const alertId = doc.id;
        const deviceId = typeof alertData.device_id === 'object' && alertData.device_id !== null
          ? (alertData.device_id as any).id
          : String(alertData.device_id || '');

        // Fire-and-forget Redis cleanup (non-blocking)
        Promise.all([
          redis.del(`alert:${alertId}`),
          redis.sRem('alerts:all', alertId),
          deviceId ? redis.sRem(`device:${deviceId}:alerts`, alertId) : Promise.resolve(0),
          deviceId ? redis.sRem(`device:${deviceId}:alerts:open`, alertId) : Promise.resolve(0),
        ]).catch(e => console.error(`❌ Redis cleanup failed for alert ${alertId}:`, e));
      }

      if (deleteCount > 0) {
          await batch.commit();
          console.log(`✅ [CLEANUP] Deleted ${deleteCount} old alert(s) from Firestore.`);
      } else {
          console.log(`✅ [CLEANUP] No old non-open alerts to delete.`);
      }
    } catch (error) {
      console.error('❌ [CLEANUP] Alert cleanup job failed:', error);
    }
  });

  console.log('✅ Alert cleanup job started — running every minute (10-min TTL on alerts).');
}

/**
 * Device Heartbeat Job — runs every 5 minutes.
 * Checks all devices for inactivity. If a device hasn't sent telemetry in 1 hour,
 * it is marked as 'offline'.
 */
export function startDeviceHeartbeatJob(): void {
  heartbeatTask = cron.schedule('*/5 * * * *', async () => {
    try {
      const redis = getRedis();
      const db = getDb();
      
      // 1. Get all device IDs from Redis
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
            console.log(`⚠️ Device ${deviceJson.name || id} is inactive for >1hr. Marking OFFLINE.`);
            
            // Update Redis
            await redis.hSet(`device:${id}`, 'status', 'offline');
            await redis.hSet(`device:${id}`, 'updated_at', new Date().toISOString());

            // Update Firestore (non-blocking)
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

  console.log('✅ Device heartbeat job started — checking every 5 minutes (1-hr inactivity threshold).');
}

/**
 * Hourly Notification Reminder Job — runs at minute 0 of every hour.
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

    // ── NEW: Force-Hunting Critical Alerts ──
    // Runs every 5 minutes and FORCES a notification if alert is still open
    // and was last notified more than 60 minutes ago.
    cron.schedule('*/5 * * * *', async () => {
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
                    console.log(`🔥 [FORCE DISPATCH] Alert ${doc.id} is still OPEN after 1hr. Forcing re-delivery...`);
                    // Call channel dispatchers directly
                    // Note: alerts in FS might not be in Redis memory-fallback, so we use FS data.
                    const alertData = doc.data();
                    
                    // We bypass dedupe by passing isReminder = true
                    // and manually trigger the main channel functions
                    // These functions are imported from '../services/notificationService'
                    // but we are already in the scheduler, which imports from there.
                    const { 
                        sendPushNotification, 
                        sendWhatsAppNotification, 
                        sendNTFYNotification, 
                        triggerIFTTTWebhook 
                    } = require('../services/notificationService');

                    await Promise.all([
                        sendPushNotification(doc.id, alertData, true),
                        sendWhatsAppNotification(doc.id, alertData, true),
                        sendNTFYNotification(doc.id, alertData, true),
                        triggerIFTTTWebhook(doc.id, alertData, true)
                    ]);
                }
            }
        } catch (error) {
            console.error('❌ Force reminder engine failed:', error);
        }
    });

    console.log('✅ Hourly reminder job started — running every hour at :00.');
    console.log('✅ Force Critical Engine active — checking every 5 minutes.');
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('⏹️ Sync scheduler stopped');
  }
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
    console.log('⏹️ Alert cleanup job stopped');
  }
  if (heartbeatTask) {
    heartbeatTask.stop();
    heartbeatTask = null;
    console.log('⏹️ Device heartbeat job stopped');
  }
  if (reminderTask) {
    reminderTask.stop();
    reminderTask = null;
    console.log('⏹️ Hourly reminder job stopped');
  }
}

export function getSchedulerStatus(): any {
  return {
    isRunning: scheduledTask ? true : false,
    cleanupRunning: cleanupTask ? true : false,
    heartbeatRunning: heartbeatTask ? true : false,
    reminderRunning: reminderTask ? true : false,
    nextRun: scheduledTask ? 'Check logs' : 'Not running',
    interval: process.env.SYNC_INTERVAL_HOURS || '1 hour',
    alertCleanupTtlMinutes: 10,
  };
}
