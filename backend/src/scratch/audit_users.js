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
        
        console.log('--- USERS (Correct Collection) ---');
        const usersSnap = await db.collection('users').get();
        if (usersSnap.empty) console.log('No users found in "users" collection.');
        usersSnap.forEach(doc => {
            console.log(`User: ${doc.id}, Email: ${doc.data().email}, Role: ${doc.data().role}`);
        });

        console.log('\n--- RECENT ALERTS ---');
        const alertsSnap = await db.collection('alerts').orderBy('created_at', 'desc').limit(5).get();
        alertsSnap.forEach(doc => {
            const d = doc.data();
            console.log(`Alert: ${doc.id}, Severity: ${d.severity}, LastNotified: ${d.last_notified_at}, HistoryKeys: ${d.delivery_history ? Object.keys(d.delivery_history) : 'None'}`);
        });

    } catch (e) {
        console.error(e);
    }
}

check();
