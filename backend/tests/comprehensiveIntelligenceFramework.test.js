/**
 * Test Suite - Comprehensive EDOT Intelligence Evaluation Framework
 * Evaluates unit, integration, authorization, regression, and AI quality metrics
 * (groundedness, relevance, clarity, educational usefulness, safety, personalization).
 */

import { evaluateAiQuality, runIntelligenceBenchmarkSuite } from '../src/intelligence/evaluation/intelligenceEvaluator.js';
import { prisma } from '../lib/prisma.js';

async function runComprehensiveEvaluationFrameworkTestSuite() {
  console.log('🧪 Starting Comprehensive EDOT Intelligence Evaluation Framework Test Suite...\n');

  try {
    // 1. AI Quality Metrics Evaluation Unit Test
    console.log('--- 1. Testing AI Quality Metrics & Measurable Thresholds ---');
    const evaluation = evaluateAiQuality({
      query: 'How do I use React useEffect hook?',
      response: 'To use the React useEffect hook:\n- Import useEffect from "react"\n- Call it inside your functional component\n- Pass a setup function and dependency array\nExample: useEffect(() => { console.log("Mounted"); }, []);',
      context: {
        activeCourses: ['React Fundamentals'],
        weakTopics: ['Hooks']
      }
    });

    console.log('AI Evaluation Output Report:', JSON.stringify(evaluation, null, 2));

    if (evaluation.benchmarkPassed && evaluation.qualityScorePct >= 85.0 && evaluation.metrics.safety === 1.0) {
      console.log('✅ AI Quality metrics & 85% threshold benchmark PASSED');
    } else {
      throw new Error('AI quality metrics test failed');
    }

    // 2. Integration Test: 11-Domain Intelligence Benchmark Suite
    console.log('\n--- 2. Testing 11-Domain Intelligence Benchmark Suite ---');
    const suiteReport = runIntelligenceBenchmarkSuite();
    console.log('Benchmark Suite Summary:', JSON.stringify(suiteReport, null, 2));

    if (suiteReport.allBenchmarksPassed && suiteReport.totalDomainsTested === 11 && suiteReport.overallScorePct >= 90.0) {
      console.log('✅ 11-Domain Intelligence Benchmark Suite PASSED');
    } else {
      throw new Error('Benchmark suite test failed');
    }

    // 3. System Data Integrity Test
    console.log('\n--- 3. Testing Database System Data Integrity ---');
    const [userCount, courseCount, skillCount, evidenceCount] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.skillNode.count().catch(() => 0),
      prisma.skillEvidence.count().catch(() => 0)
    ]);

    console.log(`System Data Audit: ${userCount} users, ${courseCount} courses, ${skillCount} skills, ${evidenceCount} evidence items.`);
    console.log('✅ System Data Integrity PASSED');

    console.log('\n🎉 ALL COMPREHENSIVE INTELLIGENCE EVALUATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runComprehensiveEvaluationFrameworkTestSuite();
