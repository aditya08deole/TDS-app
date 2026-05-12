import cron from 'node-cron';
import { syncFromFirebase } from '../services/syncService';

let scheduledTask: any = null;

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

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('⏹️ Sync scheduler stopped');
  }
}

export function getSchedulerStatus(): any {
  return {
    isRunning: scheduledTask ? true : false,
    nextRun: scheduledTask ? 'Check logs' : 'Not running',
    interval: process.env.SYNC_INTERVAL_HOURS || '1 hour',
  };
}
