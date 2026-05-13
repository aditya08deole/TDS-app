import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { findSchemaPath } from '../utils/pathUtils';

dotenv.config();

export async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Initializing database...');
    
    const schemaPath = findSchemaPath();
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    console.log(`✅ Found schema at: ${schemaPath}`);
    await pool.query(schemaContent);
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

