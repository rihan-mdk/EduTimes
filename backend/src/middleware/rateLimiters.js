const rateLimit = require('express-rate-limit');

// Global API rate limiter - 500 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Authentication rate limiter - 15 requests per 15 minutes (protects against brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// Timetable solver limiter - 10 requests per 5 minutes (protects CPU from solver DoS)
const schedulerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Timetable generation rate limit reached. Please wait a few minutes before regenerating.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  schedulerLimiter
};

