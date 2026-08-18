/**
 * Test Suite - EDOT Recommendation & Next Best Action Engine
 */

import { generateHybridRecommendations, resolveNextBestAction, RecommendationTypes } from '../src/intelligence/recommendations/recommendationEngine.js';
import { getLearnerRecommendations, getNextBestAction, dismissRecommendation, completeRecommendation } from '../src/intelligence/recommendations/recommendationService.js';
import { prisma } from '../lib/prisma.js';

async function runRecommendationTestSuite() {
  console.log('🧪 Starting EDOT Recommendation Engine Test Suite...\n');

  try {
    // 1. Unit Test: Hybrid Recommendation Engine Rules & Explainability
    console.log('--- 1. Testing Hybrid Recommendation Engine Rules & Explainability ---');

    const mockQuizAttempts = [
      { isCorrect: false, topic: 'JavaScript Functions' },
      { isCorrect: false, topic: 'JavaScript Functions' },
      { isCorrect: false, topic: 'JavaScript Functions' }
    ];
    const mockWeaknesses = [{ topic: 'JavaScript Functions' }];
    const mockProfile = { weeklyStudyHours: 38, completedCourses: 2 };

    const candidates = generateHybridRecommendations({
      userProgress: [],
      quizAttempts: mockQuizAttempts,
      weaknesses: mockWeaknesses,
      profile: mockProfile,
      pastRecommendations: []
    });

    console.log('Generated Candidates Count:', candidates.length);
    console.log('Top Candidate Sample Output:', JSON.stringify(candidates[0], null, 2));

    const hasRestRecovery = candidates.some(c => c.recommendationType === RecommendationTypes.REST_RECOVERY);
    const hasInstructorSupport = candidates.some(c => c.recommendationType === RecommendationTypes.INSTRUCTOR_SUPPORT);
    const hasRevision = candidates.some(c => c.recommendationType === RecommendationTypes.REVISION);

    if (hasRestRecovery && hasInstructorSupport && hasRevision) {
      console.log('✅ Rule layer triggering PASSED');
    } else {
      throw new Error('Rule layer failed to trigger expected recommendations');
    }

    if (candidates[0].reason && candidates[0].evidence) {
      console.log('✅ Explainability & evidence tracing PASSED');
    } else {
      throw new Error('Explainability or evidence missing');
    }

    // 2. Unit Test: Next Best Action Resolver (Exactly 1 Primary Action)
    console.log('\n--- 2. Testing Next Best Action Resolver ---');
    const nba = resolveNextBestAction(candidates);
    console.log('Next Best Action DTO:', JSON.stringify(nba, null, 2));

    if (nba.primaryAction && Array.isArray(nba.secondaryActions)) {
      console.log('✅ Next Best Action Resolver PASSED');
    } else {
      throw new Error('Next Best Action resolution failed');
    }

    // 3. Integration Test: Database Persistence & Feedback Loop
    console.log('\n--- 3. Testing Database Persistence & Feedback Loop ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const learnerRecs = await getLearnerRecommendations(testUser.id);
    console.log(`Fetched ${learnerRecs.length} active recommendations for user ${testUser.id}.`);

    const userNba = await getNextBestAction(testUser.id);
    console.log(`User Next Best Action Primary Type: ${userNba.primaryAction?.recommendationType}`);

    if (learnerRecs.length > 0) {
      const targetId = learnerRecs[0].id;
      const dismissed = await dismissRecommendation(testUser.id, targetId);
      console.log(`Dismissed recommendation [${targetId}]: status = ${dismissed.status}`);
      console.log('✅ Feedback loop (dismissal) PASSED');
    }

    console.log('\n🎉 ALL RECOMMENDATION & NEXT ACTION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRecommendationTestSuite();
