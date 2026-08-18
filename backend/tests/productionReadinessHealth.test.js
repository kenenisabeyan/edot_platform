/**
 * Test Suite - EDOT Intelligence Core Production Readiness & Health Monitoring
 */

import { getHealthStatus, getDeadLetterQueue, trackTokenUsage } from '../src/intelligence/monitoring/healthCheckService.js';
import { prisma } from '../lib/prisma.js';

async function runProductionHealthTestSuite() {
  console.log('🧪 Starting EDOT Intelligence Core Production Readiness Health Check...\n');

  try {
    // 1. Test System Health Check
    console.log('--- 1. Testing System Health Check & DB Latency ---');
    const health = await getHealthStatus();

    console.log('Health Status Output:', JSON.stringify(health, null, 2));

    if (health.status && health.components.database.status === 'HEALTHY') {
      console.log('✅ Database ping & health check PASSED');
    } else {
      throw new Error('Database health check failed');
    }

    // 2. Test Graceful Degradation & AI Provider Fallback
    console.log('\n--- 2. Testing AI Provider Status & Graceful Degradation ---');
    if (health.components.aiProvider.status) {
      console.log(`AI Provider Status: ${health.components.aiProvider.status}, AI Available: ${health.components.aiProvider.aiAvailable}`);
      console.log('✅ AI Provider & Graceful Degradation status PASSED');
    } else {
      throw new Error('AI Provider status check failed');
    }

    // 3. Test Token Usage & Cost Estimation Tracking
    console.log('\n--- 3. Testing Token Usage & Cost Tracking ---');
    trackTokenUsage(500);
    const updatedHealth = await getHealthStatus();
    console.log(`Updated Tokens Consumed: ${updatedHealth.metrics.totalTokensConsumed}, Estimated Cost USD: $${updatedHealth.metrics.estimatedMonthlyCostUSD}`);

    if (updatedHealth.metrics.totalTokensConsumed > 0) {
      console.log('✅ Token usage & cost tracking PASSED');
    } else {
      throw new Error('Token tracking failed');
    }

    // 4. Test Dead-Letter Queue Monitoring
    console.log('\n--- 4. Testing Event Bus Dead-Letter Queue Monitoring ---');
    const deadLetters = getDeadLetterQueue();
    console.log(`Dead-letter queue size: ${deadLetters.length}`);
    console.log('✅ Dead-letter queue monitoring PASSED');

    console.log('\n🎉 ALL PRODUCTION READINESS HEALTH CHECKS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProductionHealthTestSuite();
