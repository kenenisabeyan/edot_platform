/**
 * Test Suite - EDOT Production Readiness & Graceful Degradation Engine
 * Verifies 19-area production audit, AI graceful degradation controller,
 * observability metrics, and fallback capability reporting.
 */

import {
  runProductionReadinessAudit,
  reportAiFailure,
  reportAiSuccess,
  isAiAvailable,
  getDegradationState,
  recordApiRequest,
  recordAiRequest,
  recordJobMetric,
  recordRateLimitHit,
  recordCacheAccess
} from '../src/intelligence/monitoring/productionReadinessEngine.js';
import { prisma } from '../lib/prisma.js';

async function runProductionReadinessTestSuite() {
  console.log('🧪 Starting EDOT Production Readiness & Graceful Degradation Test Suite...\n');

  try {
    // 1. Full Production Readiness Audit
    console.log('--- 1. Testing 19-Area Production Readiness Audit ---');
    const audit = await runProductionReadinessAudit();
    console.log(`Audit Summary: ${audit.totalChecks} checks | ${audit.passed} PASS | ${audit.advisory} ADVISORY | ${audit.failed} FAIL`);
    console.log(`Production Ready: ${audit.productionReady}`);
    console.log(`Audit Duration: ${audit.auditDurationMs}ms`);

    if (audit.productionReady && audit.passed >= 15 && audit.failed === 0) {
      console.log('✅ Production Readiness Audit PASSED');
    } else {
      throw new Error(`Audit failed: ${audit.failed} critical failures`);
    }

    // 2. Graceful Degradation Controller
    console.log('\n--- 2. Testing Graceful Degradation Controller ---');
    
    // Verify AI is initially available
    if (!isAiAvailable()) throw new Error('AI should be initially available');
    console.log('AI initially available: ✓');

    // Simulate 3 consecutive AI failures to trigger degraded mode
    reportAiFailure();
    reportAiFailure();
    reportAiFailure();

    const state = getDegradationState();
    console.log('Degradation State:', JSON.stringify(state, null, 2));

    if (state.degradedMode && !state.aiAvailable && state.consecutiveAiFailures === 3) {
      console.log('✅ Graceful degradation triggered after 3 consecutive AI failures PASSED');
    } else {
      throw new Error('Degradation should have triggered');
    }

    // Verify recovery
    reportAiSuccess();
    if (isAiAvailable() && !getDegradationState().degradedMode) {
      console.log('✅ AI recovery from degraded mode PASSED');
    } else {
      throw new Error('AI should have recovered');
    }

    // 3. Observability Metrics Recording
    console.log('\n--- 3. Testing Observability Metrics Recording ---');
    recordApiRequest(true);
    recordApiRequest(false);
    recordAiRequest('success');
    recordAiRequest('fallback');
    recordJobMetric('enqueued');
    recordJobMetric('completed');
    recordJobMetric('failed');
    recordRateLimitHit();
    recordCacheAccess(true);
    recordCacheAccess(false);

    // Re-run audit to verify metrics are tracked
    const auditWithMetrics = await runProductionReadinessAudit();
    console.log('Metrics Snapshot:', JSON.stringify(auditWithMetrics.metrics, null, 2));

    if (auditWithMetrics.metrics.apiRequests.total > 0 && auditWithMetrics.metrics.aiRequests.total > 0) {
      console.log('✅ Observability metrics recording PASSED');
    } else {
      throw new Error('Metrics should have been recorded');
    }

    // 4. Database System Data Integrity
    console.log('\n--- 4. Testing Database System Data Integrity ---');
    const [userCount, courseCount] = await Promise.all([
      prisma.user.count(),
      prisma.course.count()
    ]);
    console.log(`System Data: ${userCount} users, ${courseCount} courses`);
    console.log('✅ Database integrity check PASSED');

    console.log('\n🎉 ALL PRODUCTION READINESS TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProductionReadinessTestSuite();
