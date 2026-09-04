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

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'YenSync Backend API', timestamp: new Date().toISOString() });
});

// Mount routes
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

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 YenSync Backend API server running on port ${PORT}`);
  });
}

module.exports = app;
