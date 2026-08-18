/**
 * Test Suite - EDOT Intelligence Feedback Loops & Ranking Engine
 * Verifies recording of behavioral feedback signals (SHOWN, ACCEPTED, DISMISSED, HELPFUL, NOT_HELPFUL, OVERRIDE),
 * deterministic affinity offset calculations, item re-ranking, and analytics aggregation.
 */

import { calculateFeedbackAffinityOffset, rankItemsWithFeedback } from '../src/intelligence/feedback/feedbackRankingEngine.js';
import { recordIntelligenceFeedback, getFeedbackAnalyticsSummary, getAdjustedRankingForItems } from '../src/intelligence/feedback/feedbackService.js';
import { prisma } from '../lib/prisma.js';

async function runFeedbackLoopsTestSuite() {
  console.log('🧪 Starting EDOT Intelligence Feedback Loops Test Suite...\n');

  try {
    // 1. Ranking Engine Unit Test
    console.log('--- 1. Testing Deterministic Affinity Offset Calculations ---');
    const positiveHistory = [{ feedbackType: 'ACCEPTED' }, { feedbackType: 'HELPFUL' }];
    const negativeHistory = [{ feedbackType: 'DISMISSED' }, { feedbackType: 'NOT_HELPFUL' }];

    const positiveOffset = calculateFeedbackAffinityOffset(positiveHistory);
    const negativeOffset = calculateFeedbackAffinityOffset(negativeHistory);

    console.log(`Positive Offset: +${positiveOffset}, Negative Offset: ${negativeOffset}`);

    if (positiveOffset > 0 && negativeOffset < 0) {
      console.log('✅ Deterministic affinity offset calculations PASSED');
    } else {
      throw new Error('Affinity offset calculation test failed');
    }

    // 2. Integration Test: Feedback Recording & Re-ranking
    console.log('\n--- 2. Testing Feedback Signal Recording & Item Re-ranking ---');
    const testStudent = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    // Record positive feedback for item-1 and negative feedback for item-2
    await recordIntelligenceFeedback(testStudent.id, {
      domain: 'RECOMMENDATION',
      targetId: 'course-react-101',
      feedbackType: 'HELPFUL',
      reason: 'Great hands-on practice'
    });

    await recordIntelligenceFeedback(testStudent.id, {
      domain: 'RECOMMENDATION',
      targetId: 'course-css-999',
      feedbackType: 'DISMISSED',
      reason: 'Too basic'
    });

    const candidates = [
      { id: 'course-css-999', title: 'Basic CSS Rules', relevanceScore: 0.80 },
      { id: 'course-react-101', title: 'React Hooks Deep Dive', relevanceScore: 0.75 }
    ];

    const reRanked = await getAdjustedRankingForItems(testStudent.id, 'RECOMMENDATION', candidates);
    console.log('Re-ranked Output:', JSON.stringify(reRanked, null, 2));

    if (reRanked[0].id === 'course-react-101' && reRanked[0].adjustedScore > reRanked[1].adjustedScore) {
      console.log('✅ Feedback-aware item re-ranking PASSED');
    } else {
      throw new Error('Item re-ranking test failed');
    }

    // 3. Analytics Aggregation Test
    console.log('\n--- 3. Testing Feedback Analytics Summary ---');
    const summary = await getFeedbackAnalyticsSummary('RECOMMENDATION');
    console.log('Analytics Summary Output:', JSON.stringify(summary, null, 2));

    if (summary.totalFeedbackRecords > 0 && summary.breakdown) {
      console.log('✅ Feedback analytics summary PASSED');
    } else {
      throw new Error('Analytics summary test failed');
    }

    console.log('\n🎉 ALL INTELLIGENCE FEEDBACK LOOPS TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFeedbackLoopsTestSuite();
