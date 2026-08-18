/**
 * Test Suite - EDOT Project and Portfolio Intelligence Engine
 * Verifies project recommendations based on skills, AI milestone guidance without false claims,
 * submission artifact tracking, and human instructor verification.
 */

import {
  getRecommendedProjects,
  getAiProjectMilestones,
  submitProjectArtifact,
  getLearnerPortfolio,
  reviewProjectByInstructor
} from '../src/intelligence/projects/projectService.js';
import { prisma } from '../lib/prisma.js';

async function runProjectIntelligenceTestSuite() {
  console.log('🧪 Starting EDOT Project and Portfolio Intelligence Engine Test Suite...\n');

  try {
    const testStudent = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    // 1. Recommended Projects Test
    console.log('--- 1. Testing Skill Gap Project Recommendations ---');
    const recommendations = await getRecommendedProjects(testStudent.id);
    console.log(`Retrieved ${recommendations.length} recommended project challenges.`);
    console.log('Sample Recommendation:', JSON.stringify(recommendations[0], null, 2));

    if (recommendations.length > 0 && recommendations[0].projectId) {
      console.log('✅ Skill gap project recommendations PASSED');
    } else {
      throw new Error('Project recommendations test failed');
    }

    const projectId = recommendations[0].projectId;

    // 2. AI Milestone Guidance Test
    console.log('\n--- 2. Testing AI Milestone Guidance & Non-False-Verification Label ---');
    const guidance = await getAiProjectMilestones(projectId);
    console.log('AI Guidance Output:', JSON.stringify(guidance, null, 2));

    if (guidance.isVerificationClaimed === false && guidance.milestones.length >= 2) {
      console.log('✅ AI milestone guidance & non-false-verification label PASSED');
    } else {
      throw new Error('AI milestone guidance test failed');
    }

    // 3. Artifact Submission & AI Conceptual Review Test
    console.log('\n--- 3. Testing Project Artifact Submission & AI Conceptual Review ---');
    const submission = await submitProjectArtifact(testStudent.id, {
      projectId,
      repoUrl: 'https://github.com/teststudent/ecommerce-storefront',
      liveDemoUrl: 'https://ecommerce-storefront.vercel.app'
    });

    console.log('Submission Output:', JSON.stringify(submission, null, 2));

    if (submission.submissionId && submission.verificationType === 'AI_CONCEPTUAL_FEEDBACK' && submission.isVerified === false) {
      console.log('✅ Project artifact submission & AI non-verification label PASSED');
    } else {
      throw new Error('Artifact submission test failed');
    }

    // 4. Instructor Objective Verification Test
    console.log('\n--- 4. Testing Instructor Objective Verification & Portfolio Item Creation ---');
    const instructor = await prisma.user.findFirst({ where: { role: 'instructor' } }) || testStudent;

    const reviewResult = await reviewProjectByInstructor(submission.submissionId, instructor.id, true, 'Verified clean CSS Grid layout & responsive components.');
    console.log('Instructor Review Output:', JSON.stringify(reviewResult, null, 2));

    const portfolio = await getLearnerPortfolio(testStudent.id);
    console.log(`Retrieved ${portfolio.portfolioCount} portfolio items for student ${testStudent.id}.`);

    if (reviewResult.verificationType === 'HUMAN_VERIFIED' && portfolio.portfolioCount >= 1) {
      console.log('✅ Instructor objective verification & portfolio assembly PASSED');
    } else {
      throw new Error('Instructor verification test failed');
    }

    console.log('\n🎉 ALL PROJECT AND PORTFOLIO INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProjectIntelligenceTestSuite();
