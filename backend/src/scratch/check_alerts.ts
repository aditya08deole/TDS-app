import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Point to the backend .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!serviceAccount.project_id) {
  console.error('❌ Service account key not found in .env');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkAlerts() {
  console.log('🔍 Checking for alerts in Firestore...');
  console.log(`Project ID: ${serviceAccount.project_id}`);
  
  const alertsRef = db.collection('alerts');
  const snapshot = await alertsRef.get();

  if (snapshot.empty) {
    console.log('✅ No alerts found in "alerts" collection.');
    
    // Try listing all collections to see if we're in the right place
    const collections = await db.listCollections();
    console.log('Available collections:', collections.map(c => c.id));
    return;
  }

  console.log(`📊 Found ${snapshot.size} alerts.`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`- Alert ID: ${doc.id}`);
    console.log(`  Device ID: ${data.device_id}`);
    console.log(`  Device Name: ${data.device_name}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Created At: ${data.created_at}`);
    console.log(`  TDS Value: ${data.tds_value}`);
    console.log('-------------------');
  }
}

checkAlerts().catch(console.error);
