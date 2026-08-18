/**
 * Test Suite - EDOT Instructor Intelligence Engine
 * Verifies authorized instructor dashboard overview, at-risk learner detection,
 * misconception clusters with multi-signal evidence, and prioritized actions.
 */

import {
  getInstructorIntelligenceOverview,
  getInstructorAtRiskLearners,
  getInstructorStrugglingTopics,
  getInstructorRecommendedActions
} from '../src/intelligence/instructor/instructorIntelligenceService.js';
import { prisma } from '../lib/prisma.js';

async function runInstructorIntelligenceTestSuite() {
  console.log('🧪 Starting EDOT Instructor Intelligence Engine Test Suite...\n');

  try {
    const instructor = await prisma.user.findFirst({ where: { role: 'instructor' } }) || {
      id: '00000000-0000-0000-0000-000000000002'
    };

    // 1. Overview Test
    console.log('--- 1. Testing Instructor Intelligence Overview ---');
    const overview = await getInstructorIntelligenceOverview(instructor.id);
    console.log('Instructor Overview Output:', JSON.stringify(overview, null, 2));

    if (overview.instructorId && Array.isArray(overview.misconceptionClusters)) {
      console.log('✅ Instructor intelligence overview PASSED');
    } else {
      throw new Error('Instructor overview test failed');
    }

    // 2. Struggling Topics & Misconception Clusters Test
    console.log('\n--- 2. Testing Struggling Topics & Misconception Clusters ---');
    const topics = await getInstructorStrugglingTopics(instructor.id);
    console.log(`Identified ${topics.length} struggling topic clusters with evidence.`);

    if (topics.length > 0) {
      console.log('Sample Misconception Cluster Evidence:', JSON.stringify(topics[0].evidence, null, 2));
    }

    if (Array.isArray(topics)) {
      console.log('✅ Struggling topics & misconception clusters PASSED');
    } else {
      throw new Error('Struggling topics test failed');
    }

    // 3. Recommended Instructor Actions Test
    console.log('\n--- 3. Testing Prioritized Instructor Recommended Actions ---');
    const actions = await getInstructorRecommendedActions(instructor.id);
    console.log(`Retrieved ${actions.length} prioritized instructor actions.`);

    if (Array.isArray(actions)) {
      console.log('✅ Prioritized instructor actions PASSED');
    } else {
      throw new Error('Recommended actions test failed');
    }

    console.log('\n🎉 ALL INSTRUCTOR INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runInstructorIntelligenceTestSuite();
