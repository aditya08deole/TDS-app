
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function sendBroadcast() {
    console.log('📡 Attempting Broadcast Notification...');
    
    let serviceAccount: any = null;
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
        let keyStr = rawKey.trim();
        if (!keyStr.startsWith('{')) {
            try { keyStr = Buffer.from(keyStr, 'base64').toString('utf8'); } catch (e) {}
        }
        serviceAccount = JSON.parse(keyStr);
    }
    
    if (!serviceAccount) {
        const filePath = path.resolve(__dirname, '../firebase-service-account.json');
        if (fs.existsSync(filePath)) serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    if (!serviceAccount) throw new Error('Firebase credentials not found');

    initializeApp({ credential: cert(serviceAccount) });
    const messaging = getMessaging();
    const db = getFirestore();

    // 1. Send to individual tokens
    const tokensSnap = await db.collection('notification_subscriptions').get();
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

    if (tokens.length > 0) {
        console.log(`📲 Sending to ${tokens.length} individual tokens...`);
        const response = await messaging.sendEachForMulticast({
            notification: {
                title: '🚨 TDS System Check',
                body: 'Verifying notification delivery to all devices.'
            },
            tokens
        });
        console.log(`✅ Success: ${response.successCount}, ❌ Fail: ${response.failureCount}`);
    }

    // 2. Send to "all_devices" topic (backup)
    try {
        const topicResponse = await messaging.send({
            topic: 'all_devices',
            notification: {
                title: '🔔 EvaraTDS Broadcast',
                body: 'System-wide broadcast test.'
            }
        });
        console.log('✅ Topic broadcast successful:', topicResponse);
    } catch (e) {
        console.error('❌ Topic broadcast failed:', (e as any).message);
    }

    console.log('✨ Broadcast tasks finished.');
    process.exit(0);
}

sendBroadcast().catch(e => {
    console.error(e);
    process.exit(1);
});
