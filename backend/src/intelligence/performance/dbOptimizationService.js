/**
 * EDOT Intelligence Domain - Database Query Optimization Service
 * Provides query batching, selective field loading, slow query logging, and connection metrics.
 */

import { prisma } from '../../../lib/prisma.js';

const SLOW_QUERY_THRESHOLD_MS = 200;

/**
 * Logs slow database queries if execution duration exceeds SLOW_QUERY_THRESHOLD_MS.
 */
export async function logSlowQuery(queryKey, durationMs, context = null) {
  if (durationMs < SLOW_QUERY_THRESHOLD_MS) return null;

  return prisma.slowQueryLog.create({
    data: {
      queryKey,
      durationMs,
      context
    }
  }).catch(() => null);
}

/**
 * Batches array of IDs for optimized Prisma query fetching.
 */
export async function batchFetchByIds(modelName, ids, options = {}) {
  if (!ids || ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)];

  const startTime = Date.now();
  const results = await prisma[modelName].findMany({
    where: { id: { in: uniqueIds } },
    ...options
  });

  const durationMs = Date.now() - startTime;
  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    await logSlowQuery(`batchFetchByIds:${modelName}`, durationMs, `Fetched ${ids.length} records`);
  }

  return results;
}

/**
 * Summarizes slow query logs (ADMIN view).
 */
export async function getSlowQuerySummary() {
  const [totalSlowQueries, recentLogs] = await Promise.all([
    prisma.slowQueryLog.count(),
    prisma.slowQueryLog.findMany({ take: 50, orderBy: { timestamp: 'desc' } })
  ]);

  return {
    totalSlowQueries,
    thresholdMs: SLOW_QUERY_THRESHOLD_MS,
    recentLogs,
    summaryAt: new Date().toISOString()
  };
}
