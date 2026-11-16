/**
 * Lightweight In-Memory Caching Service
 * Zero external dependencies. Designed for fast lookups of static/semi-static metadata
 * (e.g. timeslots grid, departments, academic calendar, semesters).
 * Supports automatic TTL expiration and event-driven invalidation.
 */

class MemoryCache {
  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlMs;
    this.hitCount = 0;
    this.missCount = 0;
  }

  set(key, value, ttlMs = this.defaultTtl) {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.missCount++;
      return null;
    }
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }
    this.hitCount++;
    return item.value;
  }

  del(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidates all keys starting with a given prefix (e.g. 'timeslots', 'departments')
   */
  invalidatePrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Transparent cache-aside wrapper: returns cached value or executes fetcherFn and caches result
   */
  async getOrSet(key, fetcherFn, ttlMs = this.defaultTtl) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await fetcherFn();
    if (fresh !== undefined && fresh !== null) {
      this.set(key, fresh, ttlMs);
    }
    return fresh;
  }

  clear() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  stats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? `${((this.hitCount / total) * 100).toFixed(1)}%` : '0.0%'
    };
  }
}

// Global cache instance for metadata
const cache = new MemoryCache();

module.exports = cache;
