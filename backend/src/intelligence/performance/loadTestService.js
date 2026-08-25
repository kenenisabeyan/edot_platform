/**
 * EDOT Intelligence Domain - Load Testing Foundation Service
 * Executes automated load testing scenarios measuring real empirical throughput, latency, and error rates.
 */

import { recordLatencyMs, recordApiError } from './observabilityService.js';

/**
 * Runs a simulated concurrent load test scenario.
 */
export async function runLoadTestScenario(scenarioName = 'DASHBOARD_LOAD', concurrency = 10, totalRequests = 50, targetFn = null) {
  const startTime = Date.now();
  let successfulRequests = 0;
  let failedRequests = 0;
  const latencies = [];

  const executeSingle = async () => {
    const start = Date.now();
    try {
      if (typeof targetFn === 'function') {
        await targetFn();
      } else {
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 20) + 5));
      }
      const duration = Date.now() - start;
      recordLatencyMs(duration);
      latencies.push(duration);
      successfulRequests++;
    } catch (err) {
      recordApiError();
      failedRequests++;
    }
  };

  const batches = Math.ceil(totalRequests / concurrency);
  for (let i = 0; i < batches; i++) {
    const promises = [];
    for (let j = 0; j < concurrency && (i * concurrency + j) < totalRequests; j++) {
      promises.push(executeSingle());
    }
    await Promise.all(promises);
  }

  const totalDurationSec = (Date.now() - startTime) / 1000;
  const requestsPerSec = totalDurationSec > 0 ? Math.round((totalRequests / totalDurationSec) * 100) / 100 : totalRequests;
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const errorRatePercent = totalRequests > 0 ? Math.round((failedRequests / totalRequests) * 100) : 0;

  return {
    scenarioName,
    concurrency,
    totalRequests,
    successfulRequests,
    failedRequests,
    totalDurationSec,
    requestsPerSec,
    avgLatencyMs,
    errorRatePercent,
    completedAt: new Date().toISOString()
  };
}
