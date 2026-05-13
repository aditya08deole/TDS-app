
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

async function checkFirestore() {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    const db = admin.firestore();
    
    console.log('--- CHECKING COLLECTIONS ---');
    
    const collections = ['devices', 'alerts', 'sensor_data'];
    
    for (const coll of collections) {
      const snapshot = await db.collection(coll).get();
      console.log(`Collection "${coll}": ${snapshot.size} documents`);
      
      if (snapshot.size > 0) {
        console.log(`Example doc ID from ${coll}: ${snapshot.docs[0].id}`);
        // console.log('Data:', snapshot.docs[0].data());
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFirestore();
