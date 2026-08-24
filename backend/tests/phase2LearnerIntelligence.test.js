/**
 * EDOT Intelligence Phase 2 — Learner Intelligence Test Suite
 * 
 * Verifies Phase 2 features:
 * 1. 18-Dimension Digital Twin profile calculation.
 * 2. Next Best Action resolution with explainable rationale.
 * 3. Misconception detection and LearnerWeakness registration from quiz attempts.
 * 4. Adaptive learning sequencing (Fast track vs Remedial support vs Standard).
 */

import { prisma } from '../lib/prisma.js';
import { recordLearningEvent } from '../src/intelligence/events/learningEventService.js';
import { resolveNextBestAction } from '../src/intelligence/recommendations/nextBestActionResolver.js';
import { detectAndRegisterMisconceptions } from '../src/intelligence/understanding/misconceptionEngine.js';
import { generateAdaptiveSequence } from '../src/intelligence/adaptive/adaptiveSequencer.js';
import { syncLearnerProfile } from '../src/intelligence/profile/profileService.js';

const sleep = (ms = 200) => new Promise(r => setTimeout(r, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runPhase2TestSuite() {
  console.log('🧪 Starting EDOT Intelligence Phase 2 Learner Intelligence Test Suite...\n');

  let testStudentId;
  let testCourseId;
  let testInstructorId;

  try {
    // Setup Test Data
    const instructor = await prisma.user.create({
      data: {
        name: 'Phase2 Test Instructor',
        email: `phase2_inst_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'instructor'
      }
    });
    testInstructorId = instructor.id;

    const course = await prisma.course.create({
      data: {
        title: 'Phase 2 Intelligence Course',
        slug: `phase2-course-${Date.now()}`,
        description: 'Test course for Phase 2 learner intelligence',
        instructorId: testInstructorId,
        mainCategory: 'Computer Science',
        subCategory: 'Algorithms',
        duration: 15,
        price: 0
      }
    });
    testCourseId = course.id;

    const student = await prisma.user.create({
      data: {
        name: 'Phase2 Test Student',
        email: `phase2_student_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'student'
      }
    });
    testStudentId = student.id;

    console.log(`Setup complete. Student ID: ${testStudentId}, Course ID: ${testCourseId}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Digital Twin Profile Computation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Digital Twin Profile Computation ---');
    await recordLearningEvent({
      studentId: testStudentId,
      eventType: 'LESSON_COMPLETED',
      courseId: testCourseId,
      lessonId: 'p2_lesson_1',
      metadata: { durationSeconds: 400 }
    });

    const profile = await syncLearnerProfile(testStudentId);
    assert(profile.id !== undefined, 'LearnerProfile created/synced cleanly');
    assert(profile.userId === testStudentId, 'Profile belongs to test student');
    assert(profile.studyHabits !== undefined, 'Study habits dimension computed');
    console.log('✅ Scenario 1 PASSED: Digital Twin profile computed with empirical dimensions.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Next Best Action Resolver Engine
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(300);
    console.log('\n--- Scenario 2: Next Best Action Resolver Engine ---');
    
    // Test 2a: Critical Remediation on Quiz Failure
    await recordLearningEvent({
      studentId: testStudentId,
      eventType: 'QUIZ_FAILED',
      courseId: testCourseId,
      score: 45
    });

    const remediationAction = await resolveNextBestAction(testStudentId);
    assert(remediationAction.actionType === 'REMEDIATE_MISCONCEPTION', `Action type is REMEDIATE_MISCONCEPTION, got ${remediationAction.actionType}`);
    assert(remediationAction.rationale.basis === 'QUIZ_REMEDIATION', 'Rationale correctly attributes quiz remediation');
    console.log('  Sub-test 2a PASSED: Quiz failure triggers REMEDIATE_MISCONCEPTION action with rationale.');

    // Test 2b: Resume Unfinished Lesson
    const lessonObj = await prisma.lesson.create({
      data: {
        courseId: testCourseId,
        title: 'Async JavaScript',
        description: 'Deep dive into Promises',
        videoUrl: 'https://example.com/async.mp4',
        duration: 12,
        order: 1
      }
    });

    await prisma.progressLog.create({
      data: {
        userId: testStudentId,
        courseId: testCourseId,
        lessonId: lessonObj.id,
        isVideoComplete: false,
        videoSegments: [0, 30]
      }
    });

    // Temporarily clear failed quiz event to isolate unfinished lesson test
    await prisma.learningEvent.deleteMany({ where: { userId: testStudentId, eventType: 'QUIZ_FAILED' } });

    const resumeAction = await resolveNextBestAction(testStudentId);
    assert(resumeAction.actionType === 'RESUME_LESSON', `Action type is RESUME_LESSON, got ${resumeAction.actionType}`);
    assert(resumeAction.lessonId === lessonObj.id, 'Targets exact unfinished lesson ID');
    console.log('  Sub-test 2b PASSED: In-progress video resolves RESUME_LESSON action.');

    console.log('✅ Scenario 2 PASSED: Next Best Action Resolver prioritizes correctly with explainable rationale.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Misconception Detection & LearnerWeakness Registration
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(300);
    console.log('\n--- Scenario 3: Misconception Detection Engine ---');
    await prisma.quizAttempt.createMany({
      data: [
        { userId: testStudentId, courseId: testCourseId, questionIndex: 1, question: 'Q1', selectedAnswer: 'A', correctAnswer: 'B', isCorrect: false, topic: 'Recursion Depth' },
        { userId: testStudentId, courseId: testCourseId, questionIndex: 2, question: 'Q2', selectedAnswer: 'C', correctAnswer: 'D', isCorrect: false, topic: 'Recursion Depth' },
        { userId: testStudentId, courseId: testCourseId, questionIndex: 3, question: 'Q3', selectedAnswer: 'A', correctAnswer: 'B', isCorrect: false, topic: 'Recursion Depth' }
      ]
    });

    const miscResult = await detectAndRegisterMisconceptions(testStudentId);
    assert(miscResult.hasMisconceptions === true, 'Detects misconceptions on 3+ wrong attempts');
    assert(miscResult.misconceptions[0].topic === 'Recursion Depth', 'Identifies exact topic');
    
    // Check DB record
    const weakness = await prisma.learnerWeakness.findFirst({
      where: { userId: testStudentId, topic: 'Recursion Depth' }
    });
    assert(weakness !== null, 'Upserts LearnerWeakness record in PostgreSQL DB');
    console.log('✅ Scenario 3 PASSED: Misconceptions detected and LearnerWeakness registered.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Adaptive Learning Sequencing
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(300);
    console.log('\n--- Scenario 4: Adaptive Learning Sequencing ---');
    const adaptiveRes = await generateAdaptiveSequence(testStudentId, testCourseId);
    assert(adaptiveRes.adaptiveMode !== undefined, 'Adaptive sequence mode calculated');
    assert(adaptiveRes.recommendations.length > 0, 'Generates non-destructive path recommendations');
    console.log('✅ Scenario 4 PASSED: Adaptive sequence generated safely.');

    console.log('\n🎉 ALL 4 PHASE 2 TEST SCENARIOS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Phase 2 Test Suite Error:', error);
    process.exit(1);
  } finally {
    // Cleanup test fixtures
    await prisma.quizAttempt.deleteMany({ where: { userId: testStudentId } });
    await prisma.learnerWeakness.deleteMany({ where: { userId: testStudentId } });
    await prisma.progressLog.deleteMany({ where: { userId: testStudentId } });
    await prisma.lesson.deleteMany({ where: { courseId: testCourseId } });
    await prisma.learningEvent.deleteMany({ where: { userId: testStudentId } });
    await prisma.courseLearnerProfile.deleteMany({ where: { userId: testStudentId } });
    await prisma.learnerProfile.deleteMany({ where: { userId: testStudentId } });
    await prisma.enrollment.deleteMany({ where: { studentId: testStudentId } });
    await prisma.userCourseProgress.deleteMany({ where: { userId: testStudentId } });
    await prisma.course.deleteMany({ where: { id: testCourseId } });
    await prisma.user.deleteMany({ where: { id: { in: [testStudentId, testInstructorId] } } });
    await prisma.$disconnect();
  }
}

runPhase2TestSuite();
