/**
 * Test Suite - EDOT Dynamic Career Intelligence & Skill Gap Analyzer
 * Verifies career path seeding, learner gap analysis, readiness score calculation, and learning roadmaps.
 */

import { getAvailableCareerPaths, getLearnerCareerGapAnalysis, getUserCareerTargets } from '../src/intelligence/career/careerService.js';
import { prisma } from '../lib/prisma.js';

async function runCareerIntelligenceTestSuite() {
  console.log('🧪 Starting EDOT Dynamic Career Intelligence Test Suite...\n');

  try {
    // 1. Career Path Catalog & Seeding Test
    console.log('--- 1. Testing Career Path Seeding & Catalog ---');
    const paths = await getAvailableCareerPaths();
    console.log(`Retrieved ${paths.length} career paths.`);
    console.log('Sample Path:', JSON.stringify(paths[0], null, 2));

    if (paths.length >= 3 && paths[0].title) {
      console.log('✅ Career path catalog & seeding PASSED');
    } else {
      throw new Error('Career path catalog test failed');
    }

    // 2. Learner Skill Gap Analysis Test
    console.log('\n--- 2. Testing Learner Skill Gap Analysis & Readiness Score ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const targetPath = paths.find(p => p.title.includes('Full-Stack')) || paths[0];
    const gapAnalysis = await getLearnerCareerGapAnalysis(testUser.id, targetPath.id);

    console.log('Learner Career Gap Analysis Output:', JSON.stringify(gapAnalysis, null, 2));

    if (gapAnalysis.readinessScore > 0 && Array.isArray(gapAnalysis.roadmapSteps)) {
      console.log('✅ Skill gap analysis & readiness score PASSED');
    } else {
      throw new Error('Skill gap analysis test failed');
    }

    // 3. User Active Career Target Retrieval
    console.log('\n--- 3. Testing User Active Career Target Retrieval ---');
    const userTarget = await getUserCareerTargets(testUser.id);
    console.log(`Active Target for ${testUser.id}: ${userTarget.careerTitle}, Readiness: ${userTarget.readinessScore}%`);

    if (userTarget.careerTitle) {
      console.log('✅ User active career target retrieval PASSED');
    } else {
      throw new Error('User active career target test failed');
    }

    console.log('\n🎉 ALL DYNAMIC CAREER INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCareerIntelligenceTestSuite();
