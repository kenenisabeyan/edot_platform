/**
 * Test Suite - EDOT Learning Analytics Engine (Learner, Instructor, Admin Levels)
 */

import {
  getLearnerAnalytics,
  getInstructorAnalytics,
  getAdminAnalyticsOverview,
  getAtRiskLearnersDTO
} from '../src/intelligence/analytics/analyticsService.js';
import { prisma } from '../lib/prisma.js';

async function runAnalyticsTestSuite() {
  console.log('🧪 Starting EDOT Learning Analytics Engine Test Suite...\n');

  try {
    // Fetch or mock test user & instructor
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };
    const testInstructor = await prisma.user.findFirst({ where: { role: 'instructor' } }) || testUser;

    // 1. Test Learner Analytics Level
    console.log('--- 1. Testing Learner Analytics Level ---');
    const learnerAnalytics = await getLearnerAnalytics(testUser.id);
    console.log('Learner Analytics DTO Summary:', JSON.stringify({
      userId: learnerAnalytics.userId,
      riskLevel: learnerAnalytics.riskLevel,
      completionRate: learnerAnalytics.completionRate,
      activeLearningDays: learnerAnalytics.activeLearningDays,
      timeInvestedHours: learnerAnalytics.timeInvestedHours,
      quizAccuracy: learnerAnalytics.quizPerformance.accuracyPercent,
      improvementTrend: learnerAnalytics.quizPerformance.improvementTrend,
      insightsCount: learnerAnalytics.insights.length
    }, null, 2));

    if (typeof learnerAnalytics.completionRate === 'number' && Array.isArray(learnerAnalytics.engagementTrend)) {
      console.log('✅ Learner Analytics Level PASSED');
    } else {
      throw new Error('Learner Analytics output schema invalid');
    }

    // 2. Test Instructor Analytics Level
    console.log('\n--- 2. Testing Instructor Analytics Level ---');
    const instructorAnalytics = await getInstructorAnalytics(testInstructor.id);
    console.log('Instructor Analytics DTO Summary:', JSON.stringify({
      instructorId: instructorAnalytics.instructorId,
      totalCourses: instructorAnalytics.totalCourses,
      totalStudents: instructorAnalytics.totalStudents,
      questionDifficultyCount: instructorAnalytics.quizQuestionDifficulty.length,
      weakTopicClustersCount: instructorAnalytics.weakTopicClusters.length
    }, null, 2));

    if (typeof instructorAnalytics.totalCourses === 'number' && Array.isArray(instructorAnalytics.studentCompletionRates)) {
      console.log('✅ Instructor Analytics Level PASSED');
    } else {
      throw new Error('Instructor Analytics output schema invalid');
    }

    // 3. Test Admin / Platform Analytics Overview Level
    console.log('\n--- 3. Testing Admin Platform Analytics Level ---');
    const adminOverview = await getAdminAnalyticsOverview();
    console.log('Admin Overview DTO Summary:', JSON.stringify({
      totalLearners: adminOverview.platformMetrics.totalLearners,
      totalEnrollments: adminOverview.platformMetrics.totalEnrollments,
      completionRatePercent: adminOverview.platformMetrics.completionRatePercent,
      dau: adminOverview.activeLearners.dau,
      wau: adminOverview.activeLearners.wau,
      mau: adminOverview.activeLearners.mau,
      atRiskLearnerCounts: adminOverview.atRiskLearnerCounts
    }, null, 2));

    if (typeof adminOverview.platformMetrics.totalLearners === 'number' && adminOverview.atRiskLearnerCounts) {
      console.log('✅ Admin Platform Analytics Level PASSED');
    } else {
      throw new Error('Admin Analytics output schema invalid');
    }

    // 4. Test At-Risk Learners Directory
    console.log('\n--- 4. Testing At-Risk Learners Directory DTO ---');
    const atRiskDirectory = await getAtRiskLearnersDTO(5);
    console.log(`Retrieved ${atRiskDirectory.length} at-risk learner records.`);
    console.log('✅ At-Risk Learners Directory PASSED');

    console.log('\n🎉 ALL LEARNING ANALYTICS ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAnalyticsTestSuite();
