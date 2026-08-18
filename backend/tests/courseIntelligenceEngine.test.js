/**
 * Test Suite - EDOT Course Intelligence Engine (Snapshot, Drop-off Analysis, Drill-down Telemetry)
 */

import { getCourseIntelligenceSnapshot } from '../src/intelligence/course/courseIntelligenceService.js';
import { prisma } from '../lib/prisma.js';

async function runCourseIntelligenceTestSuite() {
  console.log('🧪 Starting EDOT Course Intelligence Engine Test Suite...\n');

  try {
    // 1. Fetch test course
    const testCourse = await prisma.course.findFirst({
      include: { lessons: true }
    });

    if (!testCourse) {
      console.warn('⚠️ No course found in database, skipping snapshot test');
      return;
    }

    console.log(`📘 Testing Course Intelligence for course: "${testCourse.title}" [ID: ${testCourse.id}]`);

    // 2. Execute Course Intelligence Snapshot Generation
    const snapshot = await getCourseIntelligenceSnapshot(testCourse.id);

    console.log('Snapshot DTO Output Summary:', JSON.stringify({
      snapshotId: snapshot.snapshotId,
      courseTitle: snapshot.courseTitle,
      difficultyScore: snapshot.difficultyScore,
      completionRate: snapshot.completionRate,
      engagementScore: snapshot.engagementScore,
      totalEnrolled: snapshot.totalEnrolled,
      totalCompleted: snapshot.totalCompleted,
      dropoffPointsCount: snapshot.dropoffPoints.length,
      weakTopicAreasCount: snapshot.weakTopicAreas.length,
      insightsCount: snapshot.instructorInsights.length
    }, null, 2));

    if (snapshot.instructorInsights.length > 0) {
      console.log('Sample AI Instructor Insight:', JSON.stringify(snapshot.instructorInsights[0], null, 2));
    }

    if (snapshot.drilldownData && typeof snapshot.completionRate === 'number' && Array.isArray(snapshot.dropoffPoints)) {
      console.log('✅ Course Intelligence calculation & drill-down verification PASSED');
    } else {
      throw new Error('Course Intelligence snapshot schema invalid');
    }

    // 3. Verify Database Persistence
    const dbSnapshot = await prisma.courseIntelligenceSnapshot.findFirst({
      where: { courseId: testCourse.id },
      orderBy: { generatedAt: 'desc' }
    });

    if (dbSnapshot && dbSnapshot.id === snapshot.snapshotId) {
      console.log('✅ Database persistence PASSED');
    } else {
      throw new Error('Database persistence verification failed');
    }

    console.log('\n🎉 ALL COURSE INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCourseIntelligenceTestSuite();
