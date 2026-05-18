
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import twilio from 'twilio';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Re-implement the formatting logic to verify the fix
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
    // THIS IS THE FIX WE ARE TESTING:
    const time = toIST(alertData.recorded_at || alertData.created_at || new Date().toISOString());
    return { location, ppm, time };
}

async function runDirectTest() {
    console.log('🏁 Starting Direct Notification Test (Bypassing Redis)...');

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

    // 2. Twilio Setup
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    const adminPhone = process.env.ADMIN_WHATSAPP_TO;

    // 3. Get Data
    const deviceId = 'kjZQSqeeo9OAm3NPNkkw';
    const deviceSnap = await db.collection('devices').doc(deviceId).get();
    const deviceData = deviceSnap.data();

    const tds = deviceData?.last_tds || 785;
    const timestamp = deviceData?.last_reading_at || new Date().toISOString();

    const alertData = {
        device_id: deviceId,
        location_name: deviceData?.location_name || 'Main Lab',
        value_at_time: tds,
        recorded_at: timestamp, // Using the new field
    };

    const { location, ppm, time } = formatAlertContext(alertData);
    console.log(`\n📢 Notification Content:\n📍 Location: ${location}\n💧 TDS: ${ppm} PPM\n🕒 Time: ${time}\n`);

    // 4. Send Push
    const tokensSnap = await db.collection('notification_subscriptions').limit(5).get();
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

    if (tokens.length > 0) {
        console.log(`📲 Sending Push to ${tokens.length} tokens...`);
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

    // 5. Send WhatsApp
    if (adminPhone) {
        console.log(`💬 Sending WhatsApp to ${adminPhone}...`);
        try {
            await twilioClient.messages.create({
                from: twilioFrom,
                to: `whatsapp:${adminPhone}`,
                body: `🚨 *EvaraTDS Alert*\n\n*Location:* ${location}\n*TDS:* ${ppm} ppm\n*Time:* ${time}\n\n_Bypassed Redis for this test._`
            });
            console.log('✅ WhatsApp sent successfully.');
        } catch (e) { console.error('❌ WhatsApp failed:', e); }
    } else {
        console.log('⚠️ ADMIN_WHATSAPP_TO not set in .env');
    }

    console.log('\n✨ Test finished.');
}

runDirectTest().catch(console.error);
