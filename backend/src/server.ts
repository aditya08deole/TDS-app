import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { initializePool, closePool } from './db/connection';
import { startScheduler, stopScheduler, getSchedulerStatus } from './sync/scheduler';
import { syncFromFirebase } from './services/syncService';
import deviceRoutes from './api/routes/devices';
import syncRoutes from './api/routes/sync';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══ MIDDLEWARE ═══
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══ FIREBASE SETUP ═══
function initializeFirebase() {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
    }

    const serviceAccount = typeof serviceAccountKey === 'string'
      ? JSON.parse(serviceAccountKey)
      : serviceAccountKey;

    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });

    console.log('✅ Firebase initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

// ═══ ROUTES ═══

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * API version endpoint
 */
app.get('/api/version', (req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    name: 'TDS-APP Backend API',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
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

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// ═══ STARTUP ═══
async function start() {
  try {
    console.log('🚀 Starting TDS-APP Backend...');
    console.log(`Environment: ${NODE_ENV}`);

    // Initialize Firebase
    initializeFirebase();

    // Initialize database connection
    initializePool();
    console.log('✅ Database connection initialized');

    // Start scheduler
    startScheduler();

    // Perform initial sync
    console.log('📡 Running initial sync...');
    try {
      const syncResult = await syncFromFirebase('scheduled');
      console.log(`✅ Initial sync complete: ${syncResult.devicesSynced} devices, ${syncResult.alertsSynced} alerts`);
    } catch (syncError) {
      console.warn('⚠️ Initial sync failed, continuing anyway:', syncError);
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API: http://localhost:${PORT}/api/version`);
      console.log(`   Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
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
  await closePool();

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📭 SIGINT received, shutting down gracefully...');

  stopScheduler();
  await closePool();

  process.exit(0);
});

// ═══ UNHANDLED REJECTIONS ═══
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
start();

export default app;
