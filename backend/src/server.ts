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
    startHourlyReminderJob, 
    startThingSpeakMonitorJob,
    stopScheduler, 
    getSchedulerStatus 
} from './sync/scheduler';
import { syncFromFirebase } from './services/syncService';
import { flushSensorData } from './services/telemetryService';
import deviceRoutes from './api/routes/devices';
import syncRoutes from './api/routes/sync';
import notificationRoutes from './api/routes/notifications';
import telemetryRoutes from './api/routes/telemetry';
import alertsRoutes from './api/routes/alerts';
import { TDS_CONFIG } from './config/tdsConfig';
import { getFrontendPath } from './utils/pathUtils';
import { startNotificationListeners, warmFCMCache } from './services/notificationService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══ MIDDLEWARE ═══
app.use(helmet());

// CORS Configuration - Restrict to allowed origins in production
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in the allowed list
    const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(`${allowed}/`));
    
    if (isAllowed || NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Origin not allowed by CORS'));
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
    if (!serviceAccount) {
      const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        || path.resolve(__dirname, '../../firebase-service-account.json');
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

    console.log('✅ Firebase Admin initialized successfully');
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
 * GET /health
 * Consolidated health check for API and Redis
 */
app.get('/health', async (req, res) => {
  try {
    const redis = getRedisClient();
    const ping = await redis.ping();
    const redisStatus = ping === 'PONG' ? 'up' : 'down';

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        redis: redisStatus,
        scheduler: 'active'
      },
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
 * Notification routes
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
 * Catch-all route to serve the frontend for SPA routing
 */
app.get('*', (req: Request, res: Response) => {
  // If request is for API, don't serve index.html
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
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

    // Initialize Firebase
    initializeFirebase();

    // Initialize Redis connection
    await initializeRedis();
    console.log('✅ Redis initialized');

    // Start scheduler
    startScheduler();

    // Start alert auto-cleanup (deletes alerts older than 10 min every minute)
    startAlertCleanupJob();
    
    // Start device heartbeat monitoring (every 5 min)
    startDeviceHeartbeatJob();

    // Start hourly notification reminders
    startHourlyReminderJob();

    // Start autonomous ThingSpeak monitoring (Ghost Engine)
    startThingSpeakMonitorJob();

    try {
      const syncResult = await syncFromFirebase('startup');
      console.log(`✅ Initial full sync complete: ${syncResult.devicesSynced} devices, ${syncResult.alertsSynced} alerts`);
    } catch (syncError) {
      console.warn('⚠️ Initial sync failed, continuing anyway:', syncError);
    }

    // Start real-time notification listeners
    startNotificationListeners();

    // FIX #2a: Pre-warm FCM token cache so push notifications work immediately on boot.
    // Non-blocking — failure is logged and app continues normally.
    warmFCMCache().catch(e => console.warn('⚠️ FCM cache warm-up error:', e));

    // Start server
    app.listen(PORT, () => {
      if (NODE_ENV !== 'production') {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   API: http://localhost:${PORT}/api/version`);
        console.log(`   Frontend: ${frontendPath}`);
      } else {
        console.log(`✅ TDS-APP Backend started on port ${PORT} [${NODE_ENV}]`);
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
  stopScheduler();
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
  stopScheduler();
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
