const rateLimit = require('express-rate-limit');

const isTestOrBenchmark = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'benchmark';
const globalMax = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '2500', 10);
const authMax = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '30', 10);

// Global API rate limiter - 2,500 requests per 15 minutes (realistic for active department & campus usage)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestOrBenchmark,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Authentication rate limiter - 30 requests per 15 minutes (protects against brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestOrBenchmark,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// Timetable solver limiter - 20 requests per 5 minutes (protects CPU from solver DoS)
const schedulerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestOrBenchmark,
  message: {
    error: 'Timetable generation rate limit reached. Please wait a few minutes before regenerating.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  schedulerLimiter
};

