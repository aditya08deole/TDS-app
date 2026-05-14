import express, { Request, Response } from 'express';
import {
    handleWhatsAppWebhook,
    triggerManualTestNotification,
    listWhatsAppRecipients,
    addWhatsAppRecipient,
    removeWhatsAppRecipient,
} from '../../services/notificationService';
import { requireRole } from '../middleware/roleGuard';

const router = express.Router();

/**
 * POST /api/notifications/whatsapp
 * Webhook for Twilio WhatsApp Sandbox
 */
router.post('/whatsapp', async (req: Request, res: Response) => {
    try {
        const twimlResponse = await handleWhatsAppWebhook(req.body);
        res.set('Content-Type', 'text/xml');
        res.send(twimlResponse);
    } catch (error) {
        console.error('❌ WhatsApp Webhook Error:', error);
        res.status(500).send('Error processing webhook');
    }
});

/**
 * POST /api/notifications/test
 * Manually trigger a test notification for a specific device.
 * Works even when the dashboard tab is closed — runs server-side.
 *
 * Body: { deviceId: string, deviceName?: string, message?: string }
 */
router.post('/test', requireRole('admin'), async (req: Request, res: Response) => {
    const { deviceId, deviceName, message } = req.body;

    if (!deviceId) {
        return res.status(400).json({
            success: false,
            error: 'deviceId is required.'
        });
    }

    try {
        await triggerManualTestNotification(
            String(deviceId),
            deviceName ? String(deviceName) : `Device ${deviceId}`,
            message ? String(message) : 'Manual test alert triggered from EvaraTDS dashboard.'
        );

        return res.status(200).json({
            success: true,
            message: 'Test notification dispatched to all configured channels.',
            channels: ['push', 'whatsapp', 'ntfy', 'ifttt'],
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ Test notification failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to dispatch test notification.'
        });
    }
});

router.get('/recipients/whatsapp', requireRole('admin'), async (_req: Request, res: Response) => {
    try {
        const recipients = await listWhatsAppRecipients();
        return res.status(200).json({
            success: true,
            data: recipients,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch recipients' });
    }
});

router.post('/recipients/whatsapp', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'phone is required in +91XXXXXXXXXX format' });
        }
        const userId = String(req.headers['x-user-id'] || req.body.userId || 'unknown');
        const added = await addWhatsAppRecipient(String(phone), userId);
        return res.status(201).json({ success: true, data: added, timestamp: new Date().toISOString() });
    } catch (error: any) {
        return res.status(400).json({ success: false, error: error?.message || 'Failed to add recipient' });
    }
});

router.delete('/recipients/whatsapp', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'phone is required in +91XXXXXXXXXX format' });
        }
        const userId = String(req.headers['x-user-id'] || req.body.userId || 'unknown');
        const removed = await removeWhatsAppRecipient(String(phone), userId);
        return res.status(200).json({ success: true, data: { removed }, timestamp: new Date().toISOString() });
    } catch (error: any) {
        return res.status(400).json({ success: false, error: error?.message || 'Failed to remove recipient' });
    }
});

export default router;
