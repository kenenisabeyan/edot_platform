/**
 * EDOT Intelligence Domain - Dynamic Rate Limiting & Concurrency Control Service
 * Protects heavy AI endpoints and public APIs from concurrency overload.
 */

const rateLimitStore = new Map();

/**
 * Checks if a key exceeds rate limits within a time window (seconds).
 */
export function checkRateLimit(key, maxRequests = 60, windowSeconds = 60, isBypass = false) {
  if (isBypass) {
    return { allowed: true, remaining: maxRequests };
  }

  if (!key) {
    return { allowed: true, remaining: maxRequests };
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count++;
  }

  rateLimitStore.set(key, record);

  const allowed = record.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - record.count);

  return {
    allowed,
    remaining,
    resetAt: new Date(record.resetAt).toISOString()
  };
}
