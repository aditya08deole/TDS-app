import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { initializeRedis, closeRedis, getRedisClient } from './db/redis';
import {
    startScheduler,
    startAlertCleanupJob,
    startDeviceHeartbeatJob,
    startThingSpeakMonitorJob,
    stopScheduler,
    getSchedulerStatus
} from './sync/scheduler';
import { syncFromFirebase } from './services/syncService';
import { flushSensorData, startTelemetryFlusher, stopTelemetryFlusher } from './services/telemetryService';
import deviceRoutes from './api/routes/devices';
import syncRoutes from './api/routes/sync';
import notificationRoutes from './api/routes/notifications';
import telemetryRoutes from './api/routes/telemetry';
import alertsRoutes from './api/routes/alerts';
import usersRoutes from './api/routes/users';
import { TDS_CONFIG } from './config/tdsConfig';
import { getFrontendPath } from './utils/pathUtils';
import { startNotificationListeners, warmFCMCache } from './services/notificationService';
import { sseService } from './services/sseService';
import { verifyEnvironment } from './scripts/envVerifier';
import { startAutoTunnel, stopAutoTunnel } from './services/autoTunnelService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Railway (and most PaaS platforms) terminate TLS at an edge proxy and forward
// the original scheme via X-Forwarded-Proto. Without trust proxy, req.protocol
// always reports 'http' even on a real https request — breaks anything that
// builds an absolute URL from the request (e.g. invite links).
app.set('trust proxy', 1);

// ═══ MIDDLEWARE ═══
// crossOriginOpenerPolicy defaults to 'same-origin' in helmet, which blocks the
// window.opener postMessage handshake that Firebase's signInWithPopup (Google
// login) relies on to resolve after the popup completes — the popup closes but
// the promise never resolves, so login silently hangs. 'same-origin-allow-popups'
// keeps the COOP protection while allowing that handshake.
//
// contentSecurityPolicy: helmet's defaults lock connect-src and frame-src down
// to 'self' only. Firebase Auth's popup sign-in depends on a hidden helper
// iframe served from the Firebase auth domain (*.firebaseapp.com) plus fetch
// calls to Google's identity/Firestore/FCM/Remote Config APIs (*.googleapis.com)
// — none same-origin, so the default CSP silently blocked them. The browser
// doesn't surface "blocked by CSP" to the Firebase SDK as a distinct error; it
// just fails, and Firebase Auth reports it as the generic "auth/internal-error".
// Also allow the frontend's direct ThingSpeak API calls (api.thingspeak.com)
// and Google profile photo images (img-src) so avatars aren't broken either.
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      // getDefaultDirectives() returns kebab-case keys ("img-src", not
      // "imgSrc") — overrides below MUST match that casing exactly, or
      // helmet sees two different keys for the same directive and throws
      // "Content-Security-Policy received a duplicate directive" at boot.
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'https://*.googleapis.com', 'https://api.thingspeak.com'],
      'frame-src': ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS Configuration - Restrict to allowed origins in production
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin is in explicit allowed list OR is a tunnel subdomain
    const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(`${allowed}/`));
    const isTunnelDomain = origin.endsWith('.trycloudflare.com') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.loca.lt');
    const allowAll = process.env.CORS_ALL_ORIGINS === 'true';
    
    if (isAllowed || isTunnelDomain || allowAll) {
      callback(null, true);
    } else {
      console.warn(`⚠️ [CORS] Rejected request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-db-init-key', 'x-user-role', 'x-user-id']
}));

app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══ FIREBASE SETUP ═══
function initializeFirebase() {
  try {
    let serviceAccount: object | null = null;

    // Strategy 1: Parse from FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON or Base64)
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
      let keyStr = rawKey.trim();
      if (!keyStr.startsWith('{')) {
        // Attempt Base64 decode (used by Railway / Docker secrets)
        try {
          console.log('📦 Decoding Base64 Firebase service account key...');
          keyStr = Buffer.from(keyStr, 'base64').toString('utf8');
        } catch {
          console.warn('⚠️ Key is not Base64, attempting raw JSON parse');
        }
      }
      serviceAccount = JSON.parse(keyStr);
    }

    // Strategy 2: Load from JSON file path (FIREBASE_SERVICE_ACCOUNT_PATH or default)
    // __dirname here is dist/ (this file compiles to dist/server.js), and the
    // file lives one level up at backend/firebase-service-account.json — was
    // '../../' (matching envVerifier.ts, which is one level deeper at
    // dist/scripts/ so '../../' is correct THERE), which resolved a directory
    // above the backend folder entirely and could never find the file.
    if (!serviceAccount) {
      const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        || path.resolve(__dirname, '../firebase-service-account.json');
      if (fs.existsSync(filePath)) {
        console.log(`📄 Loading Firebase service account from file: ${filePath}`);
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    if (!serviceAccount) {
      throw new Error(
        'Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_KEY (JSON or Base64) ' +
        'or provide firebase-service-account.json in the backend directory.'
      );
    }

    initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });

    // The credential's own project_id is what actually determines which
    // Firestore/Auth project this Admin SDK talks to — NOT the
    // FIREBASE_PROJECT_ID env var (that's only used above for databaseURL).
    // If this doesn't match the frontend's VITE_FIREBASE_PROJECT_ID, every
    // requireRole()-gated request will fail with 401 "invalid or expired
    // token" — verifyIdToken() rejects tokens whose issuer/audience doesn't
    // match the project this SDK was initialized for.
    const actualProjectId = (serviceAccount as any)?.project_id || 'UNKNOWN';
    console.log(`✅ Firebase Admin initialized successfully — connected to project: "${actualProjectId}"`);
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== actualProjectId) {
      console.warn(`⚠️ FIREBASE_PROJECT_ID env var ("${process.env.FIREBASE_PROJECT_ID}") does not match the service account's project_id ("${actualProjectId}"). This is usually harmless (that env var is only used for the Realtime DB URL above), but if API calls are failing with 401 "invalid or expired token", it's a strong sign the service account itself is for the WRONG Firebase project relative to your frontend.`);
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}


// ═══ STATIC FILES ═══
const frontendPath = getFrontendPath();
app.use(express.static(frontendPath));

// ═══ ROUTES ═══

/**
 * API version endpoint
 */
app.get('/api/version', (req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    name: 'TDS-APP Backend API (Redis Cached)',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * System configuration endpoint
 */
app.get('/api/system/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: TDS_CONFIG,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/events/live
 * Real-time Server-Sent Events (SSE) stream for live telemetry & alert broadcasts
 */
app.get('/api/events/live', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseService.addClient(res);
});

/**
 * GET /health
 * Consolidated health check for API, Redis, and scheduler tasks.
 * Fix #26: Now reports real scheduler status instead of hardcoding 'active'.
 */
app.get('/health', async (req, res) => {
  try {
    const redis = getRedisClient();
    const ping = await redis.ping();
    const redisStatus = ping === 'PONG' ? 'up' : 'down';
    const sched = getSchedulerStatus();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        redis: redisStatus,
        scheduler: sched.isRunning ? 'active' : 'stopped',
        cleanup: sched.cleanupRunning ? 'active' : 'stopped',
        heartbeat: sched.heartbeatRunning ? 'active' : 'stopped',
        thingspeak_monitor: sched.thingSpeakMonitorRunning ? 'active' : 'stopped',
      },
      scheduler_detail: sched,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Device routes
 */
app.use('/api/devices', deviceRoutes);

/**
 * Sync routes
 */
app.use('/api/sync', syncRoutes);

/**
 * Notification routes (FCM subscription management)
 */
app.use('/api/notifications', notificationRoutes);

/**
 * Alerts routes
 */
app.use('/api/alerts', alertsRoutes);

/**
 * Telemetry routes (Device sensor data submission)
 */
app.use('/api/telemetry', telemetryRoutes);

/**
 * Users routes (invite token management, role assignment)
 */
app.use('/api/users', usersRoutes);

/**
 * Catch-all route to serve the frontend for SPA routing
 */
app.get('*', (req: Request, res: Response) => {
  // If request is for API, don't serve index.html
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      success: true,
      message: 'TDS-APP API Server is running. Frontend is served separately.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Error handling middleware
 */
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// ═══ STARTUP ═══
async function start() {
  try {
    console.log('🚀 Starting TDS-APP Unified System (Redis Mode)...');
    console.log(`Environment: ${NODE_ENV}`);

    // Pre-flight environment check
    const { report } = await verifyEnvironment();
    console.log('\n' + report.join('\n') + '\n');

    // Initialize Firebase
    initializeFirebase();

    // Initialize Redis connection
    await initializeRedis();
    console.log('✅ Redis initialized');

    // Start scheduler
    startScheduler();

    // Start alert auto-cleanup (deletes resolved alerts older than 24h, every 5 min — never touches open alerts)
    startAlertCleanupJob();
    
    // Start device heartbeat monitoring (every 5 min)
    startDeviceHeartbeatJob();

    // Start autonomous ThingSpeak monitoring (Ghost Engine — every 10 min).
    // Reminder/reopen behavior for still-breaching devices is now handled
    // entirely by processThresholdBreach() as new telemetry arrives — see
    // notificationService.ts — rather than a separate periodic sweep.
    startThingSpeakMonitorJob();

    try {
      const syncResult = await syncFromFirebase('startup');
      console.log(`✅ Initial full sync complete: ${syncResult.devicesSynced} devices, ${syncResult.alertsSynced} alerts`);
    } catch (syncError) {
      console.warn('⚠️ Initial sync failed, continuing anyway:', syncError);
    }

    // Start real-time notification listeners
    startNotificationListeners();

    // Pre-warm FCM token cache so push notifications work immediately on boot
    warmFCMCache().catch(e => console.warn('⚠️ FCM cache warm-up error:', e));

    // Fix #11: Start telemetry flush AFTER Redis is confirmed initialized
    startTelemetryFlusher();

    // Start server
    app.listen(PORT, async () => {
      if (NODE_ENV !== 'production') {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   API: http://localhost:${PORT}/api/version`);
        console.log(`   Frontend: ${frontendPath}`);
      } else {
        console.log(`✅ TDS-APP Backend started on port ${PORT} [${NODE_ENV}]`);
      }

      // Opt-in only: this spins up a public tunnel AND overwrites the api_url
      // that every deployed mobile app reads from Firebase Remote Config.
      // Previously this ran by default on every boot (opt-OUT via AUTO_TUNNEL=false),
      // meaning starting the backend on any machine — a dev laptop, a test box —
      // would silently repoint production mobile clients at that machine's tunnel.
      // Only intended for local dev when you deliberately want the deployed app to
      // reach your machine; never needed on Railway, which already has a public URL.
      if (process.env.AUTO_TUNNEL === 'true') {
        await startAutoTunnel(Number(PORT));
      } else {
        console.log('ℹ️ Auto-tunnel disabled (default). Set AUTO_TUNNEL=true to enable for local dev.');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ═══ GRACEFUL SHUTDOWN ═══
process.on('SIGTERM', async () => {
  console.log('📭 SIGTERM received, shutting down gracefully...');
  stopAutoTunnel();
  stopScheduler();
  stopTelemetryFlusher(); // Fix #11
  try {
    console.log('💾 Flushing telemetry buffer to Firestore...');
    await flushSensorData();
  } catch (e) {
    console.error('❌ Failed to flush data during shutdown:', e);
  }
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📭 SIGINT received, shutting down gracefully...');
  stopAutoTunnel(); // Fix: was missing from SIGINT handler, tunnel was leaking on Ctrl+C
  stopScheduler();
  stopTelemetryFlusher(); // Fix #11
  try {
    console.log('💾 Flushing telemetry buffer to Firestore...');
    await flushSensorData();
  } catch (e) {
    console.error('❌ Failed to flush data during shutdown:', e);
  }
  await closeRedis();
  process.exit(0);
});

// ═══ UNHANDLED REJECTIONS ═══
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
start();

export default app;
