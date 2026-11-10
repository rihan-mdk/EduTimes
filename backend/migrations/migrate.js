const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
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
    const targetHost = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')
      : `${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'} (${process.env.PGDATABASE || 'yensync_db'})`;
    console.log(`📡 Target: ${targetHost}`);

    client = await pool.connect();

    const migrationFiles = [
      '001_initial_schema.sql',
      '002_seed_data.sql',
      '003_add_subject_parallel_and_block_columns.sql',
      '004_add_generic_activity_and_session_type.sql',
      '005_add_department_code.sql',
      '006_scope_subject_code_uniqueness.sql',
      '007_add_semester_advisor_and_mentors.sql',
      '008_make_faculty_id_nullable_for_generic_activities.sql',
      '009_faculty_busy_slots.sql',
      '010_enable_rls.sql'
    ];

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    const appliedRes = await client.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map(r => r.version));

    // If tables already exist before schema_migrations table was created, mark 001-010 as already applied
    const tableCheck = await client.query("SELECT to_regclass('public.department') as dept_exists");
    if (tableCheck.rows[0]?.dept_exists && appliedSet.size === 0) {
      for (const file of migrationFiles) {
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        appliedSet.add(file);
      }
      console.log('ℹ️ Existing database schema detected — initialized migration history.');
    }

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`⏩ ${file} (already applied)`);
        continue;
      }
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`⏳ Executing ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
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
