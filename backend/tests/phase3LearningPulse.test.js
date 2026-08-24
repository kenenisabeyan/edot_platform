/**
 * EDOT Intelligence Phase 3 — EDOT Learning Pulse Test Suite
 * 
 * Verifies Phase 3 features:
 * 1. Live telemetry pulse aggregation.
 * 2. Learner fatigue detection (90+ min sessions & rest break recommendations).
 * 3. Intelligent nudge generation & anti-fatigue max 2/day enforcement.
 * 4. Nudge dismissal & anti-fatigue status updates.
 */

import { prisma } from '../lib/prisma.js';
import { recordLearningEvent } from '../src/intelligence/events/learningEventService.js';
import { getLivePulseFeed, evaluateLearnerFatigue } from '../src/intelligence/monitoring/learningPulseEngine.js';
import { triggerIntelligentNudges, dismissNudge, getActiveNudges } from '../src/intelligence/nudges/intelligentNudgeEngine.js';

const sleep = (ms = 200) => new Promise(r => setTimeout(r, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runPhase3TestSuite() {
  console.log('🧪 Starting EDOT Intelligence Phase 3 Learning Pulse Test Suite...\n');

  let testStudentId;
  let testCourseId;
  let testInstructorId;

  try {
    // Setup Test Data
    const instructor = await prisma.user.create({
      data: {
        name: 'Phase3 Test Instructor',
        email: `phase3_inst_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'instructor'
      }
    });
    testInstructorId = instructor.id;

    const course = await prisma.course.create({
      data: {
        title: 'Phase 3 Intelligence Course',
        slug: `phase3-course-${Date.now()}`,
        description: 'Test course for Phase 3 learning pulse',
        instructorId: testInstructorId,
        mainCategory: 'Data Science',
        subCategory: 'Machine Learning',
        duration: 20,
        price: 0
      }
    });
    testCourseId = course.id;

    const student = await prisma.user.create({
      data: {
        name: 'Phase3 Test Student',
        email: `phase3_student_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'student'
      }
    });
    testStudentId = student.id;

    console.log(`Setup complete. Student ID: ${testStudentId}, Course ID: ${testCourseId}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Live Telemetry Pulse Feed Aggregation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Live Telemetry Pulse Feed Aggregation ---');
    await recordLearningEvent({
      studentId: testStudentId,
      eventType: 'LESSON_COMPLETED',
      courseId: testCourseId,
      lessonId: 'p3_lesson_1'
    });

    const liveFeed = await getLivePulseFeed({ courseId: testCourseId, limit: 10 });
    assert(liveFeed.sourceType === 'EDOT_LEARNING_PULSE', 'Source type is EDOT_LEARNING_PULSE');
    assert(liveFeed.feed.length > 0, 'Live pulse feed returns telemetry events');
    assert(liveFeed.feed[0].studentName.includes('Phase3'), 'Student name properly formatted');
    console.log('✅ Scenario 1 PASSED: Live pulse telemetry feed aggregated cleanly.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Learner Fatigue & Continuous Session Detection
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 2: Learner Fatigue Monitoring Engine ---');
    const now = new Date();
    const TWO_HOURS_AGO = new Date(now.getTime() - 110 * 60 * 1000);

    // Simulate 110-minute continuous study session
    await prisma.learningEvent.create({
      data: {
        userId: testStudentId,
        eventType: 'VIDEO_PROGRESS',
        courseId: testCourseId,
        timestamp: TWO_HOURS_AGO
      }
    });

    await prisma.learningEvent.create({
      data: {
        userId: testStudentId,
        eventType: 'LESSON_COMPLETED',
        courseId: testCourseId,
        timestamp: now
      }
    });

    const fatigueReport = await evaluateLearnerFatigue(testStudentId);
    assert(fatigueReport.continuousStudyMinutes >= 90, `Continuous session duration >= 90 mins, got ${fatigueReport.continuousStudyMinutes}`);
    assert(fatigueReport.restRecommended === true, 'Recommends rest break after 90+ min continuous session');
    console.log('✅ Scenario 2 PASSED: Learner fatigue & 90+ min session detected with rest break recommendation.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Intelligent Nudge Generation & Anti-Fatigue Caps (Max 2/day)
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 3: Intelligent Nudges & Anti-Fatigue Caps ---');
    
    // Add failed quiz to generate additional nudge candidate
    await recordLearningEvent({
      studentId: testStudentId,
      eventType: 'QUIZ_FAILED',
      courseId: testCourseId,
      score: 50
    });

    // Also add 90% progress course to generate 3rd candidate
    await prisma.userCourseProgress.create({
      data: {
        userId: testStudentId,
        courseId: testCourseId,
        progress: 90
      }
    });

    const generatedNudges = await triggerIntelligentNudges(testStudentId);
    assert(generatedNudges.length <= 2, `Enforces maximum 2 nudges/day anti-fatigue cap, got ${generatedNudges.length}`);
    assert(generatedNudges.length > 0, 'Active nudges generated based on signals');
    console.log(`✅ Scenario 3 PASSED: Triggered ${generatedNudges.length} intelligent nudges under strict 2/day cap.`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Nudge Dismissal Workflow
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 4: Nudge Dismissal Workflow ---');
    const targetNudgeId = generatedNudges[0].id;
    await dismissNudge(testStudentId, targetNudgeId);

    const activeAfterDismiss = await getActiveNudges(testStudentId);
    const isDismissedPresent = activeAfterDismiss.some(n => n.id === targetNudgeId);
    assert(isDismissedPresent === false, 'Dismissed nudge no longer appears in active list');
    console.log('✅ Scenario 4 PASSED: Nudge dismissed cleanly and removed from active list.');

    console.log('\n🎉 ALL 4 PHASE 3 TEST SCENARIOS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Phase 3 Test Suite Error:', error);
    process.exit(1);
  } finally {
    // Cleanup test fixtures
    await prisma.intelligentNudge.deleteMany({ where: { userId: testStudentId } });
    await prisma.progressLog.deleteMany({ where: { userId: testStudentId } });
    await prisma.learningEvent.deleteMany({ where: { userId: testStudentId } });
    await prisma.userCourseProgress.deleteMany({ where: { userId: testStudentId } });
    await prisma.courseLearnerProfile.deleteMany({ where: { userId: testStudentId } });
    await prisma.learnerProfile.deleteMany({ where: { userId: testStudentId } });
    await prisma.enrollment.deleteMany({ where: { studentId: testStudentId } });
    await prisma.course.deleteMany({ where: { id: testCourseId } });
    await prisma.user.deleteMany({ where: { id: { in: [testStudentId, testInstructorId] } } });
    await prisma.$disconnect();
  }
}

runPhase3TestSuite();
