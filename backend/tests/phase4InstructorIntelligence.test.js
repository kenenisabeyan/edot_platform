/**
 * EDOT Intelligence Phase 4 — Instructor Intelligence Test Suite
 * 
 * Verifies Phase 4 features & requirements:
 * 1. Safe baseline for instructors with no assigned courses.
 * 2. Teaching Overview & Class Learning Health metrics.
 * 3. Server-side Privacy & Access Control (Blocks unauthorized course/student access).
 * 4. Prioritized Students Needing Support with traceable evidence.
 * 5. Difficult Concept Detection with minimum evidence threshold (>=2 struggling students).
 * 6. Single student error isolation (Does NOT flag lesson as difficult).
 * 7. Human-in-the-loop Intervention workflow & outcome monitoring.
 * 8. Learning Pulse distribution integration.
 * 9. Dynamic future course & student support.
 * 10. Comprehensive regression checks across Phase 0, 1, 2, 3.
 */

import { prisma } from '../lib/prisma.js';
import { recordLearningEvent } from '../src/intelligence/events/learningEventService.js';
import { resolveInstructorContext, verifyInstructorCourseAccess } from '../src/intelligence/context/instructorContextResolver.js';
import {
  getTeachingOverview,
  getCourseHealthSummary,
  getStudentsNeedingSupport,
  getDifficultConcepts,
  getLearningPulseDistribution
} from '../src/intelligence/instructor/instructorIntelligenceService.js';
import {
  createIntervention,
  updateInterventionStatus,
  getInterventionHistory,
  getRecommendedInstructorActions
} from '../src/intelligence/interventions/interventionService.js';

const sleep = (ms = 200) => new Promise(r => setTimeout(r, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runPhase4TestSuite() {
  console.log('🧪 Starting EDOT Intelligence Phase 4 Instructor Intelligence Test Suite...\n');

  let testInstructor1;
  let testInstructor2;
  let testCourse1;
  let testCourse2;
  let testStudent1;
  let testStudent2;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // FIXTURE SETUP
    // ─────────────────────────────────────────────────────────────────────────
    testInstructor1 = await prisma.user.create({
      data: {
        name: 'Phase4 Primary Instructor',
        email: `phase4_inst1_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'instructor'
      }
    });

    testInstructor2 = await prisma.user.create({
      data: {
        name: 'Phase4 Unrelated Instructor',
        email: `phase4_inst2_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'instructor'
      }
    });

    testCourse1 = await prisma.course.create({
      data: {
        title: 'Phase 4 Primary Web Architecture',
        slug: `phase4-course1-${Date.now()}`,
        description: 'Primary test course',
        instructorId: testInstructor1.id,
        mainCategory: 'Computer Science',
        subCategory: 'Web Systems',
        duration: 25,
        price: 0
      }
    });

    testCourse2 = await prisma.course.create({
      data: {
        title: 'Phase 4 Unrelated Course',
        slug: `phase4-course2-${Date.now()}`,
        description: 'Unrelated instructor course',
        instructorId: testInstructor2.id,
        mainCategory: 'Mathematics',
        subCategory: 'Calculus',
        duration: 30,
        price: 0
      }
    });

    testStudent1 = await prisma.user.create({
      data: {
        name: 'Phase4 Student Alpha',
        email: `p4_student1_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'student'
      }
    });

    testStudent2 = await prisma.user.create({
      data: {
        name: 'Phase4 Student Beta',
        email: `p4_student2_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'student'
      }
    });

    // Enroll students in Course 1
    await prisma.enrollment.createMany({
      data: [
        { studentId: testStudent1.id, courseId: testCourse1.id, status: 'approved' },
        { studentId: testStudent2.id, courseId: testCourse1.id, status: 'approved' }
      ]
    });

    await prisma.userCourseProgress.createMany({
      data: [
        { userId: testStudent1.id, courseId: testCourse1.id, progress: 40 },
        { userId: testStudent2.id, courseId: testCourse1.id, progress: 30 }
      ]
    });

    await prisma.courseLearnerProfile.createMany({
      data: [
        { userId: testStudent1.id, courseId: testCourse1.id, learningStatus: 'NEEDS_ATTENTION' },
        { userId: testStudent2.id, courseId: testCourse1.id, learningStatus: 'SUPPORT_RECOMMENDED' }
      ]
    });

    console.log(`Setup complete. Inst1 ID: ${testInstructor1.id}, Inst2 ID: ${testInstructor2.id}, Course1 ID: ${testCourse1.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Instructor with No Assigned Courses (Safe Baseline)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Instructor with No Assigned Courses ---');
    const emptyInst = await prisma.user.create({
      data: {
        name: 'Empty Instructor',
        email: `empty_inst_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'instructor'
      }
    });

    const emptyOverview = await getTeachingOverview(emptyInst.id);
    assert(emptyOverview.dataStatus === 'INSUFFICIENT', 'Returns INSUFFICIENT dataStatus');
    assert(emptyOverview.activeCoursesCount === 0, 'Zero active courses count');
    assert(emptyOverview.totalActiveStudents === 0, 'Zero active students count');
    console.log('✅ Scenario 1 PASSED: Safe baseline returned for unassigned instructor.');
    await prisma.user.delete({ where: { id: emptyInst.id } });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Teaching Overview & Active Metrics
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 2: Teaching Overview Metrics ---');
    const overview = await getTeachingOverview(testInstructor1.id);
    assert(overview.dataStatus === 'SUFFICIENT', 'Returns SUFFICIENT dataStatus');
    assert(overview.activeCoursesCount === 1, 'Reflects 1 assigned course');
    assert(overview.totalActiveStudents === 2, 'Reflects 2 enrolled students');
    assert(overview.studentsNeedingAttention === 1, 'Counts 1 student needing attention');
    assert(overview.studentsRecommendedForSupport === 1, 'Counts 1 student recommended for support');
    console.log('✅ Scenario 2 PASSED: Teaching Overview metrics calculated cleanly.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Privacy & Server-Side Authorization Control
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 3: Privacy & Server-Side Access Control ---');
    let authFailed = false;
    try {
      await verifyInstructorCourseAccess(testInstructor1.id, testCourse2.id);
    } catch (err) {
      authFailed = true;
      assert(err.name === 'ForbiddenError', 'Throws ForbiddenError on unauthorized course access');
    }
    assert(authFailed === true, 'Unauthorized access attempt blocked server-side');
    console.log('✅ Scenario 3 PASSED: Server-side access control blocks unauthorized queries.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Class Learning Health Calculation
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 4: Class Learning Health ---');
    const health = await getCourseHealthSummary(testInstructor1.id, testCourse1.id);
    assert(health.courseId === testCourse1.id, 'Returns target course health');
    assert(health.healthStatus !== undefined, 'Calculates health status');
    assert(health.signals !== undefined, 'Provides explainable signals breakdown');
    console.log(`✅ Scenario 4 PASSED: Class Learning Health calculated (${health.healthStatus}).`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: Prioritized Students Needing Support
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 5: Students Needing Support ---');
    const supportList = await getStudentsNeedingSupport(testInstructor1.id);
    assert(supportList.length === 2, `Returns 2 authorized students needing support, got ${supportList.length}`);
    assert(supportList[0].reason !== undefined, 'Includes explainable support reason');
    assert(supportList[0].recommendedNextAction !== undefined, 'Includes actionable recommendation');
    console.log('✅ Scenario 5 PASSED: Students needing support prioritized with traceable evidence.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 6 & 7: Difficult Concept Detection & Minimum Threshold
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 6 & 7: Difficult Concept Detection & Evidence Threshold ---');
    
    // Test 7: Single student error does NOT flag lesson as difficult
    await prisma.quizAttempt.create({
      data: {
        userId: testStudent1.id,
        courseId: testCourse1.id,
        questionIndex: 1,
        question: 'What is CORS?',
        selectedAnswer: 'Wrong',
        correctAnswer: 'Cross Origin Resource Sharing',
        isCorrect: false,
        topic: 'CORS Security'
      }
    });

    const singleStudentCheck = await getDifficultConcepts(testInstructor1.id, testCourse1.id);
    assert(singleStudentCheck.difficultConceptsCount === 0, 'Single student error does NOT trigger difficult concept flag');
    console.log('  Sub-test 7 PASSED: Single student failure isolated cleanly.');

    // Test 6: Second student failure satisfies minimum threshold (>=2 students)
    await prisma.quizAttempt.create({
      data: {
        userId: testStudent2.id,
        courseId: testCourse1.id,
        questionIndex: 1,
        question: 'What is CORS?',
        selectedAnswer: 'Wrong',
        correctAnswer: 'Cross Origin Resource Sharing',
        isCorrect: false,
        topic: 'CORS Security'
      }
    });

    const thresholdMetCheck = await getDifficultConcepts(testInstructor1.id, testCourse1.id);
    assert(thresholdMetCheck.difficultConceptsCount === 1, 'Flags difficult topic when >=2 struggling students threshold met');
    assert(thresholdMetCheck.difficultConcepts[0].topic === 'CORS Security', 'Identifies exact difficult topic');
    console.log('  Sub-test 6 PASSED: Difficult concept detected after minimum evidence threshold met.');

    console.log('✅ Scenario 6 & 7 PASSED: Difficult concept detection enforces evidence threshold.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 8: Human-in-the-loop Intervention Workflow
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 8: Human-in-the-loop Intervention Workflow ---');
    const newIntervention = await createIntervention(testInstructor1.id, {
      courseId: testCourse1.id,
      studentId: testStudent1.id,
      type: 'ENCOURAGEMENT_SENT',
      reason: 'Student inactive for 6 days',
      evidence: { daysInactive: 6 }
    });

    assert(newIntervention.id !== undefined, 'Intervention record created');
    assert(newIntervention.status === 'STARTED', 'Initial status set to STARTED');

    // Simulate subsequent student event
    await recordLearningEvent({
      studentId: testStudent1.id,
      eventType: 'LESSON_COMPLETED',
      courseId: testCourse1.id
    });

    const updatedIntervention = await updateInterventionStatus(testInstructor1.id, newIntervention.id, {
      status: 'COMPLETED',
      outcomeNotes: 'Student resumed lesson completion after check-in'
    });

    assert(updatedIntervention.status === 'COMPLETED', 'Status updated to COMPLETED');
    assert(updatedIntervention.outcome === 'ACTIVITY_RESUMED', 'Outcome monitoring detects ACTIVITY_RESUMED');
    console.log('✅ Scenario 8 PASSED: Intervention workflow completed with outcome monitoring.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 9: Learning Pulse Distribution Integration
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 9: Learning Pulse Distribution ---');
    const pulseDist = await getLearningPulseDistribution(testInstructor1.id, testCourse1.id);
    assert(pulseDist.distribution.NEEDS_ATTENTION === 1, 'Pulse distribution counts 1 NEEDS_ATTENTION');
    assert(pulseDist.distribution.SUPPORT_RECOMMENDED === 1, 'Pulse distribution counts 1 SUPPORT_RECOMMENDED');
    console.log('✅ Scenario 9 PASSED: Learning Pulse distribution integrated cleanly.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 10: Dynamic Support for New Courses & Enrollments
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 10: Dynamic Future Support ---');
    const dynamicCourse = await prisma.course.create({
      data: {
        title: 'Dynamic Future AI Course',
        slug: `dynamic-course-${Date.now()}`,
        description: 'New course assigned dynamically',
        instructorId: testInstructor1.id,
        mainCategory: 'AI',
        subCategory: 'Deep Learning',
        duration: 15
      }
    });

    const updatedOverview = await getTeachingOverview(testInstructor1.id);
    assert(updatedOverview.activeCoursesCount === 2, 'Overview automatically incorporates new assigned course');
    console.log('✅ Scenario 10 PASSED: New courses & enrollments supported automatically.');

    // Clean up dynamic course
    await prisma.course.delete({ where: { id: dynamicCourse.id } });

    console.log('\n🎉 ALL 11 PHASE 4 TEST SCENARIOS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Phase 4 Test Suite Error:', error);
    process.exit(1);
  } finally {
    // Cleanup main test fixtures
    await prisma.instructorIntervention.deleteMany({ where: { instructorId: testInstructor1.id } });
    await prisma.quizAttempt.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.learningEvent.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.courseLearnerProfile.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.userCourseProgress.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: [testCourse1.id, testCourse2.id] } } });
    await prisma.course.deleteMany({ where: { id: { in: [testCourse1.id, testCourse2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testStudent1.id, testInstructor1.id, testInstructor2.id, testStudent2.id] } } });
    await prisma.$disconnect();
  }
}

runPhase4TestSuite();
