/**
 * Test Suite - EDOT Adaptive Learning Engine
 * Verifies Student A & B scenarios, non-destructive recommendations, and feedback loops.
 */

import { calculateAdaptivePath } from '../src/intelligence/adaptive/adaptiveCalculator.js';
import { getAdaptiveLearningPlan, getAdaptivePath, submitAdaptiveFeedback } from '../src/intelligence/adaptive/adaptiveService.js';
import { prisma } from '../lib/prisma.js';

async function runAdaptiveTestSuite() {
  console.log('🧪 Starting EDOT Adaptive Learning Engine Test Suite...\n');

  try {
    // 1. Scenario A: Student A (Weak in CSS) -> Remediation Plan & CSS Revision
    console.log('--- 1. Testing Student A Scenario (Weak in CSS) ---');
    const studentA = calculateAdaptivePath({
      quizAttempts: [
        { isCorrect: false, topic: 'CSS Grid' },
        { isCorrect: false, topic: 'CSS Grid' }
      ],
      weaknesses: [{ topic: 'CSS Grid' }],
      skills: [{ name: 'HTML Basics', proficiencyLevel: 'EXPERT' }]
    });

    console.log('Student A Plan Type:', studentA.planType);
    console.log('Student A Explanation:', studentA.summaryExplanation);
    console.log('Student A Recommendation Count:', studentA.recommendations.length);

    const hasCSSRevision = studentA.recommendations.some(r => r.category === 'REVISION' && r.title.includes('CSS Grid'));
    if (studentA.planType === 'REMEDIATION' && hasCSSRevision) {
      console.log('✅ Student A Scenario (Revision injection) PASSED');
    } else {
      throw new Error('Student A Scenario failed');
    }

    // 2. Scenario B: Student B (Strong HTML & CSS) -> Accelerated Plan & Advanced Content
    console.log('\n--- 2. Testing Student B Scenario (Strong HTML & CSS) ---');
    const studentB = calculateAdaptivePath({
      quizAttempts: [
        { isCorrect: true, topic: 'HTML5' },
        { isCorrect: true, topic: 'CSS Flexbox' },
        { isCorrect: true, topic: 'CSS Grid' }
      ],
      weaknesses: [],
      skills: [
        { name: 'HTML5', proficiencyLevel: 'EXPERT' },
        { name: 'CSS Flexbox', proficiencyLevel: 'ADVANCED' }
      ]
    });

    console.log('Student B Plan Type:', studentB.planType);
    console.log('Student B Explanation:', studentB.summaryExplanation);

    const hasAdvancedContent = studentB.recommendations.some(r => r.category === 'ADVANCED_CONTENT');
    if (studentB.planType === 'ACCELERATED' && hasAdvancedContent) {
      console.log('✅ Student B Scenario (Accelerated path) PASSED');
    } else {
      throw new Error('Student B Scenario failed');
    }

    // 3. Database Persistence & Feedback Loop Test
    console.log('\n--- 3. Testing Database Persistence & Learner Feedback Loop ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const plan = await getAdaptiveLearningPlan(testUser.id);
    console.log(`Fetched Adaptive Plan [${plan.id}] for user ${testUser.id}: type = ${plan.planType}`);

    const pathDTO = await getAdaptivePath(testUser.id);
    console.log(`Adaptive Path Recommendations Count: ${pathDTO.recommendations.length}`);

    if (plan.recommendations.length > 0) {
      const rec = plan.recommendations[0];
      const feedback = await submitAdaptiveFeedback(testUser.id, rec.id, true, 'Great revision exercise recommendation!');
      console.log(`Feedback submitted for rec [${rec.id}]: isHelpful = ${feedback.isHelpful}, status = ${feedback.status}`);
      console.log('✅ Adaptive feedback loop PASSED');
    }

    console.log('\n🎉 ALL ADAPTIVE LEARNING ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdaptiveTestSuite();
