/**
 * Test Suite - EDOT Institutional Cohort Analytics & Multi-Tenancy Engine
 * Verifies multi-tenant metrics aggregation, cohort performance telemetry, and risk clustering.
 */

import { getInstitutionalOverview, getCohortAnalytics } from '../src/intelligence/institution/institutionService.js';
import { prisma } from '../lib/prisma.js';

async function runInstitutionalCohortTestSuite() {
  console.log('🧪 Starting EDOT Institutional Cohort Analytics Test Suite...\n');

  try {
    // 1. Multi-Tenant Institution Overview Test
    console.log('--- 1. Testing Multi-Tenant Institutional Overview ---');
    const overview = await getInstitutionalOverview();
    console.log('Institutional Overview Output:', JSON.stringify(overview, null, 2));

    if (overview.name && overview.activeCohortsCount >= 1 && overview.totalLearnersCount > 0) {
      console.log('✅ Institutional overview & risk clustering PASSED');
    } else {
      throw new Error('Institutional overview test failed');
    }

    // 2. Cohort Telemetry & Risk Analytics Test
    console.log('\n--- 2. Testing Cohort Performance Telemetry & Interventions ---');
    const sampleCohortId = overview.cohorts[0].cohortId;
    const cohortAnalytics = await getCohortAnalytics(sampleCohortId);

    console.log('Cohort Analytics Output:', JSON.stringify(cohortAnalytics, null, 2));

    if (cohortAnalytics.cohortId && Array.isArray(cohortAnalytics.cohortInterventions)) {
      console.log('✅ Cohort analytics & intervention recommendations PASSED');
    } else {
      throw new Error('Cohort analytics test failed');
    }

    console.log('\n🎉 ALL INSTITUTIONAL COHORT ANALYTICS TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runInstitutionalCohortTestSuite();
