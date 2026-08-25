/**
 * EDOT Intelligence Domain - AI Usage & Cost Governance Service
 * Tracks AI request metrics, provider errors, latency, and feature usage without storing raw prompts or private text.
 */

const usageStore = new Map();
let totalAiRequests = 0;
let totalAiFailures = 0;

/**
 * Records an AI usage event for cost and abuse governance.
 */
export function recordAiUsage(featureName, provider = 'DEFAULT_PROVIDER', latencyMs = 200, isSuccess = true) {
  totalAiRequests++;
  if (!isSuccess) totalAiFailures++;

  const key = `${featureName}:${provider}`;
  const record = usageStore.get(key) || { requests: 0, failures: 0, totalLatencyMs: 0 };

  record.requests++;
  if (!isSuccess) record.failures++;
  record.totalLatencyMs += latencyMs;

  usageStore.set(key, record);
}

/**
 * Returns AI Usage & Governance summary (Admin view).
 */
export function getAiGovernanceSummary() {
  const breakdown = [];
  for (const [key, val] of usageStore.entries()) {
    const [feature, provider] = key.split(':');
    const avgLatencyMs = val.requests > 0 ? Math.round(val.totalLatencyMs / val.requests) : 0;
    breakdown.push({
      feature,
      provider,
      requests: val.requests,
      failures: val.failures,
      avgLatencyMs
    });
  }

  const failureRatePercent = totalAiRequests > 0 ? Math.round((totalAiFailures / totalAiRequests) * 100) : 0;

  return {
    totalAiRequests,
    totalAiFailures,
    failureRatePercent,
    featureBreakdown: breakdown,
    calculatedAt: new Date().toISOString()
  };
}
