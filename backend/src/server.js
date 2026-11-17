const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('./config/db');
const { globalLimiter } = require('./middleware/rateLimiters');
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const semesterRoutes = require('./routes/semesterRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const timeslotRoutes = require('./routes/timeslotRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const busySlotRoutes = require('./routes/busySlotRoutes');
const allotmentRoutes = require('./routes/allotmentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for cloud deployment (Render, AWS, Cloudflare, Vercel)
// Ensures correct client IP detection in rate limiters and loggers behind reverse proxies
app.set('trust proxy', 1);

// ─── CORS Configuration ────────────────────────────────────────────────────────
// Whitelist default allowed origins (including user's Vercel deployment and local dev)
const defaultOrigins = [
  'https://edu-times.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5000'
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().replace(/\/+$/, ''))
  : [];

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g. mobile, curl, server-to-server) or when not in production
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.indexOf(cleanOrigin) !== -1 || /^https:\/\/.*\.vercel\.app$/.test(cleanOrigin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};

// Handle ALL preflight OPTIONS requests immediately — before any other middleware.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
// Hides X-Powered-By, sets X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.disable('x-powered-by');

// ─── Body Parsers with Strict Size Limits ──────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Protects general API endpoints against flooding and DoS
app.use('/api/', globalLimiter);

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ─── Health Checks ────────────────────────────────────────────────────────────
// Shallow liveness probe (checks event loop responsiveness)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'EduTimes Backend API',
    database: db.getDatabaseStatus(),
    timestamp: new Date().toISOString()
  });
});

// Deep readiness probe (verifies database pool connectivity & measures latency)
app.get('/api/health/ready', async (req, res) => {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    const dbLatencyMs = Date.now() - start;
    res.json({
      status: 'ready',
      database: {
        ...db.getDatabaseStatus(),
        connected: true,
        latencyMs: dbLatencyMs
      },
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: `Database probe failed: ${err.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/timeslots', timeslotRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/faculty-busy-slots', busySlotRoutes);
app.use('/api/allotment', allotmentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Global error handler — always sends CORS-safe JSON so the client gets a
// readable error instead of a network-level CORS failure
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message || err);
  const status = err.message && err.message.includes('CORS') ? 403 : 500;
  res.status(status).json({ error: err.message || 'An unexpected server error occurred.' });
});

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`🚀 EduTimes Backend API running on port ${PORT}`);
  });

  // Recommended keep-alive timeout configuration for cloud load balancers (Render/AWS/Cloudflare)
  server.keepAliveTimeout = 61000;
  server.headersTimeout = 65000;

  // Graceful shutdown handling for container redeployments and SIGTERM/SIGINT
  const gracefulShutdown = (signal) => {
    console.log(`\n🛑 [Shutdown] Received ${signal}. Draining connections and stopping server...`);
    if (!server) process.exit(0);

    server.close(async () => {
      console.log('✅ [Shutdown] HTTP listener closed.');
      try {
        if (db.pool && typeof db.pool.end === 'function') {
          await db.pool.end();
          console.log('✅ [Shutdown] Database pool closed.');
        }
      } catch (poolErr) {
        console.error('⚠️ [Shutdown] Error closing database pool:', poolErr.message);
      }
      process.exit(0);
    });

    // Force terminate if graceful shutdown hangs
    setTimeout(() => {
      console.error('⚠️ [Shutdown] Forcible shutdown timeout reached. Terminating process.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// ─── Process-level safety — prevent container crashes ─────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

module.exports = app;
