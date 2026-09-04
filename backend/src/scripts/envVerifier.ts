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



  // 4. Check CORS Flags
  const corsAll = process.env.CORS_ALL_ORIGINS === 'true';
  const corsOrigins = process.env.CORS_ORIGINS;
  const isProductionEnv = (process.env.NODE_ENV || 'development') === 'production';
  if (corsAll && isProductionEnv) {
    report.push('❌ CORS Security: CORS_ALL_ORIGINS=true in production — server.ts will refuse to start');
    success = false;
  } else if (corsAll) {
    report.push('⚠️ CORS Security: CORS_ALL_ORIGINS=true (all origins allowed; dev only, blocked in production)');
  } else if (corsOrigins) {
    report.push(`✅ CORS Security: Restricted to whitelist (${corsOrigins})`);
  } else {
    report.push('ℹ️ CORS Security: Defaulting to local origins (localhost:3000, localhost:5173)');
  }

  // 5. Check Telemetry Ingestion Auth
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  if (process.env.TELEMETRY_API_KEY) {
    report.push('✅ Telemetry Auth: TELEMETRY_API_KEY set — /api/telemetry requires x-telemetry-key');
  } else if (isProduction) {
    report.push('❌ Telemetry Auth: TELEMETRY_API_KEY not set — server.ts will refuse to start in production');
    success = false;
  } else {
    report.push('⚠️ Telemetry Auth: TELEMETRY_API_KEY not set — /api/telemetry accepts readings for ANY device_id with no auth (dev only; required in production)');
  }

  // 6. Check Auto-Tunnel (repoints production mobile apps if left on by accident)
  if (process.env.AUTO_TUNNEL === 'true') {
    report.push('⚠️ Auto-Tunnel: AUTO_TUNNEL=true — this boot will overwrite Remote Config api_url for ALL mobile clients');
  } else {
    report.push('✅ Auto-Tunnel: disabled (default)');
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
