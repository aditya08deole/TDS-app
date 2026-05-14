import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function debugSync() {
  console.log('--- DEBUG SYNC START ---');
  
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  console.log('Project ID:', serviceAccount.project_id);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = getFirestore();
  console.log('Fetching devices collection...');
  
  try {
    const snapshot = await db.collection('devices').get();
    console.log(`Found ${snapshot.size} documents in 'devices' collection.`);
    
    snapshot.docs.forEach(doc => {
      console.log(`- Document ID: ${doc.id}`);
      console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
  }

  console.log('--- DEBUG SYNC END ---');
}

debugSync().catch(console.error);
