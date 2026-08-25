/**
 * EDOT Intelligence Domain - Performance & Observability Master Orchestrator
 * Coordinates high-throughput caching, asynchronous telemetry batching, database query optimization,
 * structured logging, background job queues, circuit breakers, environment validation, load testing,
 * latency percentiles (p50/p95/p99), rate limiting, and failure isolation.
 */

import {
  getCachedItem,
  setCachedItem,
  invalidateCache,
  invalidateUserCache,
  invalidateCourseCache,
  getCacheMetrics,
  flushAllCache
} from './cacheService.js';
import {
  logSlowQuery,
  batchFetchByIds,
  getSlowQuerySummary
} from './dbOptimizationService.js';
import {
  enqueueTelemetryEvent,
  flushEventQueue,
  getEventQueueMetrics
} from './eventBatchingService.js';
import {
  recordLatencyMs,
  recordApiError,
  getLatencyPercentiles,
  getSystemPerformanceHealth
} from './observabilityService.js';
import { checkRateLimit } from './rateLimitService.js';
import { log, logInfo, logWarn, logError, logCritical, sanitizeLogContent } from './logger.js';
import { requestTracingMiddleware, generateCorrelationId } from './requestTracingService.js';
import { enqueueJob, processJobs } from './backgroundJobService.js';
import { executeWithCircuitBreaker, getCircuitBreakerState, CIRCUIT_STATES } from './circuitBreakerService.js';
import { validateConfig } from './configValidationService.js';
import { runLoadTestScenario } from './loadTestService.js';

export {
  getCachedItem,
  setCachedItem,
  invalidateCache,
  invalidateUserCache,
  invalidateCourseCache,
  getCacheMetrics,
  flushAllCache,
  logSlowQuery,
  batchFetchByIds,
  getSlowQuerySummary,
  enqueueTelemetryEvent,
  flushEventQueue,
  getEventQueueMetrics,
  recordLatencyMs,
  recordApiError,
  getLatencyPercentiles,
  getSystemPerformanceHealth,
  checkRateLimit,
  log,
  logInfo,
  logWarn,
  logError,
  logCritical,
  sanitizeLogContent,
  requestTracingMiddleware,
  generateCorrelationId,
  enqueueJob,
  processJobs,
  executeWithCircuitBreaker,
  getCircuitBreakerState,
  CIRCUIT_STATES,
  validateConfig,
  runLoadTestScenario
};

/**
 * Returns complete Admin Performance & Scale Overview.
 */
export async function getAdminPerformanceOverview() {
  const [health, cache, queue, slowQueries] = await Promise.all([
    getSystemPerformanceHealth(),
    Promise.resolve(getCacheMetrics()),
    Promise.resolve(getEventQueueMetrics()),
    getSlowQuerySummary()
  ]);

  return {
    systemHealthState: health.healthState,
    totalApiCalls: health.totalApiCalls,
    totalApiErrors: health.totalApiErrors,
    errorRatePercent: health.errorRatePercent,
    latencyPercentiles: health.latencyPercentiles,
    cache: {
      totalKeys: cache.totalKeys,
      hitRatioPercent: cache.hitRatioPercent,
      hits: cache.hits,
      misses: cache.misses
    },
    eventQueue: {
      pendingQueueSize: queue.pendingQueueSize,
      batchSizeThreshold: queue.batchSizeThreshold,
      queueLagMs: queue.queueLagMs
    },
    slowQueries: {
      totalSlowQueries: slowQueries.totalSlowQueries,
      recentLogsCount: slowQueries.recentLogs.length
    },
    generatedAt: new Date().toISOString()
  };
}
