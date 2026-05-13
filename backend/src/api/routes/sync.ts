import { Router, Request, Response } from 'express';
import { syncFromFirebase, getLastSyncStatus } from '../../services/syncService';
import { getSchedulerStatus } from '../../sync/scheduler';
import { getRedisClient } from '../../db/redis';

const router = Router();

/**
 * POST /api/sync
 * Trigger manual sync from Firebase to Redis Mirror
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // 🛡️ SECURITY: Require a secret key for manual sync
    const authKey = req.query.key || req.headers['x-sync-key'] || req.headers['x-db-init-key'];
    const requiredKey = process.env.DB_INIT_KEY;

    if (!requiredKey || authKey !== requiredKey) {
      console.warn(`⚠️ Unauthorized manual sync attempt from IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Manual sync requires a valid DB_INIT_KEY',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('🚀 Manual sync triggered from API');

    const result = await syncFromFirebase('manual');

    res.json({
      success: true,
      data: {
        type: result.type,
        devicesSynced: result.devicesSynced,
        alertsSynced: result.alertsSynced,
        sensorEntriesSynced: result.sensorEntriesSynced,
        errors: result.errors,
        durationMs: result.durationMs,
        message: `Synced ${result.devicesSynced} devices and ${result.alertsSynced} alerts in ${result.durationMs}ms`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual sync error:', error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/sync/status
 * Get last sync status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const syncLogs = await getLastSyncStatus();
    const schedulerStatus = getSchedulerStatus();

    res.json({
      success: true,
      data: {
        scheduler: schedulerStatus,
        lastSyncs: syncLogs,
        summary: {
          lastSync: syncLogs[0] || null,
          totalDevicesSynced: syncLogs.reduce((sum: number, log: any) => sum + (log.devices_synced || 0), 0),
          totalAlertsSynced: syncLogs.reduce((sum: number, log: any) => sum + (log.alerts_synced || 0), 0),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/sync/logs
 * Get sync history logs from Redis
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const redis = getRedisClient();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const logs = await redis.lRange('sync:logs', offset, offset + limit - 1);
    const parsedLogs = logs.map(l => JSON.parse(l));

    res.json({
      success: true,
      data: parsedLogs,
      pagination: {
        limit,
        offset,
        count: parsedLogs.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching sync logs:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync logs',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/sync/logs/summary
 * Get sync logs summary statistics from Redis
 */
router.get('/logs/summary', async (req: Request, res: Response) => {
  try {
    const redis = getRedisClient();
    const logs = await redis.lRange('sync:logs', 0, -1);
    const parsedLogs = logs.map(l => JSON.parse(l));

    const summary = {
      total_syncs: parsedLogs.length,
      successful_syncs: parsedLogs.filter(l => l.status === 'success').length,
      failed_syncs: parsedLogs.filter(l => l.status === 'failed').length,
      partial_syncs: parsedLogs.filter(l => l.status === 'partial').length,
      avg_duration_ms: parsedLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / (parsedLogs.length || 1),
      max_duration_ms: Math.max(...parsedLogs.map(l => l.duration_ms || 0), 0),
      min_duration_ms: Math.min(...parsedLogs.map(l => l.duration_ms || 0), 100000),
      total_devices_synced: parsedLogs.reduce((sum, l) => sum + (l.devices_synced || 0), 0),
      total_alerts_synced: parsedLogs.reduce((sum, l) => sum + (l.alerts_synced || 0), 0),
      total_errors: parsedLogs.reduce((sum, l) => sum + (l.errors || 0), 0),
    };

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching sync summary:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync summary',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
