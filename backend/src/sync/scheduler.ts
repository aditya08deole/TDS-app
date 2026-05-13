import cron from 'node-cron';
import { syncFromFirebase } from '../services/syncService';
import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient } from '../db/redis';

function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

let scheduledTask: any = null;
let cleanupTask: any = null;

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

      // Cutoff = now minus 10 minutes
      const cutoffDate = new Date(Date.now() - 10 * 60 * 1000);
      const cutoffISO = cutoffDate.toISOString();

      // Query for alerts older than the cutoff
      const oldAlerts = await db
        .collection('alerts')
        .where('created_at', '<=', cutoffISO)
        .get();

      if (oldAlerts.empty) return; // Nothing to clean up

      console.log(`🧹 [CLEANUP] Deleting ${oldAlerts.size} alert(s) older than 10 minutes...`);

      const batch = db.batch();

      for (const doc of oldAlerts.docs) {
        batch.delete(doc.ref);

        // Clean up Redis in parallel
        const alertData = doc.data();
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

      await batch.commit();
      console.log(`✅ [CLEANUP] Deleted ${oldAlerts.size} old alert(s) from Firestore.`);
    } catch (error) {
      console.error('❌ [CLEANUP] Alert cleanup job failed:', error);
    }
  });

  console.log('✅ Alert cleanup job started — running every minute (10-min TTL on alerts).');
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
}

export function getSchedulerStatus(): any {
  return {
    isRunning: scheduledTask ? true : false,
    cleanupRunning: cleanupTask ? true : false,
    nextRun: scheduledTask ? 'Check logs' : 'Not running',
    interval: process.env.SYNC_INTERVAL_HOURS || '1 hour',
    alertCleanupTtlMinutes: 10,
  };
}
