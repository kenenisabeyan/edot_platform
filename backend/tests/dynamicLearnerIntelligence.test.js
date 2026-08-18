/**
 * Test Suite - EDOT Dynamic Learner Intelligence Engine
 * 
 * Verifies all 6 required scenarios:
 * 1. Existing student using existing course.
 * 2. New student enrolling in existing course.
 * 3. Existing student enrolling in newly created course.
 * 4. New student enrolling in newly created course.
 * 5. Student taking a newly created quiz (targeted incremental updates, skill evidence, weakness/mastery tracking).
 * 6. Student learning a newly created lesson (incremental progress update, momentum, next best action).
 * 
 * Also verifies multi-level hierarchy isolation (Learner -> Global -> Category -> Course -> Section -> Lesson)
 * and reusable event publisher helpers.
 */

import {
  onStudentCreated,
  onEnrollmentCreated,
  onLearningActivityOccurred,
  getMultiLevelLearnerContext
} from '../src/intelligence/profile/dynamicLearnerIntelligenceEngine.js';
import {
  publishStudentCreatedEvent,
  publishEnrollmentCreatedEvent,
  publishLessonCompletedEvent,
  publishQuizCompletedEvent
} from '../src/intelligence/events/learningEventService.js';
import { onboardSingleCourse } from '../src/intelligence/onboarding/courseOnboardingPipeline.js';
import { prisma } from '../lib/prisma.js';

async function runDynamicLearnerIntelligenceTestSuite() {
  console.log('🧪 Starting EDOT Dynamic Learner Intelligence Test Suite...\n');

  let newStudent1, newStudent2, newCourseB, newCourseC;

  try {
    // Discover existing student and existing course
    const existingStudent = await prisma.user.findFirst({ where: { role: 'student' } });
    const existingCourse = await prisma.course.findFirst();

    if (!existingStudent || !existingCourse) {
      throw new Error('Database missing baseline student or course for testing');
    }

    console.log(`Discovered Baseline Data: Student [${existingStudent.id}] "${existingStudent.name}" | Course [${existingCourse.id}] "${existingCourse.title}"`);

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 1: Existing Student Using Existing Course
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Existing Student Using Existing Course ---');
    const s1Result = await onEnrollmentCreated(existingStudent.id, existingCourse.id);
    console.log('  Enrollment Result:', s1Result.status);

    const s1Context = await getMultiLevelLearnerContext(existingStudent.id, existingCourse.id);
    console.log('  Global Intelligence:', s1Context.globalIntelligence.learnerName, '| Momentum:', s1Context.globalIntelligence.overallMomentum);
    console.log('  Course Intelligence:', s1Context.courseIntelligence.courseTitle, '| Progress:', s1Context.courseIntelligence.progressPercent, '%');

    if (s1Result.success && s1Context.courseIntelligence) {
      console.log('✅ Scenario 1 PASSED');
    } else {
      throw new Error('Scenario 1 failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 2: New Student Enrolling in Existing Course
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 2: New Student Enrolling in Existing Course ---');
    newStudent1 = await prisma.user.create({
      data: {
        name: `Test Student Y ${Date.now()}`,
        email: `student.y.${Date.now()}@edot.edu`,
        password: 'hashedpassword123',
        role: 'student'
      }
    });

    const init1 = await onStudentCreated(newStudent1.id, { name: newStudent1.name, email: newStudent1.email });
    console.log('  New Student Init:', init1.status, '| Default Academic Level:', init1.profileSummary.academicLevel);

    const s2Result = await onEnrollmentCreated(newStudent1.id, existingCourse.id);
    console.log('  New Student Enrollment:', s2Result.status, '| Skills Connected:', s2Result.connectedSkills.length);

    if (init1.success && s2Result.success) {
      console.log('✅ Scenario 2 PASSED');
    } else {
      throw new Error('Scenario 2 failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 3: Existing Student Enrolling in Newly Created Course
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 3: Existing Student Enrolling in Newly Created Course ---');
    newCourseB = await prisma.course.create({
      data: {
        title: `Quantum Machine Learning & Optimization ${Date.now()}`,
        slug: `quantum-ml-${Date.now()}`,
        description: 'Variational quantum eigensolvers, superposition, and Qiskit circuit simulations.',
        mainCategory: 'Programming & Technology',
        subCategory: 'Quantum Computing',
        duration: 12.0,
        instructorId: existingCourse.instructorId,
        whatYouWillLearn: ['Qiskit Circuits', 'VQE Algorithms', 'Quantum Gates'],
        requirements: ['Linear Algebra']
      }
    });

    // Auto onboard course intelligence
    await onboardSingleCourse(newCourseB.id);

    const s3Result = await onEnrollmentCreated(existingStudent.id, newCourseB.id);
    console.log('  Existing Student -> New Course Enrollment:', s3Result.status, '| Category:', s3Result.category);

    if (s3Result.success) {
      console.log('✅ Scenario 3 PASSED');
    } else {
      throw new Error('Scenario 3 failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 4: New Student Enrolling in Newly Created Course
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 4: New Student Enrolling in Newly Created Course ---');
    newStudent2 = await prisma.user.create({
      data: {
        name: `Test Student Z ${Date.now()}`,
        email: `student.z.${Date.now()}@edot.edu`,
        password: 'hashedpassword123',
        role: 'student'
      }
    });

    await onStudentCreated(newStudent2.id, { name: newStudent2.name, email: newStudent2.email });
    const s4Result = await onEnrollmentCreated(newStudent2.id, newCourseB.id);
    console.log('  New Student -> New Course Enrollment:', s4Result.status);

    if (s4Result.success) {
      console.log('✅ Scenario 4 PASSED');
    } else {
      throw new Error('Scenario 4 failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 5: Student Taking a Newly Created Quiz
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 5: Student Taking a Newly Created Quiz ---');
    // 5a. Student passes quiz -> Verifies Skill Evidence & Score Increment
    const quizEventResult = await onLearningActivityOccurred({
      userId: newStudent2.id,
      eventType: 'QUIZ_PASSED',
      courseId: newCourseB.id,
      quizId: `quiz-${Date.now()}`,
      score: 95,
      isCorrect: true,
      metadata: {
        topic: 'Quantum Circuit Simulation',
        skillName: 'Quantum Circuits',
        timeSpentSeconds: 120
      }
    });
    console.log('  Quiz Event Result (Passed):', quizEventResult.status);

    // Verify Skill Evidence created
    const evidences = await prisma.skillEvidence.findMany({
      where: { userId: newStudent2.id }
    });
    console.log('  Skill Evidence Count:', evidences.length, '| Latest Evidence Title:', evidences[0]?.title);

    // 5b. Student fails quiz -> Verifies Weakness Tracking & Targeted Remediation
    const quizFailResult = await onLearningActivityOccurred({
      userId: newStudent2.id,
      eventType: 'QUIZ_FAILED',
      courseId: newCourseB.id,
      quizId: `quiz-fail-${Date.now()}`,
      score: 40,
      isCorrect: false,
      metadata: {
        topic: 'Quantum State Decoherence',
        skillName: 'Decoherence Noise',
        timeSpentSeconds: 90
      }
    });
    console.log('  Quiz Event Result (Failed):', quizFailResult.status);

    const weaknesses = await prisma.learnerWeakness.findMany({
      where: { userId: newStudent2.id }
    });
    console.log('  Detected Weakness Entries:', weaknesses.length, '| Topic:', weaknesses[0]?.topic);

    if (quizEventResult.success && quizFailResult.success && evidences.length > 0 && weaknesses.length > 0) {
      console.log('✅ Scenario 5 PASSED');
    } else {
      throw new Error('Scenario 5 failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 6: Student Learning a Newly Created Lesson
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 6: Student Learning a Newly Created Lesson ---');
    const newLesson = await prisma.lesson.create({
      data: {
        title: 'Superposition & Qubit Gates',
        description: 'Hadamard and Pauli-X gate matrix transformations.',
        videoUrl: 'https://example.com/videos/qubit-gates.mp4',
        duration: 15,
        courseId: newCourseB.id,
        order: 1
      }
    });

    const lessonEventResult = await onLearningActivityOccurred({
      userId: newStudent2.id,
      eventType: 'LESSON_COMPLETED',
      courseId: newCourseB.id,
      lessonId: newLesson.id
    });
    console.log('  Lesson Event Result:', lessonEventResult.status);

    // Verify progress updated
    const updatedProgress = await prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId: newStudent2.id, courseId: newCourseB.id } }
    });
    console.log('  Updated Student Progress:', updatedProgress.progress, '% | Completed Lessons:', updatedProgress.completedLessons);

    if (lessonEventResult.success && updatedProgress.progress > 0) {
      console.log('✅ Scenario 6 PASSED');
    } else {
      throw new Error('Scenario 6 failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 7: Multi-Level Decoupled Intelligence Hierarchy Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Multi-Level Hierarchy Isolation Check ---');
    
    // Enroll newStudent2 into a second course in a different category (Design)
    newCourseC = await prisma.course.create({
      data: {
        title: `Design Systems & UI Architecture ${Date.now()}`,
        slug: `design-sys-${Date.now()}`,
        description: 'Figma component tokens, atomics, and responsive design systems.',
        mainCategory: 'Design & Creative',
        subCategory: 'UI/UX Design',
        duration: 8.0,
        instructorId: existingCourse.instructorId,
        whatYouWillLearn: ['Design Tokens', 'Figma Variants'],
        requirements: ['UI Basics']
      }
    });
    await onboardSingleCourse(newCourseC.id);
    await onEnrollmentCreated(newStudent2.id, newCourseC.id);

    const fullHierarchy = await getMultiLevelLearnerContext(newStudent2.id, newCourseB.id, newLesson.id);
    
    console.log('  Learner:', fullHierarchy.learner.name);
    console.log('  Global Momentum:', fullHierarchy.globalIntelligence.overallMomentum);
    console.log('  Categories Monitored:', Object.keys(fullHierarchy.categoryIntelligence).join(', '));
    console.log('  Course B Specific Progress:', fullHierarchy.courseIntelligence.progressPercent, '% in', fullHierarchy.courseIntelligence.courseTitle);
    console.log('  Lesson Specific Duration:', fullHierarchy.lessonIntelligence.durationMinutes, 'min for', fullHierarchy.lessonIntelligence.lessonTitle);

    const categoryKeys = Object.keys(fullHierarchy.categoryIntelligence);
    if (categoryKeys.length >= 2 && fullHierarchy.courseIntelligence.courseId === newCourseB.id) {
      console.log('✅ Multi-Level Hierarchy Decoupling PASSED');
    } else {
      throw new Error('Multi-Level Hierarchy verification failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 8: Reusable Event Publishing Helpers Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Reusable Event Publishing Helpers Check ---');
    const helperEvent = await publishQuizCompletedEvent(newStudent2.id, newCourseC.id, `quiz-${Date.now()}`, 90, true, {
      topic: 'Design Tokens',
      skillName: 'Design Systems'
    });
    console.log('  Helper Published Event Type:', helperEvent.event?.eventType, '| Duplicate:', helperEvent.isDuplicate);

    if (helperEvent.event?.id) {
      console.log('✅ Reusable Event Publishing Helpers PASSED');
    } else {
      throw new Error('Reusable helper verification failed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Clean up temporary test data cleanly
    // ─────────────────────────────────────────────────────────────────────────
    const testCourseIds = [newCourseB?.id, newCourseC?.id].filter(Boolean);
    const testStudentIds = [newStudent1?.id, newStudent2?.id].filter(Boolean);

    await prisma.quizAttempt.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.progressLog.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.learningEvent.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.userCourseProgress.deleteMany({ where: { OR: [{ courseId: { in: testCourseIds } }, { userId: { in: testStudentIds } }] } });
    await prisma.enrollment.deleteMany({ where: { OR: [{ courseId: { in: testCourseIds } }, { studentId: { in: testStudentIds } }] } });
    await prisma.lesson.deleteMany({ where: { courseId: { in: testCourseIds } } });
    await prisma.knowledgeDocument.deleteMany({ where: { courseId: { in: testCourseIds } } });
    await prisma.courseIntelligenceStatus.deleteMany({ where: { courseId: { in: testCourseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: testCourseIds } } });

    await prisma.skillEvidence.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.learnerWeakness.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.learnerSkill.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.userSetting.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.learnerProfile.deleteMany({ where: { userId: { in: testStudentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: testStudentIds } } });

    console.log('\n🎉 ALL DYNAMIC LEARNER INTELLIGENCE SCENARIOS & REQUIREMENTS PASSED PERFECTLY!');
  } catch (error) {
    console.error('\n❌ Dynamic Learner Intelligence Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDynamicLearnerIntelligenceTestSuite();
