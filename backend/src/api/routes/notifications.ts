import express, { Request, Response } from 'express';
import {
    triggerForceDeviceAlert,
    FCM_TOKEN_CACHE_KEY,
} from '../../services/notificationService';
import { requireRole } from '../middleware/roleGuard';

const router = express.Router();

/**
 * POST /api/notifications/test
 * Manually trigger a test FCM push notification for a specific device.
 * Works even when the dashboard tab is closed — runs server-side.
 * Body: { deviceId: string }
 */
router.post('/test', requireRole('admin'), async (req: Request, res: Response) => {
    const { deviceId } = req.body;

    if (!deviceId) {
        return res.status(400).json({ success: false, error: 'deviceId is required.' });
    }

    try {
        await triggerForceDeviceAlert(
            String(deviceId),
            999, // Test TDS value
            new Date().toISOString()
        );

        return res.status(200).json({
            success: true,
            message: 'Test FCM push notification dispatched.',
            channels: ['push'],
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ Test notification failed:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to dispatch test notification.' });
    }
});

/**
 * POST /api/notifications/register-token
 * Registers a native Android (Capacitor) or web FCM token.
 * The token is stored in notification_subscriptions so the backend push dispatcher
 * includes this device automatically on the next multicast call.
 *
 * Body: { token: string, platform: string, userId?: string, userAgent?: string }
 */
router.post('/register-token', async (req: Request, res: Response) => {
    const { token, platform, userId, userAgent } = req.body;

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
        return res.status(400).json({ success: false, error: 'Valid token is required.' });
    }

    try {
        const { getFirestore } = await import('firebase-admin/firestore');
        const { getRedisClient } = await import('../../db/redis');
        const db = getFirestore();
        const redis = getRedisClient();

        const safeUserId = userId ? String(userId).trim() : 'anonymous';
        const cleanToken = token.trim();
        const tokenHash = Buffer.from(cleanToken).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
        const docId = `${safeUserId}_${tokenHash}`;

        console.log(`[FCM-REGISTER] Storing token for user=${safeUserId}, platform=${platform}, docId=${docId}`);

        // If a real userId is provided, clean up old anonymous docs for this same token.
        // This prevents orphaned 'anonymous' entries that cause duplicate deliveries.
        if (safeUserId !== 'anonymous') {
            try {
                const anonSnap = await db.collection('notification_subscriptions')
                    .where('token', '==', cleanToken)
                    .where('user_id', '==', 'anonymous')
                    .get();

                if (!anonSnap.empty) {
                    const batch = db.batch();
                    anonSnap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();

                    await redis.sRem(FCM_TOKEN_CACHE_KEY, cleanToken);
                    await redis.sAdd(`cache:user_tokens:${safeUserId}`, cleanToken);
                    await redis.expire(`cache:user_tokens:${safeUserId}`, 86400);
                    console.log(`🔁 [FCM-REGISTER] Migrated ${anonSnap.size} anonymous token(s) to user ${safeUserId}`);
                }
            } catch (migrateErr) {
                console.warn('[FCM-REGISTER] Anonymous migration failed (non-fatal):', migrateErr);
            }
        }

        await db.collection('notification_subscriptions').doc(docId).set({
            token: cleanToken,
            user_id: safeUserId,
            platform: platform || 'android_native',
            userAgent: userAgent || 'native',
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
        }, { merge: true });

        // Update Redis immediately
        await redis.sAdd(FCM_TOKEN_CACHE_KEY, cleanToken);
        if (safeUserId !== 'anonymous') {
            await redis.sAdd(`cache:user_tokens:${safeUserId}`, cleanToken);
            await redis.expire(`cache:user_tokens:${safeUserId}`, 86400);
        }

        console.log(`✅ [FCM-REGISTER] Token registered (${cleanToken.substring(0, 20)}...)`);
        return res.status(200).json({ success: true, docId, timestamp: new Date().toISOString() });
    } catch (error: any) {
        console.error('❌ [FCM-REGISTER] Failed:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
    }
});

/**
 * POST /api/notifications/verify-token
 * Verify that a token exists in our system
 */
router.post('/verify-token', async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: 'Token is required.' });
    }

    try {
        const { getFirestore } = await import('firebase-admin/firestore');
        const db = getFirestore();

        const snapshot = await db.collection('notification_subscriptions')
            .where('token', '==', token.trim())
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log(`⚠️ [FCM-VERIFY] Token not found: ${token.substring(0, 20)}...`);
            return res.status(404).json({
                success: false,
                error: 'Token not found in system',
                token_registered: false
            });
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log(`✅ [FCM-VERIFY] Token verified: user=${data.user_id}, platform=${data.platform}`);

        return res.status(200).json({
            success: true,
            token_registered: true,
            user_id: data.user_id,
            platform: data.platform,
            created_at: data.created_at,
            updated_at: data.updated_at
        });
    } catch (error: any) {
        console.error('❌ [FCM-VERIFY] Error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
    }
});

/**
 * POST /api/notifications/test-token
 * Send a test notification to a specific FCM token (admin only)
 */
router.post('/test-token', requireRole('admin'), async (req: Request, res: Response) => {
    const { token, message } = req.body;

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: 'Token is required.' });
    }

    try {
        const { getMessaging } = await import('firebase-admin/messaging');
        const messaging = getMessaging();

        console.log(`[FCM-TEST] Sending test notification to token: ${token.substring(0, 20)}...`);

        const response = await messaging.send({
            notification: {
                title: '🧪 Test Notification',
                body: message || 'This is a test notification from EvaraTDS',
            },
            data: {
                source: 'test',
                timestamp: new Date().toISOString(),
            },
            token: token.trim(),
        });

        console.log(`✅ [FCM-TEST] Test sent successfully: ${response}`);
        return res.status(200).json({
            success: true,
            messageId: response,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ [FCM-TEST] Failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to send test notification',
            errorCode: error.code
        });
    }
});

/**
 * GET /api/notifications/tokens
 * List all registered FCM tokens (admin only)
 */
router.get('/tokens', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { getFirestore } = await import('firebase-admin/firestore');
        const db = getFirestore();

        const snapshot = await db.collection('notification_subscriptions').get();

        const tokens = snapshot.docs.map(doc => ({
            id: doc.id,
            user_id: doc.data().user_id,
            platform: doc.data().platform,
            token_preview: (doc.data().token || '').substring(0, 20) + '...',
            created_at: doc.data().created_at,
            updated_at: doc.data().updated_at,
        }));

        console.log(`✅ [FCM-LIST] Retrieved ${tokens.length} tokens`);
        return res.status(200).json({
            success: true,
            total: tokens.length,
            data: tokens,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ [FCM-LIST] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
