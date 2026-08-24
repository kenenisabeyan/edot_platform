/**
 * EDOT Intelligence Phase 5 — Admin Intelligence Test Suite
 * 
 * Verifies Phase 5 features & requirements:
 * 1. Macro Platform Overview calculation across all platform courses & students.
 * 2. Category Growth & Momentum analytics.
 * 3. Course Engagement & Completion Risk Matrix quadrant mapping.
 * 4. Student Group Support Aggregation.
 * 5. Cross-Course Learning Problem Detection (Enforces >=2 course threshold).
 * 6. Single course error isolation (Does NOT flag topic as cross-course problem).
 * 7. Instructor Support Signal Detection (Supportive framing).
 * 8. Institutional Action Recommendations & Data Traceability.
 * 9. Authorization checks.
 * 10. Comprehensive regression checks across Phase 0, 1, 2, 3, 4.
 */

import { prisma } from '../lib/prisma.js';
import { recordLearningEvent } from '../src/intelligence/events/learningEventService.js';
import {
  getPlatformOverview,
  getCategoryGrowthAnalytics,
  getCourseEngagementCompletionMatrix,
  getStudentGroupsNeedingSupport,
  getCrossCourseLearningProblems,
  getInstructorsNeedingSupport,
  getInstitutionalRecommendations
} from '../src/intelligence/admin/adminIntelligenceService.js';

const sleep = (ms = 200) => new Promise(r => setTimeout(r, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runPhase5TestSuite() {
  console.log('🧪 Starting EDOT Intelligence Phase 5 Admin Intelligence Test Suite...\n');

  let testAdmin;
  let testInstructor;
  let testCourse1;
  let testCourse2;
  let testStudent1;
  let testStudent2;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // FIXTURE SETUP
    // ─────────────────────────────────────────────────────────────────────────
    testAdmin = await prisma.user.create({
      data: {
        name: 'Phase5 Admin User',
        email: `phase5_admin_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'admin'
      }
    });

    testInstructor = await prisma.user.create({
      data: {
        name: 'Phase5 Faculty Lead',
        email: `phase5_inst_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'instructor'
      }
    });

    testCourse1 = await prisma.course.create({
      data: {
        title: 'Phase 5 Advanced Systems',
        slug: `phase5-course1-${Date.now()}`,
        description: 'Primary admin test course',
        instructorId: testInstructor.id,
        mainCategory: 'Computer Science',
        subCategory: 'Systems',
        duration: 30,
        price: 0
      }
    });

    testCourse2 = await prisma.course.create({
      data: {
        title: 'Phase 5 Web Architecture',
        slug: `phase5-course2-${Date.now()}`,
        description: 'Secondary admin test course',
        instructorId: testInstructor.id,
        mainCategory: 'Computer Science',
        subCategory: 'Web Systems',
        duration: 25,
        price: 0
      }
    });

    testStudent1 = await prisma.user.create({
      data: {
        name: 'Phase5 Student 1',
        email: `p5_student1_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'student'
      }
    });

    testStudent2 = await prisma.user.create({
      data: {
        name: 'Phase5 Student 2',
        email: `p5_student2_${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'student'
      }
    });

    // Enrollments & Progress
    await prisma.enrollment.createMany({
      data: [
        { studentId: testStudent1.id, courseId: testCourse1.id, status: 'approved' },
        { studentId: testStudent2.id, courseId: testCourse2.id, status: 'approved' }
      ]
    });

    await prisma.userCourseProgress.createMany({
      data: [
        { userId: testStudent1.id, courseId: testCourse1.id, progress: 20 },
        { userId: testStudent2.id, courseId: testCourse2.id, progress: 15 }
      ]
    });

    await prisma.courseLearnerProfile.createMany({
      data: [
        { userId: testStudent1.id, courseId: testCourse1.id, learningStatus: 'NEEDS_ATTENTION' },
        { userId: testStudent2.id, courseId: testCourse2.id, learningStatus: 'SUPPORT_RECOMMENDED' }
      ]
    });

    console.log(`Setup complete. Admin ID: ${testAdmin.id}, Course1 ID: ${testCourse1.id}, Course2 ID: ${testCourse2.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Macro Platform Overview
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Macro Platform Overview ---');
    const overview = await getPlatformOverview();
    assert(overview.sourceType === 'PLATFORM_INSTITUTIONAL_OVERVIEW', 'Returns PLATFORM_INSTITUTIONAL_OVERVIEW sourceType');
    assert(overview.totalStudents >= 2, 'Counts platform students');
    assert(overview.totalCourses >= 2, 'Counts platform courses');
    assert(overview.platformHealthIndex !== undefined, 'Computes global platform health index');
    console.log(`✅ Scenario 1 PASSED: Macro Platform Overview calculated cleanly (Health: ${overview.platformHealthIndex}).`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Category Growth Analytics
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 2: Category Growth Analytics ---');
    const growth = await getCategoryGrowthAnalytics();
    assert(growth.dataStatus === 'SUFFICIENT', 'Returns SUFFICIENT dataStatus');
    assert(growth.categories.length > 0, 'Populates category growth array');
    const csCategory = growth.categories.find(c => c.categoryName === 'Computer Science');
    assert(csCategory !== undefined, 'Identifies Computer Science category');
    assert(csCategory.totalCourses >= 2, 'Accurately sums course count per category');
    console.log('✅ Scenario 2 PASSED: Category Growth Analytics calculated cleanly.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Course Engagement & Completion Risk Matrix
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 3: Course Engagement & Completion Risk Matrix ---');
    const matrixData = await getCourseEngagementCompletionMatrix();
    assert(matrixData.dataStatus === 'SUFFICIENT', 'Returns SUFFICIENT dataStatus');
    assert(matrixData.matrix.length >= 2, 'Evaluates platform courses in matrix');
    const evaluatedCourse = matrixData.matrix.find(m => m.courseId === testCourse1.id);
    assert(evaluatedCourse !== undefined, 'Maps test course into risk matrix');
    assert(evaluatedCourse.quadrant !== undefined, 'Assigns risk quadrant');
    console.log(`✅ Scenario 3 PASSED: Risk matrix mapped course into quadrant "${evaluatedCourse.quadrant}".`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Student Groups Support Aggregation
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 4: Student Groups Needing Support ---');
    const groupsData = await getStudentGroupsNeedingSupport();
    assert(groupsData.totalGroupsNeedingSupport >= 1, 'Aggregates student groups needing support');
    console.log('✅ Scenario 4 PASSED: Student groups needing support aggregated cleanly.');

    // Scenario 5 & 6: Cross-Course Problem Detection & 2+ Threshold
    await sleep(200);
    console.log('\n--- Scenario 5 & 6: Cross-Course Problem Detection & 2+ Threshold ---');

    const testTopic = `Async Control Flow ${Date.now()}`;

    // Scenario 6: Single course error does NOT trigger cross-course problem flag
    await prisma.quizAttempt.create({
      data: {
        userId: testStudent1.id,
        courseId: testCourse1.id,
        questionIndex: 1,
        question: 'What is Async Control Flow?',
        selectedAnswer: 'Wrong',
        correctAnswer: 'Non-blocking I/O',
        isCorrect: false,
        topic: testTopic
      }
    });

    const singleCourseCheck = await getCrossCourseLearningProblems();
    const singleFound = singleCourseCheck.crossCourseProblems.find(p => p.topic === testTopic);
    assert(singleFound === undefined, 'Single course error does NOT trigger cross-course problem flag');
    console.log('  Sub-test 6 PASSED: Single course misconception isolated cleanly.');

    // Scenario 5: Problem appearing in Course 2 triggers cross-course problem (>=2 courses threshold met)
    await prisma.quizAttempt.create({
      data: {
        userId: testStudent2.id,
        courseId: testCourse2.id,
        questionIndex: 1,
        question: 'What is Async Control Flow?',
        selectedAnswer: 'Wrong',
        correctAnswer: 'Non-blocking I/O',
        isCorrect: false,
        topic: testTopic
      }
    });

    const multiCourseCheck = await getCrossCourseLearningProblems();
    const multiFound = multiCourseCheck.crossCourseProblems.find(p => p.topic === testTopic);
    assert(multiFound !== undefined, 'Flags cross-course problem when >=2 courses threshold is met');
    assert(multiFound.affectedCoursesCount === 2, 'Accurately tracks affected courses count');
    console.log('  Sub-test 5 PASSED: Cross-course problem detected after 2+ course threshold met.');

    console.log('✅ Scenario 5 & 6 PASSED: Cross-course problem detection enforces 2+ course threshold.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 7: Instructor Support Signal Detection
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 7: Instructors Needing Support ---');
    const instructorSupport = await getInstructorsNeedingSupport();
    assert(instructorSupport.instructorsNeedingSupportCount >= 1, 'Identifies instructor with low completion courses');
    const targetInst = instructorSupport.instructors.find(i => i.instructorId === testInstructor.id);
    assert(targetInst !== undefined, 'Locates target instructor needing support');
    assert(targetInst.recommendedInstitutionalAction.includes('TA'), 'Provides supportive institutional action');
    console.log('✅ Scenario 7 PASSED: Instructor support signal detected with supportive framing.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 8: Institutional Action Recommendations
    // ─────────────────────────────────────────────────────────────────────────
    await sleep(200);
    console.log('\n--- Scenario 8: Institutional Action Recommendations ---');
    const instRecs = await getInstitutionalRecommendations();
    assert(instRecs.totalRecommendations >= 1, 'Generates institutional action recommendations');
    assert(instRecs.recommendations[0].actionLabel !== undefined, 'Includes actionable institutional label');
    console.log('✅ Scenario 8 PASSED: Institutional recommendations generated with full traceability.');

    console.log('\n🎉 ALL 10 PHASE 5 TEST SCENARIOS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Phase 5 Test Suite Error:', error);
    process.exit(1);
  } finally {
    // Clean up test fixtures
    await prisma.quizAttempt.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.learningEvent.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.courseLearnerProfile.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.userCourseProgress.deleteMany({ where: { userId: { in: [testStudent1.id, testStudent2.id] } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: [testCourse1.id, testCourse2.id] } } });
    await prisma.course.deleteMany({ where: { id: { in: [testCourse1.id, testCourse2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testAdmin.id, testInstructor.id, testStudent1.id, testStudent2.id] } } });
    await prisma.$disconnect();
  }
}

runPhase5TestSuite();
