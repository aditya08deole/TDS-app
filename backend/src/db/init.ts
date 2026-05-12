import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDb() {
  try {
    console.log('🔄 Initializing database...');
    
    const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolon but handle potential issues with triggers/functions
    // For simplicity, we execute the whole block.
    await pool.query(schema);

    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

initDb();
