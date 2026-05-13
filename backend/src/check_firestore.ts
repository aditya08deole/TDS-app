
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function checkFirestore() {
  try {
    let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
    
    if (!serviceAccountKey) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY is missing in .env');
        return;
    }

    if (serviceAccountKey.startsWith('{')) {
      // It's raw JSON
    } else {
      // It's Base64
      serviceAccountKey = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
    }

    const serviceAccount = JSON.parse(serviceAccountKey);

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
      });
    }

    const db = getFirestore();
    
    console.log('--- Checking Collections ---');
    
    const collections = ['devices', 'alerts', 'sensor_data'];
    
    for (const colName of collections) {
      const snapshot = await db.collection(colName).limit(10).get();
      console.log(`Collection "${colName}": ${snapshot.size} documents found`);
      snapshot.docs.forEach(doc => {
        console.log(` - ID: ${doc.id}`);
      });
    }
    
    // Specifically look for the missing ID
    const missingId = 'iCHsYF9vdI8DMJIhcvLK';
    const doc = await db.collection('devices').doc(missingId).get();
    if (doc.exists) {
        console.log(`✅ Device ${missingId} EXISTS in Firestore "devices" collection.`);
    } else {
        console.log(`❌ Device ${missingId} DOES NOT EXIST in Firestore "devices" collection.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkFirestore().catch(console.error);
