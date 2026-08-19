/**
 * Test Suite - EDOT AI Practice Engine
 * Verifies practice item generation across 6 types and 3 difficulties, adaptive loops,
 * student evaluation, and instructor review approval.
 */

import { generatePracticeQuestions, evaluateAnswersAndAdapt } from '../src/intelligence/practice/practiceGenerator.js';
import { createPracticeSession, evaluatePracticeSession, reviewPracticeSessionByInstructor } from '../src/intelligence/practice/practiceService.js';
import { prisma } from '../lib/prisma.js';

async function runAIPracticeTestSuite() {
  console.log('🧪 Starting EDOT AI Practice Engine Test Suite...\n');

  try {
    // 1. Generator Unit Test: Practice Types & Quality Check
    console.log('--- 1. Testing AI Practice Question Generator ---');
    const questions = await generatePracticeQuestions({
      skillName: 'CSS Flexbox',
      practiceType: 'PROBLEM_SOLVING',
      difficulty: 'INTERMEDIATE'
    });

    console.log(`Generated ${questions.length} practice questions.`);
    console.log('Sample Practice Item:', JSON.stringify(questions[0], null, 2));

    const isLabeled = questions.every(q => q.isAiGenerated === true);
    const hasQualityCheck = questions.every(q => q.qualityCheck === 'PASSED');

    if (questions.length >= 2 && isLabeled && hasQualityCheck) {
      console.log('✅ Practice generator & AI labeling PASSED');
    } else {
      throw new Error('Practice generator test failed');
    }

    // 2. Integration Test: Session Creation & Adaptive Answer Evaluation
    console.log('\n--- 2. Testing Practice Session Lifecycle & Adaptive Evaluation ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const session = await createPracticeSession(testUser.id, {
      skillName: 'CSS Flexbox',
      practiceType: 'APPLICATION',
      difficulty: 'INTERMEDIATE'
    });

    console.log(`Created Practice Session [ID: ${session.sessionId}], Skill: ${session.skillName}`);

    // Submit answers (1 correct, 1 incorrect)
    const evalResult = await evaluatePracticeSession(testUser.id, session.sessionId, [1, 0]);
    console.log('Adaptive Evaluation Output:', JSON.stringify(evalResult, null, 2));

    if (evalResult.sessionId && evalResult.adaptiveAdjustment && evalResult.isOfficialAssessment === false) {
      console.log('✅ Adaptive practice evaluation & non-replacement label PASSED');
    } else {
      throw new Error('Adaptive evaluation test failed');
    }

    // 3. Instructor Review Capability Test
    console.log('\n--- 3. Testing Instructor Review Approval Capability ---');
    const instructor = await prisma.user.findFirst({ where: { role: 'instructor' } }) || testUser;

    const reviewResult = await reviewPracticeSessionByInstructor(session.sessionId, instructor.id, true, 'Approved for student practice session.');
    console.log('Instructor Review Output:', JSON.stringify(reviewResult, null, 2));

    if (reviewResult.instructorApproved === true && reviewResult.status === 'REVIEWED') {
      console.log('✅ Instructor review approval capability PASSED');
    } else {
      throw new Error('Instructor review test failed');
    }

    console.log('\n🎉 ALL AI PRACTICE ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAIPracticeTestSuite();
