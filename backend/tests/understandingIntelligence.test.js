/**
 * Test Suite - EDOT Understanding & Misconception Intelligence
 * Verifies student natural-language concept analysis, misconception detection, and clarification guidance.
 */

import { evaluateLearnerExplanation } from '../src/intelligence/understanding/understandingEvaluator.js';
import { analyzeConceptExplanation, getUserUnderstandingHistory } from '../src/intelligence/understanding/understandingService.js';
import { prisma } from '../lib/prisma.js';

async function runUnderstandingTestSuite() {
  console.log('🧪 Starting EDOT Understanding & Misconception Intelligence Test Suite...\n');

  try {
    // 1. Evaluator Unit Test: Flexbox Explanation Scenario
    console.log('--- 1. Testing Flexbox Concept Explanation Evaluation ---');
    const explanation = 'I understand Flexbox as a 1D layout engine for distributing space and aligning items along a main axis.';
    const evalResult = evaluateLearnerExplanation('Flexbox Layout Engine', explanation);

    console.log('Flexbox Evaluation Output:', JSON.stringify(evalResult, null, 2));

    const hasSingleAxis = evalResult.correctConcepts.includes('Single-Axis (1D) Layout Container');
    const hasConfidence = evalResult.confidence >= 0.8;

    if (hasSingleAxis && hasConfidence && evalResult.recommendedExplanation) {
      console.log('✅ Flexbox explanation evaluation & grounded clarification PASSED');
    } else {
      throw new Error('Flexbox explanation evaluation failed');
    }

    // 2. Integration Test: DB Persistence & History Retrieval
    console.log('\n--- 2. Testing DB Persistence & History Retrieval ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const savedAnalysis = await analyzeConceptExplanation(testUser.id, 'Flexbox Layout Engine', explanation);
    console.log(`Saved Concept Analysis Record [ID: ${savedAnalysis.id}], Concept: ${savedAnalysis.conceptName}`);

    const history = await getUserUnderstandingHistory(testUser.id);
    console.log(`Retrieved ${history.length} historical concept analysis items for user ${testUser.id}.`);

    if (savedAnalysis.id && history.length >= 1) {
      console.log('✅ DB persistence & historical evaluation retrieval PASSED');
    } else {
      throw new Error('DB persistence test failed');
    }

    console.log('\n🎉 ALL UNDERSTANDING & MISCONCEPTION INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runUnderstandingTestSuite();
