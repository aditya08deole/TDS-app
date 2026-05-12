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

/**
 * 🛠️ EMERGENCY DATABASE INITIALIZATION
 * This is at the top to ensure it's hit before any static serving or SPA routing.
 */
app.get('/init-db', async (req: Request, res: Response) => {
  try {
    console.log('🚀 MANUALLY TRIGGERING DB INIT...');
    
    // Check multiple potential paths for schema.sql on Railway
    const pathsToTry = [
      path.join(__dirname, '../../src/db/schema.sql'),
      path.join(__dirname, '../db/schema.sql'),
      path.join(__dirname, './db/schema.sql'),
      path.join(process.cwd(), 'backend/src/db/schema.sql'),
      path.join(process.cwd(), 'src/db/schema.sql')
    ];

    let schemaContent = '';
    let foundPath = '';

    for (const p of pathsToTry) {
      if (require('fs').existsSync(p)) {
        schemaContent = require('fs').readFileSync(p, 'utf8');
        foundPath = p;
        break;
      }
    }

    if (!schemaContent) {
      throw new Error('Could not find schema.sql in any expected location: ' + pathsToTry.join(', '));
    }

    console.log(`✅ Found schema at: ${foundPath}`);
    await initializeDatabase();
    
    res.send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #f0fff4;">
        <h1 style="color: #2f855a;">✅ DATABASE INITIALIZED SUCCESSFULLY!</h1>
        <p>Tables have been created. You can now check the Railway Postgres tab.</p>
        <a href="/" style="padding: 10px 20px; background: #38a169; color: white; text-decoration: none; border-radius: 5px;">Return to Dashboard</a>
      </div>
    `);
  } catch (err: any) {
    console.error('❌ DB INIT FAILED:', err);
    res.status(500).send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #fff5f5;">
        <h1 style="color: #c53030;">❌ DATABASE INIT FAILED</h1>
        <p style="color: #742a2a;">${err.message}</p>
        <p>Try running the SQL manually in the Railway UI.</p>
      </div>
    `);
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
