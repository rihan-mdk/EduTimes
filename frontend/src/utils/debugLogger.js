/**
 * Developer Error Logging & Debug Subsystem for EduTimes
 *
 * Captures:
 * - JavaScript runtime errors (window.onerror)
 * - Unhandled Promise rejections (unhandledrejection)
 * - React Component stack errors (via DebugErrorBoundary)
 * - Failed API calls & network errors (via apiRequest hook)
 * - Intercepted console.error and console.warn calls
 *
 * Features:
 * - In-memory ring buffer (capped at 100 entries)
 * - SessionStorage synchronization for persistence across reloads/nav
 * - Recursive data sanitizer redacting passwords, tokens, auth headers, cookies
 * - Safe from circular references
 * - Defensive try/catch so the logger NEVER throws or breaks the app
 */

const STORAGE_KEY = 'edutimes_debug_logs';
const MAX_LOGS = 100;

// Sensitive keys to redact
const REDACTED_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'jwt',
  'authorization',
  'auth',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'key',
  'credit_card',
  'access_token',
  'refresh_token',
]);

/**
 * Recursively redacts sensitive values from objects or JSON-like structures.
 */
function sanitizeData(data, depth = 0, seen = new WeakSet()) {
  if (depth > 6) return '[Max Depth Reached]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact Bearer tokens in raw strings
    let sanitized = data.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
    // Redact password=... or token=... in query strings or form payloads
    sanitized = sanitized.replace(/(password|token|secret|key)=([^&]+)/gi, '$1=[REDACTED]');
    return sanitized;
  }

  if (typeof data !== 'object') return data;

  // Handle circular references
  if (seen.has(data)) return '[Circular Reference]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, depth + 1, seen));
  }

  const sanitizedObj = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive =
      REDACTED_KEYS.has(lowerKey) ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret');

    if (isSensitive) {
      sanitizedObj[key] = '[REDACTED]';
    } else {
      sanitizedObj[key] = sanitizeData(value, depth + 1, seen);
    }
  }
  return sanitizedObj;
}

/**
 * Format stack trace string into cleaned lines
 */
function formatStack(stack) {
  if (!stack || typeof stack !== 'string') return '';
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

class DebugLogger {
  constructor() {
    this.logs = [];
    this.listeners = new Set();
    this.unreadCount = 0;
    this.isPanelOpen = false;
    this.initialized = false;

    // Load persisted logs from sessionStorage safely
    this.loadFromStorage();
  }

  /**
   * Initialize global listeners (invoked once on app boot)
   */
  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    try {
      // 1. Capture JS Runtime errors
      window.addEventListener('error', (event) => {
        try {
          // Ignore errors from browser extensions or cross-origin scripts with no info
          if (event.filename && event.filename.startsWith('chrome-extension://')) return;

          this.addLog({
            type: 'RUNTIME',
            severity: 'error',
            message: event.message || 'Unknown runtime script error',
            source: event.filename || 'window',
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack ? formatStack(event.error.stack) : '',
            context: {
              target: event.target?.tagName || 'window',
            },
          });
        } catch (e) {
          // Prevent recursion
        }
      });

      // 2. Capture Unhandled Promise Rejections
      window.addEventListener('unhandledrejection', (event) => {
        try {
          const reason = event.reason;
          const message =
            reason instanceof Error
              ? reason.message
              : typeof reason === 'string'
              ? reason
              : JSON.stringify(reason || 'Unhandled Promise rejection');

          this.addLog({
            type: 'PROMISE',
            severity: 'error',
            message: `Unhandled Rejection: ${message}`,
            source: 'Promise',
            stack: reason instanceof Error ? formatStack(reason.stack) : '',
            context: {
              reason: sanitizeData(reason),
            },
          });
        } catch (e) {
          // Prevent recursion
        }
      });

      // 3. Intercept console.error & console.warn
      this.hookConsole();
    } catch (err) {
      // Fail gracefully
    }
  }

  /**
   * Safely wraps native console methods while preserving DevTools logging
   */
  hookConsole() {
    if (typeof console === 'undefined') return;

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args) => {
      try {
        originalError.apply(console, args);

        const firstArg = args[0];
        // Deduplicate if this is a React ErrorBoundary error that we log directly
        if (typeof firstArg === 'string' && firstArg.includes('The above error occurred in the <')) {
          return;
        }

        const message = args
          .map((arg) => (arg instanceof Error ? arg.message : typeof arg === 'object' ? JSON.stringify(sanitizeData(arg)) : String(arg)))
          .join(' ');

        const errorObj = args.find((a) => a instanceof Error);

        this.addLog({
          type: 'CONSOLE',
          severity: 'error',
          message: message || 'console.error called',
          source: 'console.error',
          stack: errorObj?.stack ? formatStack(errorObj.stack) : formatStack(new Error().stack),
          context: {
            arguments: sanitizeData(args),
          },
        });
      } catch (e) {
        originalError.apply(console, args);
      }
    };

    console.warn = (...args) => {
      try {
        originalWarn.apply(console, args);

        const message = args
          .map((arg) => (typeof arg === 'object' ? JSON.stringify(sanitizeData(arg)) : String(arg)))
          .join(' ');

        this.addLog({
          type: 'CONSOLE',
          severity: 'warn',
          message: message || 'console.warn called',
          source: 'console.warn',
          stack: formatStack(new Error().stack),
          context: {
            arguments: sanitizeData(args),
          },
        });
      } catch (e) {
        originalWarn.apply(console, args);
      }
    };
  }

  /**
   * Log an API request failure
   */
  logApiFailure({ endpoint, method = 'GET', status = 0, statusText = '', duration = 0, requestBody = null, responseBody = null, error = null }) {
    try {
      const errorMessage = error?.message || (status ? `HTTP ${status} ${statusText}` : 'Network Request Failed');

      this.addLog({
        type: 'API',
        severity: 'error',
        message: `${method.toUpperCase()} ${endpoint} - ${errorMessage}`,
        source: endpoint,
        stack: error?.stack ? formatStack(error.stack) : '',
        apiDetails: {
          endpoint,
          method: method.toUpperCase(),
          status: status || 'Failed',
          statusText: statusText || (status === 0 ? 'Network Error / Blocked' : ''),
          durationMs: duration,
          requestBody: sanitizeData(requestBody),
          responseBody: sanitizeData(responseBody),
        },
      });
    } catch (e) {
      // Defensive
    }
  }

  /**
   * Log React Error Boundary crash
   */
  logReactError(error, errorInfo) {
    try {
      this.addLog({
        type: 'REACT',
        severity: 'error',
        message: `React Render Crash: ${error?.message || 'Unknown render error'}`,
        source: 'React.Component',
        stack: error?.stack ? formatStack(error.stack) : '',
        context: {
          componentStack: errorInfo?.componentStack ? formatStack(errorInfo.componentStack) : '',
        },
      });
    } catch (e) {
      // Defensive
    }
  }

  /**
   * Generic internal add log method
   */
  addLog(entry) {
    try {
      const now = new Date();
      const newEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: now.toLocaleTimeString(),
        isoTime: now.toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        ...entry,
      };

      this.logs.unshift(newEntry);

      // Keep only up to MAX_LOGS
      if (this.logs.length > MAX_LOGS) {
        this.logs.length = MAX_LOGS;
      }

      if (!this.isPanelOpen) {
        this.unreadCount += 1;
      }

      this.saveToStorage();
      this.notifyListeners();
    } catch (err) {
      // Never throw
    }
  }

  setPanelOpen(isOpen) {
    this.isPanelOpen = isOpen;
    if (isOpen) {
      this.unreadCount = 0;
      this.notifyListeners();
    }
  }

  clearLogs() {
    this.logs = [];
    this.unreadCount = 0;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}
    this.notifyListeners();
  }

  getLogs() {
    return [...this.logs];
  }

  getStats() {
    let errors = 0;
    let warnings = 0;
    let apiFailures = 0;

    for (const log of this.logs) {
      if (log.severity === 'warn') {
        warnings += 1;
      } else {
        errors += 1;
      }
      if (log.type === 'API') {
        apiFailures += 1;
      }
    }

    return {
      total: this.logs.length,
      errors,
      warnings,
      apiFailures,
      unreadCount: this.unreadCount,
      mostRecent: this.logs[0] || null,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.logs, this.getStats());
      } catch (e) {}
    }
  }

  saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        // Only save safe subset to avoid quotas
        const serialized = JSON.stringify(this.logs.slice(0, 50));
        sessionStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {}
  }

  loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.logs = parsed;
          }
        }
      }
    } catch (e) {}
  }
}

// Export singleton instance
export const debugLogger = new DebugLogger();
