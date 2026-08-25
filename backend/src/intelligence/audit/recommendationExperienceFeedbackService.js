/**
 * EDOT Intelligence Domain - Recommendation Feedback & Quality Loop Service
 * Manages lightweight student feedback on recommendations (HELPFUL, NOT_NOW, NOT_RELEVANT, ALREADY_DONE, SHOW_FEWER)
 * and prevents stale suggestions without destroying underlying learner intelligence.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

/**
 * Records student feedback for a recommendation.
 */
export async function recordRecommendationFeedback(userId, recommendationId, feedbackType) {
  assertValidUUID(userId, 'userId');

  const validTypes = ['HELPFUL', 'NOT_NOW', 'NOT_RELEVANT', 'ALREADY_DONE', 'SHOW_FEWER'];
  if (!validTypes.includes(feedbackType)) {
    throw new Error(`Invalid feedbackType: ${feedbackType}`);
  }

  const feedback = await prisma.recommendationFeedback.create({
    data: {
      userId,
      recommendationId: String(recommendationId),
      feedbackType
    }
  });

  // Log telemetry event
  await prisma.productExperienceEvent.create({
    data: {
      userId,
      eventType: feedbackType === 'HELPFUL' ? 'ACTIONED' : 'DISMISSED',
      featureKey: 'NEXT_BEST_STEP',
      metadata: { recommendationId, feedbackType }
    }
  });

  return feedback;
}

/**
 * Checks if a specific recommendation should be suppressed for a student based on prior feedback.
 */
export async function shouldSuppressRecommendation(userId, recommendationId) {
  assertValidUUID(userId, 'userId');

  const feedbackList = await prisma.recommendationFeedback.findMany({
    where: { userId, recommendationId: String(recommendationId) },
    orderBy: { createdAt: 'desc' }
  });

  if (feedbackList.length === 0) return false;

  const latest = feedbackList[0].feedbackType;
  if (['ALREADY_DONE', 'NOT_RELEVANT', 'SHOW_FEWER'].includes(latest)) {
    return true;
  }

  if (latest === 'NOT_NOW' && feedbackList.length >= 2) {
    return true;
  }

  return false;
}
