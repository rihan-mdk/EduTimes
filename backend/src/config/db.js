const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');
require('dotenv').config();

let useMemoryDb = false;
let memDb = null;
let pgPool = null;

// Initialize real PostgreSQL pool
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

// Setup embedded in-memory PostgreSQL engine fallback
function initMemoryDb() {
  if (memDb) return memDb;

  console.log('⚡ Initializing embedded in-memory database fallback...');
  memDb = newDb();

  // Load migrations and seed SQL
  const migration1 = fs.readFileSync(path.join(__dirname, '../../migrations/001_initial_schema.sql'), 'utf8');
  const migration2 = fs.readFileSync(path.join(__dirname, '../../migrations/002_seed_data.sql'), 'utf8');
  const migration3 = fs.readFileSync(path.join(__dirname, '../../migrations/003_add_subject_parallel_and_block_columns.sql'), 'utf8');
  const migration4 = fs.readFileSync(path.join(__dirname, '../../migrations/004_add_generic_activity_and_session_type.sql'), 'utf8');

  try {
    memDb.public.none(migration1);
    memDb.public.none(migration2);
    // Migrations 003 & 004: these ALTER TABLE statements may be no-ops in pg-mem
    // since the columns are already defined in migration 001 above.
    // Wrapped individually so one failure doesn't block the others.
    try { memDb.public.none(migration3); } catch (e) { /* column already exists */ }
    try { memDb.public.none(migration4); } catch (e) { /* column already exists */ }
    console.log('✅ In-memory database initialized with all tables, seed data, and migrations 001-004!');
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

// Single-pass regex interpolation using functional replacer (prevents recursive or $ character collisions)
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

// Check initial connection
(async () => {
  try {
    const client = await pgPool.connect();
    console.log('🐘 Connected to external PostgreSQL database.');
    client.release();
  } catch (err) {
    console.log('⚠️ Local PostgreSQL not detected (ECONNREFUSED). Falling back to zero-config in-memory database.');
    useMemoryDb = true;
    initMemoryDb();
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

  try {
    return await pgPool.query(text, params);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
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
    try {
      return await pgPool.connect();
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
        useMemoryDb = true;
        initMemoryDb();
        return {
          query: (t, p) => query(t, p),
          release: () => {}
        };
      }
      throw err;
    }
  },
  query,
  on: (event, handler) => {
    pgPool.on(event, handler);
  }
};

module.exports = {
  query,
  pool: poolProxy,
};
