import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient } from '../../db/redis';
import { requireRole } from '../middleware/roleGuard';
import { RESOLVED_COOLDOWN_KEY, RESOLVED_COOLDOWN_TTL, ACK_COOLDOWN_KEY, ACK_COOLDOWN_TTL } from '../../services/notificationService';

const router = Router();

function getDb() { return getFirestore(); }
function getRedis() { return getRedisClient(); }

// ─── GET /api/alerts — List active alerts ───────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const requestedStatus = req.query.status ? String(req.query.status) : '';
    const includeResolved = req.query.include_resolved === 'true';

    let snapshot: FirebaseFirestore.QuerySnapshot;
    if (requestedStatus) {
      // Single-status filter with server-side ordering + limit
      snapshot = await getDb().collection('alerts')
        .where('status', '==', requestedStatus)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
    } else if (includeResolved) {
      // All alerts — server-side ordered + limited
      snapshot = await getDb().collection('alerts')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
    } else {
      // Default: only active (open + acknowledged) — Firestore 'in' doesn't support orderBy
      // so we fetch both statuses separately and merge, then sort in-memory.
      // This is necessary because Firestore composite indexes don't support 'in' + orderBy
      // without explicit composite index creation.
      snapshot = await getDb().collection('alerts')
        .where('status', 'in', ['open', 'acknowledged'])
        .get();
    }

    let alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // In-memory sort only needed for the 'in' query path which can't use server-side orderBy
    alerts.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (alerts.length > limit) alerts = alerts.slice(0, limit);

    res.json({ success: true, data: alerts, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts', timestamp: new Date().toISOString() });
  }
});

// ─── PUT /api/alerts/:id/read — Mark alert as read ───────────────────────────
router.put('/:id/read', requireRole('viewer'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid || String(req.headers['x-user-id'] || 'unknown');
    await getDb().collection('alerts').doc(req.params.id).set({
      read_at: new Date().toISOString(),
      read_by: userId,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark alert as read', timestamp: new Date().toISOString() });
  }
});

// ─── PUT /api/alerts/:id/ack — Acknowledge alert ─────────────────────────────
router.put('/:id/ack', requireRole('field_engineer'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid || String(req.headers['x-user-id'] || 'unknown');
    const alertRef = getDb().collection('alerts').doc(req.params.id);
    const alertSnap = await alertRef.get();
    const acknowledgedAt = new Date().toISOString();

    await alertRef.set({
      status: 'acknowledged',
      acknowledged_at: acknowledgedAt,
      acknowledged_by: userId,
      updated_at: acknowledgedAt,
    }, { merge: true });

    // Start the 1-hour quiet period — processThresholdBreach() checks this key
    // and won't re-notify (or reopen the alert) until it expires, even if the
    // device keeps reporting breaching readings in the meantime.
    const deviceId = alertSnap.exists
      ? (typeof alertSnap.data()!.device_id === 'object' && alertSnap.data()!.device_id !== null
        ? (alertSnap.data()!.device_id as any).id
        : String(alertSnap.data()!.device_id || ''))
      : '';
    if (deviceId) {
      await getRedis().set(ACK_COOLDOWN_KEY(deviceId), '1', { EX: ACK_COOLDOWN_TTL });
    }

    res.json({ success: true, timestamp: acknowledgedAt });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert', timestamp: new Date().toISOString() });
  }
});

// ─── PUT /api/alerts/:id/resolve — Resolve alert (admin/maintenance/super_admin only) ───
/**
 * Role-gated alert resolution with 30-minute device cooldown.
 *
 * When an admin or maintenance crew member resolves an alert:
 * 1. Alert status is set to 'resolved' in Firestore with who resolved it
 * 2. A 30-minute resolved cooldown key is set in Redis for the device
 *    → Even if TDS is still breaching, no new notification fires for 30 minutes
 * 3. The device's open-alert Redis set is cleared
 * 4. Device status is reset to 'online' in Firestore
 * 5. An audit log entry is written
 *
 * After 30 minutes, if TDS is still breaching on next telemetry:
 * → The cooldown key has expired → isDeviceSuppressed() returns false
 * → A fresh alert + FCM notification fires again
 */
router.put('/:id/resolve', requireRole('field_engineer'), async (req: Request, res: Response) => {
  try {
    const alertId = req.params.id;
    const db = getDb();
    const redis = getRedis();
    const resolvedBy = req.user?.uid || String(req.headers['x-user-id'] || 'unknown');
    const resolvedByRole = req.user?.role || 'unknown';
    const resolutionNote = req.body?.note?.trim() || 'Manually resolved by operator';

    // 1. Fetch the alert to get the device ID
    const alertRef = db.collection('alerts').doc(alertId);
    const alertSnap = await alertRef.get();

    if (!alertSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        timestamp: new Date().toISOString(),
      });
    }

    const alertData = alertSnap.data()!;

    // Prevent double-resolution
    if (alertData.status === 'resolved') {
      return res.status(409).json({
        success: false,
        error: 'Alert is already resolved',
        timestamp: new Date().toISOString(),
      });
    }

    const deviceId = typeof alertData.device_id === 'object' && alertData.device_id !== null
      ? (alertData.device_id as any).id
      : String(alertData.device_id || '');

    const resolvedAt = new Date().toISOString();

    // 2. Update the alert document in Firestore
    await alertRef.update({
      status: 'resolved',
      resolved_at: resolvedAt,
      resolved_by: resolvedBy,
      resolved_by_role: resolvedByRole,
      resolution_note: resolutionNote,
      updated_at: resolvedAt,
    });

    // 3. Set the 30-minute resolved cooldown in Redis
    //    → Prevents fresh FCM even if TDS is still breaching
    await redis.set(RESOLVED_COOLDOWN_KEY(deviceId), '1', { EX: RESOLVED_COOLDOWN_TTL });
    console.log(`🔒 [RESOLVE] Device ${deviceId} in 30-min resolved cooldown — set by ${resolvedByRole} ${resolvedBy}`);

    // 4. Remove from Redis open-alert tracking
    await redis.sRem(`device:${deviceId}:alerts:open`, alertId);

    // 5. Reset the device status to 'online' in Firestore + Redis
    if (deviceId) {
      db.collection('devices').doc(deviceId).update({
        status: 'online',
        updated_at: resolvedAt,
      }).catch(e => console.warn('[RESOLVE] Device status update failed:', e));

      redis.hSet(`device:${deviceId}`, 'status', 'online').catch(() => {});
    }

    // 6. Write audit log for traceability
    db.collection('audit_log').add({
      action: 'alert_resolved',
      alert_id: alertId,
      device_id: deviceId,
      resolved_by: resolvedBy,
      resolved_by_role: resolvedByRole,
      resolution_note: resolutionNote,
      resolved_at: resolvedAt,
      timestamp: resolvedAt,
    }).catch(e => console.warn('[RESOLVE] Audit log write failed:', e));

    console.log(`✅ [RESOLVE] Alert ${alertId} resolved by ${resolvedByRole} ${resolvedBy}. 30-min cooldown active for device ${deviceId}.`);

    return res.json({
      success: true,
      message: 'Alert resolved. 30-minute notification cooldown is now active for this device.',
      resolved_at: resolvedAt,
      resolved_by: resolvedBy,
      cooldown_minutes: 30,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error resolving alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      timestamp: new Date().toISOString(),
    });
  }
});



export default router;
