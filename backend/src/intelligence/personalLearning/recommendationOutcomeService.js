/**
 * EDOT Intelligence Domain - Recommendation Outcome Service (Phase 10)
 * 
 * Manages action lifecycles (GENERATED -> VIEWED -> STARTED -> COMPLETED / DISMISSED / SUPERSEDED)
 * and records outcomes to complete the closed-loop adaptation ecosystem (Phase 7 + Phase 10).
 */

import { prisma } from '../../../lib/prisma.js';
import { getOrUpdateLearningPlan } from './learningPlanService.js';

export const ACTION_STATUSES = [
  'GENERATED',
  'VIEWED',
  'STARTED',
  'COMPLETED',
  'DISMISSED',
  'EXPIRED',
  'SUPERSEDED'
];

/**
 * Updates the lifecycle status of a PersonalizedLearningAction.
 * 
 * @param {string} actionId 
 * @param {string} studentId 
 * @param {string} newStatus 
 * @param {object} [outcomeData] 
 */
export async function updateActionLifecycle(actionId, studentId, newStatus, outcomeData = null) {
  const action = await prisma.personalizedLearningAction.findUnique({
    where: { id: actionId }
  });

  if (!action) {
    throw new Error(`PersonalizedLearningAction with ID ${actionId} not found.`);
  }

  if (action.studentId !== studentId) {
    throw new Error('Forbidden: Student does not own this learning action.');
  }

  const updateData = {
    status: newStatus,
    updatedAt: new Date()
  };

  if (newStatus === 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  if (outcomeData) {
    updateData.outcome = outcomeData;
  }

  const updatedAction = await prisma.personalizedLearningAction.update({
    where: { id: actionId },
    data: updateData
  });

  // Emit LearningEvent telemetry for outcome monitoring
  try {
    await prisma.learningEvent.create({
      data: {
        userId: studentId,
        courseId: action.courseId,
        eventType: `RECOMMENDATION_ACTION_${newStatus}`,
        metadata: {
          actionId: action.id,
          actionType: action.actionType,
          targetNodeId: action.targetNodeId,
          targetLessonId: action.targetLessonId,
          status: newStatus,
          outcome: outcomeData
        }
      }
    });
  } catch (e) {
    // Failure isolation: Telemetry failure does not roll back action status change
    console.error('LearningEvent telemetry error isolated:', e);
  }

  // Recalculate learning plan to update feedback loop
  const updatedPlan = await getOrUpdateLearningPlan(studentId, action.courseId);

  return {
    updatedAction,
    updatedPlan
  };
}
