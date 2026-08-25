/**
 * EDOT Intelligence Domain - High-Throughput Caching Engine
 * In-memory & Redis-ready caching layer for dashboards, recommendations, course metadata, and mastery summaries.
 * Features configurable TTLs, hit/miss tracking, and event-driven invalidation.
 */

const cacheStore = new Map();
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Gets a cached item by key.
 */
export function getCachedItem(key) {
  if (!key) return null;

  const item = cacheStore.get(key);
  if (!item) {
    cacheMisses++;
    return null;
  }

  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    cacheMisses++;
    return null;
  }

  cacheHits++;
  return item.value;
}

/**
 * Sets a cached item with configurable TTL in seconds.
 */
export function setCachedItem(key, value, ttlSeconds = 300) {
  if (!key) return;

  const expiresAt = Date.now() + (ttlSeconds * 1000);
  cacheStore.set(key, { value, expiresAt });
}

/**
 * Invalidates cache by exact key or key prefix.
 */
export function invalidateCache(keyOrPrefix) {
  if (!keyOrPrefix) return 0;

  let count = 0;
  for (const k of cacheStore.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      cacheStore.delete(k);
      count++;
    }
  }
  return count;
}

/**
 * Invalidates all cache entries for a specific student.
 */
export function invalidateUserCache(userId) {
  return invalidateCache(`user:${userId}`);
}

/**
 * Invalidates all cache entries for a specific course.
 */
export function invalidateCourseCache(courseId) {
  return invalidateCache(`course:${courseId}`);
}

/**
 * Returns cache performance metrics (hit ratio, total keys, hits, misses).
 */
export function getCacheMetrics() {
  const totalRequests = cacheHits + cacheMisses;
  const hitRatioPercent = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 100;

  return {
    totalKeys: cacheStore.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRatioPercent,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Flushes all entries from the cache store.
 */
export function flushAllCache() {
  const count = cacheStore.size;
  cacheStore.clear();
  return count;
}
