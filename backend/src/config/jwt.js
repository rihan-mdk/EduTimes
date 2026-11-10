require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'yensync_super_secret_jwt_key_2026_department';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('super_secret') || process.env.JWT_SECRET.length < 32)) {
  console.error('🚨 [SECURITY CRITICAL]: Default or weak JWT_SECRET detected in production! Please configure a secure random 256-bit key in environment variables.');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN
};

