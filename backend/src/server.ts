import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { initializePool, closePool, query as dbQuery } from './db/connection';
import { startScheduler, stopScheduler, getSchedulerStatus } from './sync/scheduler';
import { syncFromFirebase } from './services/syncService';
import deviceRoutes from './api/routes/devices';
import syncRoutes from './api/routes/sync';
import { TDS_CONFIG } from './config/tdsConfig';
import { initializeDatabase } from './db/init';
import { findSchemaPath, getFrontendPath } from './utils/pathUtils';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══ MIDDLEWARE ═══
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for static serving simplicity in production
}));
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-db-init-key']
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 🛠️ EMERGENCY DATABASE INITIALIZATION
 * Only accessible via a secure key to prevent unauthorized destructive operations.
 */
app.get('/init-db', async (req: Request, res: Response) => {
  try {
    const authKey = req.query.key || req.headers['x-db-init-key'];
    const requiredKey = process.env.DB_INIT_KEY;

    if (!requiredKey || authKey !== requiredKey) {
      console.warn(`⚠️ Unauthorized attempt to initialize database from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized: Valid DB_INIT_KEY required' });
    }

    const schemaPath = findSchemaPath();
    
    await initializeDatabase();
    
    res.send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; text-align: center; background: #f0fff4; border-radius: 12px; max-width: 600px; margin: 40px auto; border: 1px solid #c6f6d5; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h1 style="color: #2f855a; margin-bottom: 16px;">✅ Database Initialized</h1>
        <p style="color: #4a5568; line-height: 1.6;">Tables have been synchronized with the latest schema. The system is ready.</p>
        <a href="/" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #38a169; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; transition: background 0.2s;">Go to Dashboard</a>
      </div>
    `);
  } catch (err: any) {
    console.error('❌ DB INIT FAILED:', err);
    res.status(500).json({ success: false, error: 'Database initialization failed. Check server logs.' });
  }
});


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
const frontendPath = getFrontendPath();
app.use(express.static(frontendPath));

// ═══ ROUTES ═══

/**
 * Health check endpoint
 */


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
 * Consolidated health check for API and Database
 */
app.get('/health', async (req, res) => {
  try {
    // Check DB connectivity
    const dbCheck = await dbQuery('SELECT 1 as connected');
    const dbStatus = dbCheck.rows[0]?.connected === 1 ? 'up' : 'down';

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: dbStatus,
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
    console.log(`📡 Database URL (host): ${process.env.DATABASE_URL?.split('@')[1] || 'NOT SET'}`);

    // 🚀 AUTO-INITIALIZE TABLES (If missing)
    try {
      await initializeDatabase();
    } catch (dbErr) {
      console.warn('⚠️ Auto-init check finished with status:', dbErr);
    }

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
