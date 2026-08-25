/**
 * EDOT Intelligence Domain - Production Launch Master Orchestrator
 * Coordinates production readiness audits, AI usage & cost governance, feature flag rollout,
 * global error contracts, and operational admin health views.
 */

import { evaluateProductionReadiness } from './productionReadinessService.js';
import { recordAiUsage, getAiGovernanceSummary } from './aiUsageGovernanceService.js';
import { getFeatureFlagState, setFeatureFlagState, getAllFeatureFlags } from './featureFlagService.js';
import { formatStandardError, globalErrorContractMiddleware } from './globalErrorContract.js';

export {
  evaluateProductionReadiness,
  recordAiUsage,
  getAiGovernanceSummary,
  getFeatureFlagState,
  setFeatureFlagState,
  getAllFeatureFlags,
  formatStandardError,
  globalErrorContractMiddleware
};

/**
 * Returns Master Production Launch & Governance Overview.
 */
export async function getProductionLaunchOverview() {
  const [readiness, governance, flags] = await Promise.all([
    evaluateProductionReadiness(),
    Promise.resolve(getAiGovernanceSummary()),
    Promise.resolve(getAllFeatureFlags())
  ]);

  return {
    readinessStatus: readiness.status,
    checks: readiness.checks,
    criticalChecksCount: readiness.criticalChecks.length,
    warningsCount: readiness.warnings.length,
    aiGovernance: {
      totalRequests: governance.totalAiRequests,
      failureRatePercent: governance.failureRatePercent
    },
    featureFlags: flags,
    generatedAt: new Date().toISOString()
  };
}
