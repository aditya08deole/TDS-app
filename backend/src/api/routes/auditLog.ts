import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

function getDb() { return getFirestore(); }

/**
 * GET /api/audit-log
 * Lists audit_log entries (device exports, invites, role changes, alert
 * resolutions) newest-first. super_admin only — this log includes who
 * changed whose role, which is more sensitive than the export_data bar.
 */
router.get('/', requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const action = req.query.action ? String(req.query.action) : '';

    let query: FirebaseFirestore.Query = getDb().collection('audit_log');
    if (action) {
      query = query.where('action', '==', action);
    }
    const snapshot = await query.orderBy('timestamp', 'desc').limit(limit).get();

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
