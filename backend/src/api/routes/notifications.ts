import express, { Request, Response } from 'express';
import { handleWhatsAppWebhook } from '../../services/notificationService';

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

export default router;
