/**
 * EDOT Intelligence — Personal Learning Engine Complete Test Suite
 * 
 * Verifies signal synthesis, Next Best Action evaluation, learning plan generation,
 * and closed feedback loop (↺).
 */

import { prisma } from '../lib/prisma.js';
import { findOrCreateKnowledgeNode } from '../src/intelligence/knowledge/knowledgeGraphService.js';
import { createKnowledgeRelationship } from '../src/intelligence/knowledge/prerequisiteService.js';
import { recordConceptEvidence } from '../src/intelligence/mastery/conceptEvidenceService.js';
import { resolveMasteryState } from '../src/intelligence/mastery/masteryStateResolver.js';
import { evaluateNextBestAction } from '../src/intelligence/learningEngine/personalLearningEngine.js';
import { updateStudentLearningPlan, getStudentLearningPlan, completeLearningAction } from '../src/intelligence/learningEngine/adaptiveLearningPlanService.js';

const sleep = (ms = 150) => new Promise(r => setTimeout(r, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runPersonalLearningEngineTestSuite() {
  console.log('🧪 Starting EDOT Personal Learning Engine Test Suite...\n');

  let testInstructor;
  let testStudent;
  let testCourse;
  let testSection;
  let testLesson;
  let nodeA;
  let nodeB;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // FIXTURE SETUP
    // ─────────────────────────────────────────────────────────────────────────
    testInstructor = await prisma.user.create({
      data: { name: 'Engine Inst', email: `eng_inst_${Date.now()}@test.com`, password: 'hashedpassword', role: 'instructor' }
    });

    testStudent = await prisma.user.create({
      data: { name: 'Engine Student', email: `eng_stud_${Date.now()}@test.com`, password: 'hashedpassword', role: 'student' }
    });

    await prisma.learnerProfile.create({
      data: { userId: testStudent.id }
    });

    testCourse = await prisma.course.create({
      data: {
        title: 'Personal Learning Engine Course',
        slug: `ple-course-${Date.now()}`,
        description: 'Test course for Personal Learning Engine',
        instructorId: testInstructor.id,
        mainCategory: 'Computer Science',
        subCategory: 'Engine',
        duration: 20,
        price: 0
      }
    });

    testLesson = await prisma.lesson.create({
      data: {
        title: 'Lesson 1: Intro',
        description: 'Test lesson description',
        videoUrl: 'https://video.com/1',
        duration: 10,
        courseId: testCourse.id,
        order: 1
      }
    });

    await prisma.enrollment.create({
      data: { studentId: testStudent.id, courseId: testCourse.id, status: 'approved' }
    });

    nodeA = await findOrCreateKnowledgeNode({ name: 'Engine Foundation Node A', type: 'CONCEPT' });
    nodeB = await findOrCreateKnowledgeNode({ name: 'Engine Advanced Node B', type: 'CONCEPT' });

    await createKnowledgeRelationship({
      sourceNodeId: nodeA.id,
      targetNodeId: nodeB.id,
      relationType: 'PREREQUISITE_OF'
    });

    console.log(`Setup complete. Student ID: ${testStudent.id}, Course ID: ${testCourse.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: CONTINUE action when starting course
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: CONTINUE Progression Action ---');
    const action1 = await evaluateNextBestAction(testStudent.id, testCourse.id);
    assert(action1.actionType === 'CONTINUE', `Expected CONTINUE action, got ${action1.actionType}`);
    assert(action1.targetLessonId === testLesson.id, 'Target lesson matches next uncompleted lesson');
    console.log('✅ Scenario 1 PASSED: Default CONTINUE progression action generated.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: PREREQUISITE action when prerequisite gap detected
    // ─────────────────────────────────────────────────────────────────────────
    await sleep();
    console.log('\n--- Scenario 2: PREREQUISITE Action on Gap ---');
    // Student attempts advanced node B without mastering node A
    await recordConceptEvidence({
      studentId: testStudent.id,
      nodeId: nodeB.id,
      courseId: testCourse.id,
      sourceType: 'QUIZ_ATTEMPT',
      value: 0.2
    });
    await resolveMasteryState(testStudent.id, nodeB.id, testCourse.id);

    const action2 = await evaluateNextBestAction(testStudent.id, testCourse.id);
    assert(action2.actionType === 'PREREQUISITE', `Expected PREREQUISITE action, got ${action2.actionType}`);
    assert(action2.targetNodeId === nodeA.id, 'Target node matches prerequisite node A');
    console.log('✅ Scenario 2 PASSED: PREREQUISITE action generated on gap.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: PRACTICE action on retention decay
    // ─────────────────────────────────────────────────────────────────────────
    await sleep();
    console.log('\n--- Scenario 3: PRACTICE Action on Weak/Decaying Concept ---');
    // Master node A and node B
    for (let i = 1; i <= 5; i++) {
      await recordConceptEvidence({
        studentId: testStudent.id,
        nodeId: nodeA.id,
        courseId: testCourse.id,
        sourceType: 'QUIZ_ATTEMPT',
        sourceId: `ev-master-a-${i}`,
        value: 0.95
      });
      await recordConceptEvidence({
        studentId: testStudent.id,
        nodeId: nodeB.id,
        courseId: testCourse.id,
        sourceType: 'QUIZ_ATTEMPT',
        sourceId: `ev-master-b-${i}`,
        value: 0.95
      });
    }
    await resolveMasteryState(testStudent.id, nodeA.id, testCourse.id);
    await resolveMasteryState(testStudent.id, nodeB.id, testCourse.id);

    // Simulate decay factor on node A
    await prisma.learnerConceptMastery.update({
      where: { userId_nodeId: { userId: testStudent.id, nodeId: nodeA.id } },
      data: { decayFactor: 0.70, masteryState: 'NEEDS_REINFORCEMENT' }
    });

    const action3 = await evaluateNextBestAction(testStudent.id, testCourse.id);
    assert(action3.actionType === 'PRACTICE' || action3.actionType === 'REVIEW', `Expected PRACTICE/REVIEW action, got ${action3.actionType}`);
    assert(action3.targetNodeId === nodeA.id, 'Target node matches decaying node A');
    console.log('✅ Scenario 3 PASSED: PRACTICE action generated on retention decay.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: SUPPORT action on high fatigue / frequent failures
    // ─────────────────────────────────────────────────────────────────────────
    await sleep();
    console.log('\n--- Scenario 4: SUPPORT Action on High Fatigue ---');
    for (let i = 0; i < 9; i++) {
      await prisma.learningEvent.create({
        data: {
          userId: testStudent.id,
          courseId: testCourse.id,
          eventType: 'QUIZ_ATTEMPT',
          metadata: { isCorrect: false }
        }
      });
    }

    const action4 = await evaluateNextBestAction(testStudent.id, testCourse.id);
    assert(action4.actionType === 'SUPPORT', `Expected SUPPORT action on high fatigue, got ${action4.actionType}`);
    console.log('✅ Scenario 4 PASSED: SUPPORT action generated on high fatigue.');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: Closed Feedback Loop (↺) Completion Execution
    // ─────────────────────────────────────────────────────────────────────────
    await sleep();
    console.log('\n--- Scenario 5: Closed Feedback Loop (↺) Execution ---');
    const planResult = await updateStudentLearningPlan(testStudent.id, testCourse.id);
    assert(planResult.plan !== undefined, 'Plan generated successfully');
    assert(planResult.nextBestAction !== undefined, 'Next best action record created');

    const completed = await completeLearningAction(planResult.nextBestAction.id, testStudent.id);
    assert(completed.completedAction.status === 'COMPLETED', 'Action status updated to COMPLETED');
    assert(completed.updatedPlan !== undefined, 'Triggers real-time Next Best Action recalculation loop (↺)');
    console.log('✅ Scenario 5 PASSED: Closed feedback loop (↺) completed successfully.');

    console.log('\n🎉 ALL PERSONAL LEARNING ENGINE TEST SCENARIOS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Personal Learning Engine Test Suite Error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await prisma.personalizedLearningAction.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.studentLearningPlan.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.learningEvent.deleteMany({ where: { userId: testStudent.id } });
    await prisma.masteryEvidence.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.learnerConceptMastery.deleteMany({ where: { userId: testStudent.id } });
    if (nodeA && nodeB) {
      await prisma.knowledgeNode.deleteMany({ where: { id: { in: [nodeA.id, nodeB.id] } } });
    }
    await prisma.enrollment.deleteMany({ where: { courseId: testCourse.id } });
    await prisma.lesson.deleteMany({ where: { courseId: testCourse.id } });
    await prisma.course.delete({ where: { id: testCourse.id } });
    await prisma.learnerProfile.deleteMany({ where: { userId: testStudent.id } });
    await prisma.user.deleteMany({ where: { id: { in: [testInstructor.id, testStudent.id] } } });
    await prisma.$disconnect();
  }
}

runPersonalLearningEngineTestSuite();
