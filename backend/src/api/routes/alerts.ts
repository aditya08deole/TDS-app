import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

function getDb() {
  return getFirestore();
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const status = req.query.status ? String(req.query.status) : '';

    let ref: FirebaseFirestore.Query = getDb().collection('alerts').orderBy('created_at', 'desc').limit(limit);
    if (status) {
      ref = getDb().collection('alerts').where('status', '==', status).orderBy('created_at', 'desc').limit(limit);
    }

    const snapshot = await ref.get();
    const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      timestamp: new Date().toISOString(),
    });
  }
});

router.put('/:id/read', requireRole('viewer'), async (req: Request, res: Response) => {
  try {
    const userId = String(req.headers['x-user-id'] || req.body.userId || 'unknown');
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

router.put('/:id/ack', requireRole('field_engineer'), async (req: Request, res: Response) => {
  try {
    const userId = String(req.headers['x-user-id'] || req.body.userId || 'unknown');
    await getDb().collection('alerts').doc(req.params.id).set({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert', timestamp: new Date().toISOString() });
  }
});

router.put('/:id/resolve', requireRole('field_engineer'), async (req: Request, res: Response) => {
  try {
    const userId = String(req.headers['x-user-id'] || req.body.userId || 'unknown');
    await getDb().collection('alerts').doc(req.params.id).set({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve alert', timestamp: new Date().toISOString() });
  }
});

router.get('/delivery-logs/list', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 300);
    const snapshot = await getDb()
      .collection('notification_delivery_logs')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: logs, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching delivery logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch delivery logs', timestamp: new Date().toISOString() });
  }
});

export default router;
