/**
 * EDOT Intelligence Domain - Intelligence Feedback Loops Service
 * Records behavioral feedback (SHOWN, ACCEPTED, IGNORED, DISMISSED, COMPLETED, FAILED, HELPFUL, NOT_HELPFUL, OVERRIDE)
 * and provides feedback-aware ranking re-computations.
 */

import { prisma } from '../../../lib/prisma.js';
import { calculateFeedbackAffinityOffset, rankItemsWithFeedback } from './feedbackRankingEngine.js';
import { ValidationError } from '../shared/errors.js';

const VALID_FEEDBACK_TYPES = [
  'SHOWN', 'ACCEPTED', 'IGNORED', 'DISMISSED',
  'COMPLETED', 'FAILED', 'HELPFUL', 'NOT_HELPFUL', 'OVERRIDE'
];

/**
 * Records behavioral feedback for any intelligence feature.
 */
export async function recordIntelligenceFeedback(userId, {
  domain = 'RECOMMENDATION',
  targetId,
  feedbackType,
  reason = null,
  optionalFeedback = null,
  metadata = {}
}) {
  if (!targetId || !feedbackType) {
    throw new ValidationError('targetId and feedbackType are required.');
  }

  const normalizedType = feedbackType.toUpperCase();
  if (!VALID_FEEDBACK_TYPES.includes(normalizedType)) {
    throw new ValidationError(`Invalid feedbackType. Allowed values: ${VALID_FEEDBACK_TYPES.join(', ')}`);
  }

  const feedback = await prisma.intelligenceFeedback.create({
    data: {
      userId,
      domain,
      targetId,
      feedbackType: normalizedType,
      reason,
      optionalFeedback,
      metadata
    }
  });

  return {
    feedbackId: feedback.id,
    domain: feedback.domain,
    targetId: feedback.targetId,
    feedbackType: feedback.feedbackType,
    createdAt: feedback.createdAt
  };
}

/**
 * Returns feedback analytics summary for a given domain or all domains.
 */
export async function getFeedbackAnalyticsSummary(domain = null) {
  const where = domain ? { domain } : {};

  const totalCount = await prisma.intelligenceFeedback.count({ where });
  const typeCounts = await prisma.intelligenceFeedback.groupBy({
    by: ['feedbackType'],
    where,
    _count: { id: true }
  });

  const breakdown = {};
  typeCounts.forEach(t => {
    breakdown[t.feedbackType] = t._count.id;
  });

  const helpful = breakdown['HELPFUL'] || 0;
  const notHelpful = breakdown['NOT_HELPFUL'] || 0;
  const helpfulnessPct = (helpful + notHelpful) > 0 ? Number(((helpful / (helpful + notHelpful)) * 100).toFixed(1)) : 100.0;

  return {
    domain: domain || 'ALL_DOMAINS',
    totalFeedbackRecords: totalCount,
    breakdown,
    helpfulnessRatePct: helpfulnessPct
  };
}

/**
 * Re-ranks candidate items applying user feedback history.
 */
export async function getAdjustedRankingForItems(userId, domain, items = []) {
  const feedbackRecords = await prisma.intelligenceFeedback.findMany({
    where: { userId, domain }
  });

  const feedbackMap = new Map();
  feedbackRecords.forEach(rec => {
    const arr = feedbackMap.get(rec.targetId) || [];
    arr.push(rec);
    feedbackMap.set(rec.targetId, arr);
  });

  return rankItemsWithFeedback(items, feedbackMap);
}
