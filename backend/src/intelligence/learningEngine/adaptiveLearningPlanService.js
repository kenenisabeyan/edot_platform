/**
 * EDOT Intelligence Domain - Adaptive Learning Plan Service
 * 
 * Manages the active StudentLearningPlan and completes the adaptive feedback loop (↺).
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateNextBestAction } from './personalLearningEngine.js';

/**
 * Updates or creates the active adaptive StudentLearningPlan for a student and course.
 */
export async function updateStudentLearningPlan(studentId, courseId) {
  // 1. Evaluate Next Best Learning Action
  const nextActionData = await evaluateNextBestAction(studentId, courseId);

  // 2. Upsert Student Learning Plan record
  const plan = await prisma.studentLearningPlan.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: {
      studentId,
      courseId,
      status: 'ACTIVE',
      currentFocusNodeId: nextActionData.targetNodeId,
      recommendedActions: nextActionData,
      lastUpdated: new Date()
    },
    update: {
      status: 'ACTIVE',
      currentFocusNodeId: nextActionData.targetNodeId,
      recommendedActions: nextActionData,
      lastUpdated: new Date()
    }
  });

  // 3. Create PersonalizedLearningAction record
  const actionRecord = await prisma.personalizedLearningAction.create({
    data: {
      planId: plan.id,
      studentId,
      courseId,
      actionType: nextActionData.actionType,
      targetNodeId: nextActionData.targetNodeId,
      targetLessonId: nextActionData.targetLessonId,
      priorityScore: nextActionData.priorityScore,
      reason: nextActionData.reason,
      status: 'PENDING'
    }
  });

  return {
    plan,
    nextBestAction: actionRecord
  };
}

/**
 * Retrieves the active adaptive learning plan and recent recommended actions.
 */
export async function getStudentLearningPlan(studentId, courseId) {
  const plan = await prisma.studentLearningPlan.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      actions: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!plan) {
    return updateStudentLearningPlan(studentId, courseId);
  }

  return plan;
}

/**
 * Marks a PersonalizedLearningAction completed, fires telemetry event, and closes the adaptive feedback loop (↺).
 */
export async function completeLearningAction(actionId, studentId) {
  const action = await prisma.personalizedLearningAction.findUnique({
    where: { id: actionId }
  });

  if (!action) {
    throw new Error(`PersonalizedLearningAction with ID ${actionId} not found.`);
  }

  if (action.studentId !== studentId) {
    throw new Error('Forbidden: Student does not own this action.');
  }

  // Update action status to COMPLETED
  const updatedAction = await prisma.personalizedLearningAction.update({
    where: { id: actionId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date()
    }
  });

  // Emit LearningEvent Telemetry to complete feedback loop (↺)
  try {
    await prisma.learningEvent.create({
      data: {
        userId: studentId,
        courseId: action.courseId,
        eventType: 'PERSONAL_ACTION_COMPLETED',
        metadata: {
          actionId: action.id,
          actionType: action.actionType,
          targetNodeId: action.targetNodeId,
          completedAt: new Date()
        }
      }
    });
  } catch (e) {
    // Failure isolation: Telemetry failure does not roll back action completion
    console.error('LearningEvent telemetry error isolated:', e);
  }

  // Trigger real-time recalculation of Next Best Action for feedback loop (↺)
  const updatedPlan = await updateStudentLearningPlan(studentId, action.courseId);

  return {
    completedAction: updatedAction,
    updatedPlan
  };
}
