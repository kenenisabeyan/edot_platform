/**
 * Test Suite - EDOT Dynamic Course Intelligence Onboarding Pipeline
 * 
 * Verifies:
 * 1. Existing course onboarding (Structure discovery, CourseIntelligenceStatus READY, KnowledgeDocuments).
 * 2. Newly created course onboarding across generic domains (Business, Science, Arts).
 * 3. Incremental lesson creation/update without platform reprocessing.
 * 4. Knowledge Base strict security & cross-course context isolation.
 * 5. Safe content deactivation preserving historical learner evidence.
 * 6. Controlled paginated backfill job.
 */

import {
  onboardSingleCourse,
  onLessonModified,
  onContentDeactivated,
  getAuthorizedCourseKnowledgeContext,
  backfillAllExistingCourses
} from '../src/intelligence/onboarding/courseOnboardingPipeline.js';
import { prisma } from '../lib/prisma.js';

async function runCourseOnboardingTestSuite() {
  console.log('🧪 Starting EDOT Dynamic Course Intelligence Onboarding Test Suite...\n');

  let testCourseId = null;
  let testInstructorId = null;

  try {
    // 1. Discover Existing Data & Onboard First Existing Course
    console.log('--- 1. Testing Existing Course Discovery & Onboarding ---');
    const existingCourse = await prisma.course.findFirst({
      include: { instructor: true, lessons: true }
    });

    if (!existingCourse) {
      throw new Error('No existing course found in database');
    }

    testCourseId = existingCourse.id;
    testInstructorId = existingCourse.instructorId;

    console.log(`Discovered Course: [${existingCourse.id}] "${existingCourse.title}" | Category: ${existingCourse.mainCategory}`);
    
    const existingResult = await onboardSingleCourse(existingCourse.id);
    console.log('Existing Course Onboarding Result:', JSON.stringify(existingResult, null, 2));

    if (existingResult.success && existingResult.status === 'READY' && existingResult.knowledgeChunkCount > 0) {
      console.log('✅ Existing Course Onboarding PASSED');
    } else {
      throw new Error('Existing course onboarding failed');
    }

    // Verify CourseIntelligenceStatus in DB
    const dbStatus = await prisma.courseIntelligenceStatus.findUnique({
      where: { courseId: existingCourse.id }
    });
    console.log('DB CourseIntelligenceStatus:', dbStatus.status, '| Version:', dbStatus.lastContentVersion);

    // 2. Newly Created Generic Course (e.g. Business Intelligence)
    console.log('\n--- 2. Testing Newly Created Course Dynamic Onboarding ---');
    const newCourse = await prisma.course.create({
      data: {
        title: 'Strategic Financial Forecasting & Business Analytics',
        slug: `financial-forecasting-${Date.now()}`,
        description: 'Comprehensive guide to EBITDA modeling, discounted cash flows, and Monte Carlo risk simulations.',
        mainCategory: 'Business',
        subCategory: 'Finance',
        level: 'Intermediate',
        duration: 8.5,
        instructorId: testInstructorId,
        whatYouWillLearn: ['EBITDA Modeling', 'Discounted Cash Flows', 'Scenario Analysis'],
        requirements: ['Basic spreadsheet familiarity']
      }
    });

    const newCourseResult = await onboardSingleCourse(newCourse.id);
    console.log('New Course Result:', JSON.stringify(newCourseResult, null, 2));

    if (newCourseResult.success && newCourseResult.status === 'READY') {
      console.log('✅ Newly Created Course Dynamic Onboarding PASSED');
    } else {
      throw new Error('New course onboarding failed');
    }

    // 3. Incremental Lesson Creation Inside Existing Course
    console.log('\n--- 3. Testing Incremental Lesson Modification ---');
    const incrementalResult = await onLessonModified('les-inc-99', newCourse.id, {
      title: 'Monte Carlo Probability Simulations',
      description: 'Running 10,000 probabilistic scenarios on revenue variances.',
      readingMaterials: 'Chapter 4 Financial Statistics'
    });
    console.log('Incremental Lesson Result:', incrementalResult);

    if (incrementalResult.success && incrementalResult.status === 'LESSON_INCREMENTALLY_INDEXED') {
      console.log('✅ Incremental Lesson Modification PASSED');
    } else {
      throw new Error('Incremental lesson modification failed');
    }

    // 4. Authorized Knowledge Base Context Isolation
    console.log('\n--- 4. Testing Knowledge Base Context & Tenant Isolation ---');
    
    // As Instructor (Authorized)
    const instructorCtx = await getAuthorizedCourseKnowledgeContext(testInstructorId, newCourse.id);
    console.log('Instructor Context Authorized:', instructorCtx.authorized, '| Chunks:', instructorCtx.knowledgeChunks.length);

    // As Unenrolled Student (Unauthorized - Should only see public overview)
    const unauthorizedCtx = await getAuthorizedCourseKnowledgeContext('unauthorized-user-uuid', newCourse.id);
    console.log('Unauthorized Context Authorized:', unauthorizedCtx.authorized, '| Chunks returned:', unauthorizedCtx.knowledgeChunks.length);

    if (instructorCtx.authorized && !unauthorizedCtx.authorized) {
      console.log('✅ Strict Knowledge Base Context & Course Isolation PASSED');
    } else {
      throw new Error('Knowledge Base isolation failed');
    }

    // 5. Safe Content Deactivation (Preserving Evidence)
    console.log('\n--- 5. Testing Safe Content Deactivation ---');
    const deactResult = await onContentDeactivated('COURSE', newCourse.id);
    console.log('Deactivation Result:', deactResult);

    if (deactResult.success && deactResult.status === 'DEACTIVATED_SAFE') {
      console.log('✅ Safe Content Deactivation PASSED');
    } else {
      throw new Error('Content deactivation failed');
    }

    // Clean up temporary test course
    await prisma.knowledgeDocument.deleteMany({ where: { courseId: newCourse.id } });
    await prisma.courseIntelligenceStatus.deleteMany({ where: { courseId: newCourse.id } });
    await prisma.course.delete({ where: { id: newCourse.id } });

    // 6. Database Backfill Job (Batch Size 10)
    console.log('\n--- 6. Testing Controlled Database Content Backfill Job ---');
    const backfillResult = await backfillAllExistingCourses({ batchSize: 10, offset: 0 });
    console.log('Backfill Output:', JSON.stringify(backfillResult, null, 2));

    if (backfillResult.batchProcessed > 0 && backfillResult.readyCount > 0) {
      console.log('✅ Controlled Database Backfill Job PASSED');
    } else {
      throw new Error('Backfill job failed');
    }

    console.log('\n🎉 ALL COURSE ONBOARDING PIPELINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCourseOnboardingTestSuite();
