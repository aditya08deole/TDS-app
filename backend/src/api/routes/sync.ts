import { Router, Request, Response } from 'express';
import { syncFromFirebase, getLastSyncStatus } from '../../services/syncService';
import { getSchedulerStatus } from '../../sync/scheduler';
import { query as dbQuery } from '../../db/connection';

const router = Router();

/**
 * POST /api/sync
 * Trigger manual sync from Firebase to PostgreSQL
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
 * Get sync history logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const sql = `
      SELECT * FROM sync_log
      ORDER BY started_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await dbQuery(sql, [limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit,
        offset,
        count: result.rows.length,
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
 * Get sync logs summary statistics
 */
router.get('/logs/summary', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_syncs,
        AVG(duration_ms) as avg_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        SUM(devices_synced) as total_devices_synced,
        SUM(alerts_synced) as total_alerts_synced,
        SUM(errors) as total_errors
      FROM sync_log
      WHERE started_at > NOW() - INTERVAL '7 days'
    `;

    const result = await dbQuery(sql);

    res.json({
      success: true,
      data: result.rows[0],
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
