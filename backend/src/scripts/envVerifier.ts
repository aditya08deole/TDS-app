import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { initializeRedis, closeRedis, getRedisClient } from '../db/redis';

dotenv.config();

/**
 * Pre-flight Environment & Credentials Diagnostic Verifier
 * Validates Redis, Firebase credentials format, Twilio vars, and CORS flags.
 *
 * Usage: npx ts-node src/scripts/envVerifier.ts
 */
export async function verifyEnvironment(): Promise<{ success: boolean; report: string[] }> {
  const report: string[] = [];
  let success = true;

  report.push('🔍 Running System Pre-Flight Environment Diagnostic...');
  report.push(`   Node Version: ${process.version}`);
  report.push(`   Environment:  ${process.env.NODE_ENV || 'development'}`);

  // 1. Check Firebase Service Account
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../../firebase-service-account.json');

  if (rawKey) {
    report.push('✅ Firebase credentials: Found FIREBASE_SERVICE_ACCOUNT_KEY in .env');
  } else if (fs.existsSync(keyPath)) {
    report.push(`✅ Firebase credentials: Found file at ${keyPath}`);
  } else {
    report.push('❌ Firebase credentials: MISSING! Set FIREBASE_SERVICE_ACCOUNT_KEY or provide JSON file');
    success = false;
  }

  // 2. Check Redis Connection
  try {
    await initializeRedis();
    const redis = getRedisClient();
    const ping = await redis.ping();
    if (ping === 'PONG') {
      report.push('✅ Redis database: Connected and responsive (PONG)');
    } else {
      report.push(`⚠️ Redis database: Unexpected ping response (${ping})`);
    }
  } catch (err: any) {
    report.push(`⚠️ Redis database: Connection failed (${err.message}). System using in-memory fallback.`);
  }

  // 3. Check Twilio Configuration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const publicUrl = process.env.PUBLIC_URL;

  if (twilioSid && twilioToken) {
    report.push('✅ Twilio WhatsApp: Credentials present');
    if (!publicUrl) {
      report.push('⚠️ Twilio Webhook: PUBLIC_URL missing in .env (signature validation disabled)');
    } else {
      report.push(`✅ Twilio Webhook: PUBLIC_URL configured (${publicUrl})`);
    }
  } else {
    report.push('ℹ️ Twilio WhatsApp: Credentials not set (WhatsApp notifications disabled)');
  }

  // 4. Check CORS Flags
  const corsAll = process.env.CORS_ALL_ORIGINS === 'true';
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsAll) {
    report.push('⚠️ CORS Security: CORS_ALL_ORIGINS=true (all origins allowed)');
  } else if (corsOrigins) {
    report.push(`✅ CORS Security: Restricted to whitelist (${corsOrigins})`);
  } else {
    report.push('ℹ️ CORS Security: Defaulting to local origins (localhost:3000, localhost:5173)');
  }

  return { success, report };
}

// Standalone execution handler
if (require.main === module) {
  verifyEnvironment().then(({ success, report }) => {
    console.log('\n' + report.join('\n') + '\n');
    closeRedis().finally(() => {
      process.exit(success ? 0 : 1);
    });
  });
}
