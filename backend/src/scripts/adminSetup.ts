import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

/**
 * Admin Setup & Firestore Seeding CLI Tool
 * Automatically populates app_config/admin_emails and default system settings.
 * Eliminates manual entry in Firebase Console.
 *
 * Usage: npx ts-node src/scripts/adminSetup.ts [email1] [email2] ...
 */
async function runSetup() {
  console.log('🚀 Starting Automated Admin Setup & Firestore Seeder...\n');

  // 1. Initialize Firebase Admin
  try {
    let serviceAccount: object | null = null;
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
      let keyStr = rawKey.trim();
      if (!keyStr.startsWith('{')) {
        try { keyStr = Buffer.from(keyStr, 'base64').toString('utf8'); } catch {}
      }
      serviceAccount = JSON.parse(keyStr);
    }

    if (!serviceAccount) {
      const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        || path.resolve(__dirname, '../../firebase-service-account.json');
      if (fs.existsSync(filePath)) {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    if (!serviceAccount) {
      console.error('❌ Could not find Firebase service account credentials.');
      console.error('   Please check backend/.env for FIREBASE_SERVICE_ACCOUNT_KEY or firebase-service-account.json');
      process.exit(1);
    }

    initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
    console.log('✅ Firebase Admin connected successfully.');
  } catch (err) {
    console.error('❌ Firebase initialization failed:', err);
    process.exit(1);
  }

  const db = getFirestore();

  // 2. Determine admin emails from CLI arguments or environment defaults
  const cliEmails = process.argv.slice(2);
  const defaultAdminEmails = [
    'adityadeole08@gmail.com',
    'ritik@evaratech.com',
    'yasha@evaratech.com',
    'aditya@evaratech.com',
  ];

  const targetEmails = Array.from(new Set(
    (cliEmails.length > 0 ? cliEmails : defaultAdminEmails).map(e => e.trim().toLowerCase())
  ));

  console.log(`📋 Seeding admin emails to app_config/admin_emails:`);
  targetEmails.forEach(e => console.log(`   • ${e}`));

  try {
    // 3. Write app_config/admin_emails
    await db.collection('app_config').doc('admin_emails').set({
      emails: targetEmails,
      updated_at: new Date().toISOString(),
      updated_by: 'adminSetup_cli_script',
    }, { merge: true });
    console.log('✅ app_config/admin_emails successfully saved in Firestore!');

    // 4. Seed default app config (thresholds, intervals)
    await db.collection('app_config').doc('system_defaults').set({
      default_min_tds: 50,
      default_max_tds: 500,
      heartbeat_interval_mins: 5,
      thingspeak_poll_interval_mins: 2,
      alert_retention_hours: 24,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    console.log('✅ app_config/system_defaults successfully saved in Firestore!');

    // 5. Update user roles for matching admin accounts if they exist
    for (const email of targetEmails) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) {
        for (const userDoc of snap.docs) {
          await userDoc.ref.update({
            role: 'super_admin',
            updated_at: new Date().toISOString(),
          });
          console.log(`👑 Promoted user ${email} (${userDoc.id}) to super_admin in Firestore!`);
        }
      } else {
        console.log(`ℹ️ User ${email} does not have a user profile document yet — will auto-assign on first login.`);
      }
    }

    console.log('\n🎉 Admin setup and seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed Firestore config:', err);
    process.exit(1);
  }
}

runSetup();
