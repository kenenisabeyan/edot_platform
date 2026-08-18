/**
 * Test Suite - EDOT Assessment Intelligence Engine
 * Verifies empirical assessment response evaluation, skill performance mapping,
 * learner reports, and instructor quality telemetry.
 */

import { analyzeAssessmentData } from '../src/intelligence/assessment/assessmentAnalyzer.js';
import { analyzeAssessmentSubmission, getLearnerAssessmentReport, getInstructorAssessmentIntelligence } from '../src/intelligence/assessment/assessmentService.js';
import { prisma } from '../lib/prisma.js';

async function runAssessmentTestSuite() {
  console.log('🧪 Starting EDOT Assessment Intelligence Engine Test Suite...\n');

  try {
    // 1. Analyzer Unit Test: Skill & Telemetry Analysis
    console.log('--- 1. Testing Empirical Assessment Response Analysis ---');
    const submission = {
      quizId: 'quiz-css-flexbox',
      assessmentId: 'assess-101',
      score: 80,
      itemResponses: [
        { questionId: 'q1', prompt: 'What is flex-direction?', skillName: 'CSS Flexbox', isCorrect: true },
        { questionId: 'q2', prompt: 'How to align items on main axis?', skillName: 'CSS Flexbox', isCorrect: true },
        { questionId: 'q3', prompt: 'Difference between flex and grid?', skillName: 'CSS Grid', isCorrect: false, misconceptionTag: 'Confusing 1D Flexbox with 2D Grid' }
      ]
    };

    const analysis = analyzeAssessmentData(submission);
    console.log('Assessment Analysis Output:', JSON.stringify(analysis.learnerReport, null, 2));

    const hasStrengths = analysis.learnerReport.strengths.some(s => s.skill === 'CSS Flexbox');
    const hasWeakness = analysis.learnerReport.weaknesses.some(w => w.skill === 'CSS Grid');

    if (hasStrengths && hasWeakness && analysis.learnerReport.improvementPlan) {
      console.log('✅ Empirical assessment response & skill mapping PASSED');
    } else {
      throw new Error('Empirical assessment analysis failed');
    }

    // 2. Integration Test: Submission DB Persistence & Learner Report
    console.log('\n--- 2. Testing Submission DB Persistence & Learner Report ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const savedResult = await analyzeAssessmentSubmission(testUser.id, submission);
    console.log(`Saved Assessment Insight [ID: ${savedResult.id}], Score: ${savedResult.score}%`);

    const report = await getLearnerAssessmentReport(testUser.id, submission.assessmentId);
    console.log(`Retrieved Learner Report for assessment ${report.assessmentId}, Reassessment Readiness: ${report.reassessmentReadiness}`);

    if (savedResult.id && report.masteryScore > 0) {
      console.log('✅ Submission DB persistence & learner report retrieval PASSED');
    } else {
      throw new Error('Submission DB persistence failed');
    }

    // 3. Instructor Telemetry Retrieval
    console.log('\n--- 3. Testing Instructor Assessment Quality Telemetry ---');
    const telemetry = await getInstructorAssessmentIntelligence(submission.quizId);
    console.log(`Retrieved Quality Telemetry for quiz ${telemetry.quizId}: Submissions = ${telemetry.totalSubmissions}`);

    if (telemetry.quizId === submission.quizId) {
      console.log('✅ Instructor quality telemetry retrieval PASSED');
    } else {
      throw new Error('Instructor quality telemetry test failed');
    }

    console.log('\n🎉 ALL ASSESSMENT INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAssessmentTestSuite();
