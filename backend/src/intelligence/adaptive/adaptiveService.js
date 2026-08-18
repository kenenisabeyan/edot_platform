/**
 * EDOT Intelligence Domain - Adaptive Learning Service
 * Manages persistence and retrieval of adaptive plans, paths, and learner feedback loops.
 */

import { prisma } from '../../../lib/prisma.js';
import { calculateAdaptivePath } from './adaptiveCalculator.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';

/**
 * Synchronizes and persists a learner's adaptive plan.
 * 
 * @param {string} userId 
 */
export async function syncAdaptiveLearningPlan(userId) {
  const [
    goals,
    progressRecords,
    quizAttempts,
    skills,
    weaknesses,
    profile
  ] = await Promise.all([
    prisma.learnerGoal.findMany({ where: { profile: { userId } } }),
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true } } }
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    prisma.learnerSkill.findMany({ where: { userId } }),
    prisma.learnerWeakness.findMany({ where: { userId } }),
    prisma.learnerProfile.findUnique({ where: { userId } })
  ]);

  const calculated = calculateAdaptivePath({
    goals,
    progressRecords,
    quizAttempts,
    skills,
    weaknesses,
    profile: profile || {}
  });

  // Upsert AdaptiveLearningPlan in PostgreSQL
  const existingPlan = await prisma.adaptiveLearningPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  let plan;
  if (existingPlan) {
    plan = await prisma.adaptiveLearningPlan.update({
      where: { id: existingPlan.id },
      data: {
        planType: calculated.planType,
        paceMode: calculated.paceMode,
        suggestedSequence: calculated.suggestedSequence,
        summaryExplanation: calculated.summaryExplanation,
        adaptedAt: new Date()
      }
    });

    // Refresh recommendations & milestones
    await prisma.adaptiveRecommendation.deleteMany({ where: { planId: plan.id } });
    await prisma.milestoneProgress.deleteMany({ where: { planId: plan.id } });
  } else {
    plan = await prisma.adaptiveLearningPlan.create({
      data: {
        userId,
        planType: calculated.planType,
        paceMode: calculated.paceMode,
        suggestedSequence: calculated.suggestedSequence,
        summaryExplanation: calculated.summaryExplanation
      }
    });
  }

  // Create recommendations & milestones
  for (const rec of calculated.recommendations) {
    await prisma.adaptiveRecommendation.create({
      data: {
        planId: plan.id,
        userId,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        reason: rec.reason,
        evidence: rec.evidence,
        status: 'RECOMMENDED'
      }
    });
  }

  for (const ms of calculated.milestones) {
    await prisma.milestoneProgress.create({
      data: {
        planId: plan.id,
        userId,
        milestoneTitle: ms.milestoneTitle,
        description: ms.description,
        progress: ms.progress
      }
    });
  }

  return getAdaptiveLearningPlan(userId);
}

/**
 * Retrieves the full adaptive learning plan for a learner.
 * 
 * @param {string} userId 
 */
export async function getAdaptiveLearningPlan(userId) {
  let plan = await prisma.adaptiveLearningPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      recommendations: true,
      milestones: true
    }
  });

  if (!plan) {
    plan = await syncAdaptiveLearningPlan(userId);
  }

  return plan;
}

/**
 * Retrieves simplified adaptive path DTO for UI navigation.
 * 
 * @param {string} userId 
 */
export async function getAdaptivePath(userId) {
  const plan = await getAdaptiveLearningPlan(userId);
  return {
    planType: plan.planType,
    paceMode: plan.paceMode,
    summaryExplanation: plan.summaryExplanation,
    suggestedSequence: plan.suggestedSequence,
    recommendations: plan.recommendations,
    milestones: plan.milestones
  };
}

/**
 * Submits feedback for an adaptive recommendation (Was this helpful? Yes/No, Why?).
 * 
 * @param {string} userId 
 * @param {string} recommendationId 
 * @param {boolean} isHelpful 
 * @param {string} [feedbackComment] 
 */
export async function submitAdaptiveFeedback(userId, recommendationId, isHelpful, feedbackComment) {
  if (isHelpful === undefined || typeof isHelpful !== 'boolean') {
    throw new ValidationError('isHelpful boolean is required');
  }

  const rec = await prisma.adaptiveRecommendation.findFirst({
    where: { id: recommendationId, userId }
  });

  if (!rec) {
    throw new NotFoundError(`Adaptive recommendation [${recommendationId}] not found`);
  }

  return prisma.adaptiveRecommendation.update({
    where: { id: rec.id },
    data: {
      isHelpful,
      feedbackComment: feedbackComment ? String(feedbackComment).trim() : null,
      status: isHelpful ? 'ACCEPTED' : 'DECLINED'
    }
  });
}
