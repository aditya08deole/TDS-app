const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function check() {
    try {
        const keyPath = path.resolve(__dirname, '../../firebase-service-account.json');
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        const db = admin.firestore();
        
        console.log('--- USERS ---');
        const usersSnap = await db.collection('profiles').get();
        usersSnap.forEach(doc => {
            console.log(`User: ${doc.id}, Role: ${doc.data().role}, Name: ${doc.data().name}`);
        });

        console.log('\n--- OPEN ALERTS ---');
        const alertsSnap = await db.collection('alerts').where('status', '==', 'open').get();
        if (alertsSnap.empty) console.log('No open alerts found.');
        alertsSnap.forEach(doc => {
            const d = doc.data();
            console.log(`Alert: ${doc.id}, Severity: ${d.severity}, LastNotified: ${d.last_notified_at}, Msg: ${d.message}`);
        });

        console.log('\n--- DEVICES ---');
        const devicesSnap = await db.collection('devices').get();
        devicesSnap.forEach(doc => {
            const d = doc.data();
            console.log(`Device: ${doc.id}, Limit: ${d.safe_tds_max}, LastTDS: ${d.last_tds}, TS_Channel: ${d.thingspeak_channel_id}`);
        });

    } catch (e) {
        console.error(e);
    }
}

check();
