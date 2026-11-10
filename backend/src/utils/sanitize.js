/**
 * Input sanitization and validation utilities for YenSync
 * Defends against XSS, control-character injection, and malformed inputs.
 */

/**
 * Strips HTML tags, script elements, and dangerous control characters from string inputs.
 */
function sanitizeText(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script blocks
    .replace(/<[^>]+>/g, '') // Strip all HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip non-printable ASCII control characters
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalizes and sanitizes identifier codes (department codes, faculty codes, subject codes).
 * Allows only alphanumeric characters, underscores, and hyphens.
 */
function sanitizeCode(value, maxLength = 30) {
  if (!value) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '')
    .slice(0, maxLength);
}

/**
 * Validates password strength according to standard security recommendations.
 * Requires at least 8 characters.
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters.' };
  }
  return { valid: true };
}

module.exports = {
  sanitizeText,
  sanitizeCode,
  validatePassword
};

