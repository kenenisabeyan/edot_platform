/**
 * EDOT Intelligence Domain - Observability & Telemetry Metrics Service
 * Computes real-time latency percentiles (p50, p95, p99), API throughput, error rates,
 * and system health status (HEALTHY, DEGRADED, CRITICAL).
 */

import { prisma } from '../../../lib/prisma.js';

const latencyBuffer = [];
const BUFFER_MAX = 500;
let totalApiCalls = 0;
let totalApiErrors = 0;

/**
 * Records an API call latency in milliseconds.
 */
export function recordLatencyMs(durationMs) {
  latencyBuffer.push(durationMs);
  if (latencyBuffer.length > BUFFER_MAX) {
    latencyBuffer.shift();
  }
  totalApiCalls++;
}

/**
 * Records an API error.
 */
export function recordApiError() {
  totalApiErrors++;
}

/**
 * Computes percentile latency (p50, p95, p99).
 */
export function getLatencyPercentiles() {
  if (latencyBuffer.length === 0) {
    return { p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencyBuffer].sort((a, b) => a - b);
  const p50Index = Math.floor(sorted.length * 0.5);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    p50: sorted[p50Index] || 0,
    p95: sorted[p95Index] || 0,
    p99: sorted[p99Index] || 0
  };
}

/**
 * Calculates current system performance health state.
 */
export async function getSystemPerformanceHealth() {
  const percentiles = getLatencyPercentiles();
  const errorRatePercent = totalApiCalls > 0 ? Math.round((totalApiErrors / totalApiCalls) * 100) : 0;

  let healthState = 'HEALTHY';
  if (percentiles.p95 > 1000 || errorRatePercent >= 10) {
    healthState = 'CRITICAL';
  } else if (percentiles.p95 > 500 || errorRatePercent >= 5) {
    healthState = 'DEGRADED';
  }

  // Persist p95 latency metric snapshot asynchronously
  prisma.performanceMetric.create({
    data: {
      metricName: 'LATENCY_P95',
      metricValue: percentiles.p95,
      unit: 'ms'
    }
  }).catch(() => {});

  return {
    healthState,
    totalApiCalls,
    totalApiErrors,
    errorRatePercent,
    latencyPercentiles: percentiles,
    evaluatedAt: new Date().toISOString()
  };
}
