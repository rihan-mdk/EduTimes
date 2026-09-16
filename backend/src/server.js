const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const semesterRoutes = require('./routes/semesterRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const timeslotRoutes = require('./routes/timeslotRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const calendarRoutes = require('./routes/calendarRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS Configuration ────────────────────────────────────────────────────────
// NOTE: This must be the VERY FIRST middleware registered.
// When the server crashes/restarts on Render, the browser sends an OPTIONS
// preflight before the real request. If CORS isn't handled immediately, the
// browser gets no Access-Control-Allow-Origin header and shows a "CORS error"
// even though the real problem is a server timeout / cold start.
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,  // Some browsers (IE11) choke on 200 for OPTIONS
};

// Handle ALL preflight OPTIONS requests immediately — before any other middleware.
// This guarantees CORS headers are sent even if a later middleware is slow/throws.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────
// Render pings this every 30s. Must respond fast — no DB call here.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'EduTimes Backend API', timestamp: new Date().toISOString() });
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Global error handler — always sends CORS-safe JSON so the client gets a
// readable error instead of a network-level CORS failure
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 EduTimes Backend API running on port ${PORT}`);
  });
}

// ─── Process-level safety — prevent container crashes ─────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

module.exports = app;
