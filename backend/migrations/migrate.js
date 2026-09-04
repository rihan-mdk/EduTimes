const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'yensync_db',
  connectionTimeoutMillis: 2000,
});

async function runMigrations() {
  let client;
  try {
    console.log('🔄 Checking PostgreSQL connection...');
    console.log(`📡 Target: ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'} (Database: ${process.env.PGDATABASE || 'yensync_db'})`);

    client = await pool.connect();

    const migrationFiles = [
      '001_initial_schema.sql',
      '002_seed_data.sql',
      '003_add_subject_parallel_and_block_columns.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`⏳ Executing ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`✅ ${file} applied successfully.`);
      }
    }

    console.log('\n🎉 All PostgreSQL migrations completed successfully!');
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️ Local PostgreSQL service is currently offline or unreachable.');
      console.log('💡 NOTE: YenSync includes an automatic zero-config in-memory database fallback.');
      console.log('👉 You can run `npm start` directly and YenSync will work immediately out-of-the-box!');
      process.exit(0);
    } else {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
