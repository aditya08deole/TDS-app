const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  try {
    console.log('📡 Connecting to PostgreSQL...');
    const schema = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');

    await pool.query(schema);
    console.log('✅ Database schema created successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

initDb();
