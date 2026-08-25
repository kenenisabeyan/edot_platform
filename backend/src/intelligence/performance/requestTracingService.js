/**
 * EDOT Intelligence Domain - Request Tracing & Correlation Service
 * Assigns unique requestId and trace context to incoming requests using Node.js native crypto.
 */

import crypto from 'crypto';

/**
 * Express middleware attaching requestId to req and res headers.
 */
export function requestTracingMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Generates an isolated correlation ID.
 */
export function generateCorrelationId() {
  return crypto.randomUUID();
}
