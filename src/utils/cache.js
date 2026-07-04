/**
 * Simple LRU (Least Recently Used) cache with TTL support.
 * Thread-safe for single-threaded Node.js event loop.
 *
 * Usage:
 *   const cache = new LRUCache(1000, 10 * 60 * 1000);  // 1000 items, 10 min TTL
 *   const value = cache.get('key');
 *   if (!value) {
 *     value = await expensiveOperation();
 *     cache.set('key', value);
 *   }
 *   cache.invalidate(/^prefix:/);  // Invalidate by pattern
 */
export class LRUCache {
  constructor(maxSize = 1000, ttlMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get value from cache if it exists and hasn't expired.
   * Moves item to end (most recently used) on hit.
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // LRU: move to end by deleting and re-adding
    this.cache.delete(key);
    this.cache.set(key, item);
    this.stats.hits++;
    return item.value;
  }

  /**
   * Set value in cache with TTL.
   * If cache is at capacity, evicts oldest (least recently used) item.
   */
  set(key, value) {
    // Remove if exists (to update position)
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Delete single key
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching regex pattern
   */
  invalidate(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : 'N/A',
    };
  }
}

// Shared caches
export const tenantCache = new LRUCache(1000, 10 * 60 * 1000);      // 10 min TTL
export const planCache = new LRUCache(500, 30 * 1000);              // 30 sec TTL
export const reportCache = new LRUCache(100, 60 * 60 * 1000);       // 1 hour TTL
export const productCache = new LRUCache(1000, 30 * 60 * 1000);     // 30 min TTL

export default LRUCache;
