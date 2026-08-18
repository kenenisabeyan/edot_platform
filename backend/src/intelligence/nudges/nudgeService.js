/**
 * EDOT Intelligence Domain - Intelligent Nudges Service
 * Manages nudge generation, frequency rate limits (max 2 active nudges per day to prevent fatigue),
 * user preferences, dismissal, and helpfulness metrics.
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateNudgeTriggers } from './nudgeEvaluator.js';
import { NotFoundError, ForbiddenError } from '../shared/errors.js';

/**
 * Evaluates triggers and creates new active nudges while enforcing strict anti-fatigue frequency limits.
 */
export async function evaluateAndGenerateNudges(userId, contextParams = {}) {
  // Check active nudges generated today (Anti-Fatigue Rate Control: Max 2 per day)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countToday = await prisma.intelligentNudge.count({
    where: {
      userId,
      createdAt: { gte: startOfDay }
    }
  });

  if (countToday >= 2) {
    return {
      userId,
      generatedCount: 0,
      rateLimited: true,
      message: 'Anti-fatigue rate limit enforced (Max 2 nudges per day).'
    };
  }

  const candidates = evaluateNudgeTriggers(contextParams);
  const createdNudges = [];

  for (const candidate of candidates) {
    if (countToday + createdNudges.length >= 2) break;

    // Avoid duplicate active nudges for same trigger reason
    const existing = await prisma.intelligentNudge.findFirst({
      where: {
        userId,
        triggerReason: candidate.triggerReason,
        status: 'ACTIVE'
      }
    });

    if (!existing) {
      const nudge = await prisma.intelligentNudge.create({
        data: {
          userId,
          triggerReason: candidate.triggerReason,
          priority: candidate.priority,
          title: candidate.title,
          message: candidate.message,
          recommendedAction: candidate.recommendedAction,
          deliveryChannel: candidate.deliveryChannel,
          expiresAt: candidate.expiresAt,
          status: 'ACTIVE'
        }
      });
      createdNudges.push(nudge);
    }
  }

  return {
    userId,
    generatedCount: createdNudges.length,
    rateLimited: false,
    nudges: createdNudges
  };
}

/**
 * Retrieves unexpired active nudges for a user.
 */
export async function getUserActiveNudges(userId) {
  const now = new Date();

  // Expire stale nudges automatically
  await prisma.intelligentNudge.updateMany({
    where: {
      userId,
      status: 'ACTIVE',
      expiresAt: { lte: now }
    },
    data: { status: 'EXPIRED' }
  });

  const nudges = await prisma.intelligentNudge.findMany({
    where: {
      userId,
      status: 'ACTIVE'
    },
    orderBy: { priority: 'desc' },
    take: 3
  });

  return nudges.map(n => ({
    nudgeId: n.id,
    triggerReason: n.triggerReason,
    priority: n.priority,
    title: n.title,
    message: n.message,
    recommendedAction: n.recommendedAction,
    deliveryChannel: n.deliveryChannel,
    expiresAt: n.expiresAt,
    status: n.status
  }));
}

/**
 * Dismisses an active nudge.
 */
export async function dismissNudge(nudgeId, userId) {
  const nudge = await prisma.intelligentNudge.findUnique({ where: { id: nudgeId } });
  if (!nudge || nudge.userId !== userId) {
    throw new ForbiddenError('Not authorized to dismiss this nudge');
  }

  const updated = await prisma.intelligentNudge.update({
    where: { id: nudgeId },
    data: { status: 'DISMISSED' }
  });

  return {
    nudgeId: updated.id,
    status: updated.status,
    dismissedAt: updated.updatedAt
  };
}

/**
 * Rates the helpfulness of a nudge (HELPFUL vs UNHELPFUL).
 */
export async function rateNudgeHelpfulness(nudgeId, userId, rating = 'HELPFUL') {
  const nudge = await prisma.intelligentNudge.findUnique({ where: { id: nudgeId } });
  if (!nudge || nudge.userId !== userId) {
    throw new ForbiddenError('Not authorized to rate this nudge');
  }

  const updated = await prisma.intelligentNudge.update({
    where: { id: nudgeId },
    data: { helpfulnessRating: rating }
  });

  return {
    nudgeId: updated.id,
    helpfulnessRating: updated.helpfulnessRating
  };
}
