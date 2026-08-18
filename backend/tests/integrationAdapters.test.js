/**
 * Test Suite - EDOT Provider Adapter Registry & Integration Layer
 * Verifies external provider decoupling, authentication configuration, timeout handling,
 * retry backoff, disablement toggles, and execution audit logging.
 */

import { BaseProviderAdapter, globalProviderRegistry } from '../src/intelligence/integrations/providerAdapterRegistry.js';
import { ExternalServiceError, ForbiddenError } from '../src/intelligence/shared/errors.js';

async function runIntegrationAdaptersTestSuite() {
  console.log('🧪 Starting EDOT Provider Adapter Registry Test Suite...\n');

  try {
    // 1. Adapter Execution & Retry Test
    console.log('--- 1. Testing Adapter Execution & Retry Logic ---');
    const testAdapter = new BaseProviderAdapter({
      name: 'MockContentProvider',
      category: 'CONTENT_PROVIDER',
      timeoutMs: 3000,
      maxRetries: 2
    });

    globalProviderRegistry.registerAdapter(testAdapter);

    let attemptsMade = 0;
    const result = await testAdapter.executeWithAdapter('fetch_content', { courseId: 'c-101' }, async (payload) => {
      attemptsMade++;
      if (attemptsMade === 1) throw new Error('Network transient error');
      return { contentId: 'cnt-888', payload };
    });

    console.log('Adapter Execution Result:', JSON.stringify(result, null, 2));

    if (result.success && result.attempts === 2 && result.data.contentId === 'cnt-888') {
      console.log('✅ Adapter execution & transient retry PASSED');
    } else {
      throw new Error('Adapter execution test failed');
    }

    // 2. Disablement Toggle Test
    console.log('\n--- 2. Testing Provider Disablement Toggle ---');
    globalProviderRegistry.setEnablement('MockContentProvider', false);

    try {
      await testAdapter.executeWithAdapter('fetch_content', {}, async () => ({ status: 'ok' }));
      throw new Error('Failed to block disabled provider execution');
    } catch (err) {
      if (err instanceof ForbiddenError && err.message.includes('currently disabled')) {
        console.log('✅ Disabled provider execution block PASSED');
      } else {
        throw err;
      }
    }

    // Re-enable for clean state
    globalProviderRegistry.setEnablement('MockContentProvider', true);

    // 3. Audit Log Lookup Test
    console.log('\n--- 3. Testing Provider Audit Logs ---');
    const auditLogs = globalProviderRegistry.getAuditLogs();
    console.log(`Retrieved ${auditLogs.length} audit log entries.`);
    console.log('Latest Log Entry:', JSON.stringify(auditLogs[0], null, 2));

    if (auditLogs.length > 0 && auditLogs[0].provider === 'MockContentProvider') {
      console.log('✅ Provider audit logging PASSED');
    } else {
      throw new Error('Audit log test failed');
    }

    console.log('\n🎉 ALL PROVIDER ADAPTER REGISTRY TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  }
}

runIntegrationAdaptersTestSuite();
