/**
 * EDOT Intelligence Domain - Learning Plan Service (Phase 10)
 * 
 * Manages active dynamic StudentLearningPlan records and action creation.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveLearnerContext } from './learnerContextResolver.js';
import { resolveCandidateActions } from './nextActionResolver.js';
import { rankRecommendations } from './recommendationRanker.js';
import { generateExplanation } from './recommendationExplanationService.js';

export async function getOrUpdateLearningPlan(studentId, courseId = null) {
  // 1. Resolve Learner Context
  const context = await resolveLearnerContext(studentId, courseId);
  const activeCourseId = context.activeCourseId;

  if (!activeCourseId) {
    return { plan: null, primaryAction: null, secondaryActions: [] };
  }

  // 2. Resolve Candidate Actions & Rank
  const candidates = await resolveCandidateActions(context);
  const ranked = rankRecommendations(candidates);

  const primary = ranked.primary;
  const secondary = ranked.secondary;

  // 3. Upsert Student Learning Plan
  const plan = await prisma.studentLearningPlan.upsert({
    where: { studentId_courseId: { studentId, courseId: activeCourseId } },
    create: {
      studentId,
      courseId: activeCourseId,
      status: 'ACTIVE',
      currentFocusNodeId: primary ? primary.targetNodeId : null,
      recommendedActions: { primary, secondary },
      lastUpdated: new Date()
    },
    update: {
      status: 'ACTIVE',
      currentFocusNodeId: primary ? primary.targetNodeId : null,
      recommendedActions: { primary, secondary },
      lastUpdated: new Date()
    }
  });

  // 4. Create primary PersonalizedLearningAction if not existing PENDING/GENERATED action
  let primaryActionRecord = null;
  if (primary) {
    const existing = await prisma.personalizedLearningAction.findFirst({
      where: {
        planId: plan.id,
        actionType: primary.actionType,
        targetNodeId: primary.targetNodeId,
        targetLessonId: primary.targetLessonId,
        status: { in: ['GENERATED', 'VIEWED', 'STARTED'] }
      }
    });

    if (existing) {
      primaryActionRecord = existing;
    } else {
      primaryActionRecord = await prisma.personalizedLearningAction.create({
        data: {
          planId: plan.id,
          studentId,
          courseId: activeCourseId,
          actionType: primary.actionType,
          targetNodeId: primary.targetNodeId,
          targetLessonId: primary.targetLessonId,
          priorityScore: primary.priorityScore,
          reason: primary.reason,
          explanation: generateExplanation(primary, context),
          status: 'GENERATED'
        }
      });
    }

    await prisma.studentLearningPlan.update({
      where: { id: plan.id },
      data: { primaryActionId: primaryActionRecord.id }
    });
  }

  return {
    plan,
    primaryAction: primaryActionRecord,
    secondaryActions: secondary
  };
}
