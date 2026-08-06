
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const IST_FORMATTER = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
});

function toIST(dateInput: any): string {
    try {
        const date = dateInput ? new Date(String(dateInput)) : new Date();
        return `${IST_FORMATTER.format(date)} IST`;
    } catch {
        return `${IST_FORMATTER.format(new Date())} IST`;
    }
}

function formatAlertContext(alertData: any) {
    const location = alertData.location_name || alertData.device_name || alertData.device_id || 'Unknown location';
    const ppm = alertData.value_at_time ?? alertData.tds_value ?? 'N/A';
    const time = toIST(alertData.recorded_at || alertData.created_at || new Date().toISOString());
    return { location, ppm, time };
}

async function runDirectTest() {
    console.log('🏁 Starting Direct FCM Push Test (Bypassing Redis)...');

    // 1. Firebase Setup
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
    const db = getFirestore();
    const messaging = getMessaging();

    // 2. Get Device Data
    const deviceId = 'kjZQSqeeo9OAm3NPNkkw';
    const deviceSnap = await db.collection('devices').doc(deviceId).get();
    const deviceData = deviceSnap.data();

    const tds = deviceData?.last_tds || 785;
    const timestamp = deviceData?.last_reading_at || new Date().toISOString();

    const alertData = {
        device_id: deviceId,
        location_name: deviceData?.location_name || 'Main Lab',
        value_at_time: tds,
        recorded_at: timestamp,
    };

    const { location, ppm, time } = formatAlertContext(alertData);
    console.log(`\n📢 Notification Content:\n📍 Location: ${location}\n💧 TDS: ${ppm} PPM\n🕒 Time: ${time}\n`);

    // 3. Send FCM Push
    const tokensSnap = await db.collection('notification_subscriptions').limit(5).get();
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

    if (tokens.length > 0) {
        console.log(`📲 Sending FCM Push to ${tokens.length} tokens...`);
        try {
            await messaging.sendEachForMulticast({
                notification: { title: `🚨 TDS Alert: ${location}`, body: `${ppm} ppm recorded at ${time}` },
                tokens
            });
            console.log('✅ Push sent successfully.');
        } catch (e) { console.error('❌ Push failed:', e); }
    } else {
        console.log('⚠️ No FCM tokens found in Firestore.');
    }

    console.log('\n✨ Test finished.');
}

runDirectTest().catch(console.error);
