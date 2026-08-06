
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { sendPushNotification } from './services/notificationService';
import { initializeRedis } from './db/redis';

dotenv.config();

async function triggerTest() {
    try {
        // 1. Initialize Firebase
        let serviceAccount: any = null;
        const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (rawKey) {
            let keyStr = rawKey.trim();
            if (!keyStr.startsWith('{')) {
                try { keyStr = Buffer.from(keyStr, 'base64').toString('utf8'); } catch (e) {}
            }
            try { serviceAccount = JSON.parse(keyStr); } catch (e) {
                console.error('Failed to parse service account JSON');
            }
        }

        if (!serviceAccount) {
            const filePath = path.resolve(__dirname, '../firebase-service-account.json');
            if (fs.existsSync(filePath)) {
                serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        }

        if (!serviceAccount) throw new Error('No service account found');

        if (getApps().length === 0) {
            initializeApp({ credential: cert(serviceAccount) });
        }

        // 2. Initialize Redis (needed by notificationService)
        await initializeRedis();

        const db = getFirestore();
        const deviceId = 'kjZQSqeeo9OAm3NPNkkw';
        const deviceSnap = await db.collection('devices').doc(deviceId).get();

        if (!deviceSnap.exists) {
            console.error('Device not found');
            return;
        }

        const deviceData = deviceSnap.data();
        const tds = deviceData?.last_tds || 750;
        const timestamp = deviceData?.last_reading_at || new Date().toISOString();

        console.log(`🚀 Triggering test FCM push for ${deviceId}...`);
        console.log(`📊 TDS: ${tds} PPM | Time: ${timestamp}`);

        const alertData = {
            device_id: deviceId,
            device_name: deviceData?.name || deviceId,
            location_name: deviceData?.location_name || 'Test Lab',
            message: `TEST ALERT: TDS is ${tds} PPM`,
            severity: 'critical',
            status: 'open',
            value_at_time: tds,
            recorded_at: timestamp,
            created_at: new Date().toISOString(),
        };

        const alertId = `test-alert-${Date.now()}`;

        console.log('--- Sending FCM Push Notification ---');
        // isReminder=true bypasses delivery dedupe for this test call
        await sendPushNotification(alertId, alertData, true);

        console.log('✅ Test complete!');
        setTimeout(() => process.exit(0), 2000);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

triggerTest();
