import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { initializePool, closePool } from './db/connection';
import { startScheduler, stopScheduler, getSchedulerStatus } from './sync/scheduler';
import { syncFromFirebase } from './services/syncService';
import deviceRoutes from './api/routes/devices';
import syncRoutes from './api/routes/sync';
import { initializeDatabase } from './db/init';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══ MIDDLEWARE ═══
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for static serving simplicity in production
}));
app.use(cors({
  origin: true, // Allow all origins in production or configure strictly
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══ FIREBASE SETUP ═══
function initializeFirebase() {
  try {
    let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
    }

    // Handle Base64 encoding (much more reliable for Railway)
    if (!serviceAccountKey.trim().startsWith('{')) {
      try {
        console.log('📦 Decoding Base64 Firebase key...');
        serviceAccountKey = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
      } catch (e) {
        console.warn('⚠️ Key is not Base64, attempting to parse as raw JSON');
      }
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

// ═══ STATIC FILES ═══
const frontendPath = path.join(__dirname, '../../admin_dashboard/dist');
app.use(express.static(frontendPath));

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
 * DATABASE INITIALIZATION (Secret Route)
 */
app.get('/init-db', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Triggering manual database initialization...');
    await initializeDatabase();
    res.send(`
      <div style="font-family: sans-serif; padding: 20px; background: #e6fffa; border: 1px solid #38b2ac; border-radius: 8px;">
        <h1 style="color: #2c7a7b;">✅ Database Initialized!</h1>
        <p>The tables have been created successfully.</p>
        <a href="/" style="display: inline-block; padding: 10px 20px; background: #319795; color: white; text-decoration: none; border-radius: 4px;">Go to Dashboard</a>
      </div>
    `);
  } catch (error: any) {
    res.status(500).send(`
      <div style="font-family: sans-serif; padding: 20px; background: #fff5f5; border: 1px solid #f56565; border-radius: 8px;">
        <h1 style="color: #c53030;">❌ Initialization Failed</h1>
        <p>${error.message}</p>
        <p>Check the Railway logs for more details.</p>
      </div>
    `);
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
    console.log('🚀 Starting TDS-APP Unified System...');
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
      console.log(`   Serving Frontend from: ${frontendPath}`);
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
