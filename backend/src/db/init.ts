import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Initializing database...');
    
    // In production (dist), __dirname is backend/dist/db. schema.sql is in backend/src/db/schema.sql
    // So we need to look one level up then into src/db
    let schemaPath = path.join(__dirname, '../../src/db/schema.sql');
    
    // Fallback for different build structures
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, '../db/schema.sql');
    }
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('✅ Database initialized successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Only run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

