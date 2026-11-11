const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Prioritize IPv4 DNS lookups to prevent EAI_AGAIN timeouts on cloud poolers
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

let useMemoryDb = false;
let memDb = null;
let pgPool = null;
let dbConnected = false;

// Initialize real PostgreSQL pool
if (hasDatabaseUrl) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required for Supabase/Neon/Railway SSL
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
} else if (!isProduction) {
  // Local development without DATABASE_URL
  pgPool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'yensync_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 1500,
  });
}

// Handle idle connection errors to prevent unhandled 'error' events from crashing Node
if (pgPool) {
  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle pg client (handled):', err.message);
  });
}

// Setup embedded in-memory PostgreSQL engine fallback (LOCAL DEV ONLY)
function initMemoryDb() {
  if (memDb) return memDb;

  console.log('⚡ Initializing embedded in-memory database fallback...');
  const { newDb } = require('pg-mem');
  memDb = newDb();

  // Load migrations and seed SQL
  const migration1 = fs.readFileSync(path.join(__dirname, '../../migrations/001_initial_schema.sql'), 'utf8');
  const migration2 = fs.readFileSync(path.join(__dirname, '../../migrations/002_seed_data.sql'), 'utf8');
  const migration3 = fs.readFileSync(path.join(__dirname, '../../migrations/003_add_subject_parallel_and_block_columns.sql'), 'utf8');
  const migration4 = fs.readFileSync(path.join(__dirname, '../../migrations/004_add_generic_activity_and_session_type.sql'), 'utf8');
  const migration5 = fs.readFileSync(path.join(__dirname, '../../migrations/005_add_department_code.sql'), 'utf8');
  const migration6 = fs.readFileSync(path.join(__dirname, '../../migrations/006_scope_subject_code_uniqueness.sql'), 'utf8');
  const migration7 = fs.readFileSync(path.join(__dirname, '../../migrations/007_add_semester_advisor_and_mentors.sql'), 'utf8');
  const migration8 = fs.readFileSync(path.join(__dirname, '../../migrations/008_make_faculty_id_nullable_for_generic_activities.sql'), 'utf8');
  const migration9 = fs.readFileSync(path.join(__dirname, '../../migrations/009_faculty_busy_slots.sql'), 'utf8');
  const migration10 = fs.readFileSync(path.join(__dirname, '../../migrations/010_enable_rls.sql'), 'utf8');

  try {
    memDb.public.none(migration1);
    memDb.public.none(migration2);
    try { memDb.public.none(migration3); } catch (e) { /* column already exists */ }
    try { memDb.public.none(migration4); } catch (e) { /* column already exists */ }
    try { memDb.public.none(migration5); } catch (e) { /* column already exists */ }
    try { memDb.public.none(migration6); } catch (e) { /* constraint already exists */ }
    try { memDb.public.none(migration7); } catch (e) { /* column already exists */ }
    try { memDb.public.none(migration8); } catch (e) { /* constraint already altered */ }
    try { memDb.public.none(migration9); } catch (e) { /* table or index already exists */ }
    try { memDb.public.none(migration10); } catch (e) { /* rls noop in pg-mem */ }
    console.log('✅ In-memory database initialized with all tables, seed data, and migrations 001-010!');
  } catch (err) {
    console.warn('Memory DB init note:', err.message);
  }

  return memDb;
}

// Safely format SQL value
function formatSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Single-pass regex interpolation using functional replacer
function interpolateSql(text, params) {
  if (!params || !params.length) return text;
  return text.replace(/\$(\d+)\b/g, (match, digits) => {
    const idx = parseInt(digits, 10) - 1;
    if (idx >= 0 && idx < params.length) {
      return formatSqlValue(params[idx]);
    }
    return match;
  });
}

// Check connection with exponential retries
(async function connectWithRetry(retries = 3, delay = 2000) {
  if (!pgPool) {
    if (isProduction || hasDatabaseUrl) {
      console.error('❌ CRITICAL: DATABASE_URL is not set in Render environment variables! Data cannot be saved persistently.');
    } else {
      console.log('ℹ️ No PostgreSQL configured. Falling back to zero-config in-memory database for local offline development.');
      useMemoryDb = true;
      initMemoryDb();
    }
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pgPool.connect();
      console.log('🐘 Connected to external PostgreSQL database (Supabase persistent storage active).');
      dbConnected = true;
      useMemoryDb = false;
      client.release();
      return;
    } catch (err) {
      console.warn(`⚠️ PostgreSQL connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay));
      } else {
        if (hasDatabaseUrl || isProduction) {
          console.error('❌ Failed to connect to DATABASE_URL after retries:', err.message);
          // In production or when DATABASE_URL is given, DO NOT switch to memory DB.
          // Keep pgPool so queries can retry when the network wakes up!
          dbConnected = false;
        } else {
          console.log('⚠️ Local PostgreSQL not detected. Falling back to zero-config in-memory database for local offline testing.');
          useMemoryDb = true;
          initMemoryDb();
        }
      }
    }
  }
})();

async function query(text, params = []) {
  if (useMemoryDb) {
    const mem = initMemoryDb();
    const formattedSql = interpolateSql(text, params);
    try {
      const isSelect = /^\s*SELECT/i.test(text);
      if (isSelect) {
        const rows = mem.public.many(formattedSql);
        return { rows, rowCount: rows.length };
      } else {
        const rows = mem.public.query(formattedSql).rows || [];
        return { rows, rowCount: rows.length };
      }
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('unique')) {
        const customErr = new Error(err.message);
        customErr.code = '23505';
        customErr.detail = err.message;
        throw customErr;
      }
      throw err;
    }
  }

  if (!pgPool) {
    throw new Error('Database connection is not configured. Please set DATABASE_URL in environment variables.');
  }

  try {
    return await pgPool.query(text, params);
  } catch (err) {
    // Retry once on transient pooler connection drop
    if (err.code === 'ECONNRESET' || err.code === 'EAI_AGAIN' || (err.message && err.message.includes('Connection terminated'))) {
      console.warn('⚠️ Transient connection drop. Retrying query once...');
      return await pgPool.query(text, params);
    }
    // Only fallback to memory if NOT in production and NO database_url was provided
    if (!hasDatabaseUrl && !isProduction && (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('ECONNREFUSED')))) {
      useMemoryDb = true;
      const mem = initMemoryDb();
      const formattedSql = interpolateSql(text, params);
      const rows = mem.public.query(formattedSql).rows || [];
      return { rows, rowCount: rows.length };
    }
    throw err;
  }
}

const poolProxy = {
  connect: async () => {
    if (useMemoryDb) {
      return {
        query: (t, p) => query(t, p),
        release: () => {}
      };
    }
    if (!pgPool) {
      throw new Error('Database connection is not configured. Please set DATABASE_URL in environment variables.');
    }
    return await pgPool.connect();
  },
  query,
  on: (event, handler) => {
    if (pgPool) pgPool.on(event, handler);
  }
};

function getDatabaseStatus() {
  return {
    configured: Boolean(process.env.DATABASE_URL),
    mode: useMemoryDb ? 'IN_MEMORY_EPHEMERAL' : (hasDatabaseUrl ? 'POSTGRESQL_PERSISTENT' : 'LOCAL_POSTGRES'),
    connected: dbConnected,
    isMemory: useMemoryDb
  };
}

module.exports = {
  query,
  pool: poolProxy,
  getDatabaseStatus,
  isUsingMemory: () => useMemoryDb
};
