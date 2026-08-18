/**
 * Test Suite - EDOT Intelligent Nudges Engine
 * Verifies deterministic signal evaluation, anti-fatigue rate limits (Max 2/day), active retrieval,
 * user dismissal, and helpfulness metrics.
 */

import { evaluateNudgeTriggers } from '../src/intelligence/nudges/nudgeEvaluator.js';
import { evaluateAndGenerateNudges, getUserActiveNudges, dismissNudge, rateNudgeHelpfulness } from '../src/intelligence/nudges/nudgeService.js';
import { prisma } from '../lib/prisma.js';

async function runIntelligentNudgesTestSuite() {
  console.log('🧪 Starting EDOT Intelligent Nudges Engine Test Suite...\n');

  try {
    // 1. Evaluator Unit Test
    console.log('--- 1. Testing Deterministic Signal Evaluator ---');
    const candidates = evaluateNudgeTriggers({
      inactiveDays: 5,
      moduleProgressPct: 88,
      strugglingTopics: ['CSS Grid Template Areas'],
      streakDays: 6,
      skillMastery: 90,
      upcomingDeadlineHours: 24
    });

    console.log(`Generated ${candidates.length} candidate nudges.`);
    console.log('Sample Candidate:', JSON.stringify(candidates[0], null, 2));

    if (candidates.length >= 4 && candidates[0].triggerReason && candidates[0].expiresAt) {
      console.log('✅ Deterministic signal evaluator PASSED');
    } else {
      throw new Error('Nudge evaluator test failed');
    }

    // 2. Integration Test: Anti-Fatigue Rate Limiting & Nudge Generation
    console.log('\n--- 2. Testing Nudge Generation & Anti-Fatigue Rate Controls ---');
    const testStudent = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    // Clear prior test nudges for clean run
    await prisma.intelligentNudge.deleteMany({ where: { userId: testStudent.id } });

    const genResult1 = await evaluateAndGenerateNudges(testStudent.id, {
      inactiveDays: 5,
      strugglingTopics: ['Flexbox Layouts']
    });

    console.log('Nudge Generation Result 1:', JSON.stringify(genResult1, null, 2));

    const genResult2 = await evaluateAndGenerateNudges(testStudent.id, {
      moduleProgressPct: 85,
      streakDays: 7
    });

    console.log('Nudge Generation Result 2 (Anti-Fatigue Rate Control Test):', JSON.stringify(genResult2, null, 2));

    if (genResult1.generatedCount > 0 && genResult2.rateLimited === true) {
      console.log('✅ Anti-fatigue rate limiting (Max 2/day) PASSED');
    } else {
      throw new Error('Anti-fatigue rate limit test failed');
    }

    // 3. Active Nudge Retrieval & Dismissal Test
    console.log('\n--- 3. Testing Active Nudge Retrieval & Dismissal ---');
    const activeNudges = await getUserActiveNudges(testStudent.id);
    console.log(`Retrieved ${activeNudges.length} active nudges.`);

    const targetNudge = activeNudges[0];
    const dismissed = await dismissNudge(targetNudge.nudgeId, testStudent.id);
    console.log('Dismissal Result:', JSON.stringify(dismissed, null, 2));

    const rated = await rateNudgeHelpfulness(targetNudge.nudgeId, testStudent.id, 'HELPFUL');
    console.log('Rating Result:', JSON.stringify(rated, null, 2));

    if (dismissed.status === 'DISMISSED' && rated.helpfulnessRating === 'HELPFUL') {
      console.log('✅ Active nudge retrieval, dismissal, and helpfulness metrics PASSED');
    } else {
      throw new Error('Nudge dismissal test failed');
    }

    console.log('\n🎉 ALL INTELLIGENT NUDGES ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runIntelligentNudgesTestSuite();
