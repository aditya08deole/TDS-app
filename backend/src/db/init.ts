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
    
    // Check multiple potential paths for schema.sql
    const pathsToTry = [
      path.join(__dirname, '../../src/db/schema.sql'), // Prod: backend/dist/db -> backend/src/db
      path.join(__dirname, '../db/schema.sql'),      // Prod alternative
      path.join(__dirname, './schema.sql'),          // Same dir
      path.join(process.cwd(), 'backend/src/db/schema.sql'),
      path.join(process.cwd(), 'src/db/schema.sql')
    ];

    let schemaContent = '';
    let foundPath = '';

    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        schemaContent = fs.readFileSync(p, 'utf8');
        foundPath = p;
        break;
      }
    }

    if (!schemaContent) {
      throw new Error('Could not find schema.sql in any expected location: ' + pathsToTry.join(', '));
    }

    console.log(`✅ Found schema at: ${foundPath}`);
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

