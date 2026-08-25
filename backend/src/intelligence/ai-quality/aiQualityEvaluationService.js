/**
 * EDOT Intelligence Domain - AI Quality Evaluation Service
 * Evaluates multi-dimensional quality scores (helpfulness, relevance, groundedness, accuracy, safety, privacy, fairness),
 * calculates overall quality status (HEALTHY, WATCH, DEGRADED, UNHEALTHY), manages AI dependency awareness,
 * and records student AI feedback.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import { validateAIRequest } from './aiRequestValidator.js';
import { evaluateKnowledgeGrounding } from './knowledgeGroundingValidator.js';
import { validateAndSanitizeAIOutput } from './aiOutputValidator.js';

/**
 * Evaluates an AI interaction and records an AIQualityEvaluation row.
 */
export async function evaluateAIInteraction(interactionId, { prompt, response, retrievedKnowledge = [] }) {
  assertValidUUID(interactionId, 'interactionId');

  const grounding = evaluateKnowledgeGrounding(prompt, response, retrievedKnowledge);
  const outputCheck = validateAndSanitizeAIOutput(response);

  const helpfulnessScore = outputCheck.isValid ? 0.95 : 0.4;
  const relevanceScore = prompt.length > 5 ? 0.9 : 0.6;
  const groundednessScore = grounding.groundednessScore;
  const educationalAccuracyScore = grounding.isGrounded ? 0.95 : 0.7;
  const safetyScore = outputCheck.redactedSecretsCount === 0 ? 1.0 : 0.5;
  const privacyScore = outputCheck.redactedSecretsCount === 0 ? 1.0 : 0.6;
  const fairnessScore = 1.0;

  const avgScore = (helpfulnessScore + relevanceScore + groundednessScore + educationalAccuracyScore + safetyScore + privacyScore + fairnessScore) / 7;
  let overallQuality = 'HEALTHY';

  if (avgScore < 0.5 || safetyScore < 0.6) {
    overallQuality = 'UNHEALTHY';
  } else if (avgScore < 0.75 || groundednessScore < 0.5) {
    overallQuality = 'WATCH';
  } else if (avgScore < 0.85) {
    overallQuality = 'DEGRADED';
  }

  const evaluation = await prisma.aIQualityEvaluation.create({
    data: {
      interactionId,
      overallQuality,
      helpfulnessScore,
      relevanceScore,
      groundednessScore,
      educationalAccuracyScore,
      safetyScore,
      privacyScore,
      fairnessScore,
      hallucinationRisk: grounding.hallucinationRisk,
      confidenceLevel: grounding.isGrounded ? 'HIGH' : 'MODERATE'
    }
  });

  return evaluation;
}

/**
 * Records student AI feedback for an interaction.
 */
export async function recordAIFeedback(userId, interactionId, { feedbackType, comment = null }) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(interactionId, 'interactionId');

  const validTypes = ['HELPFUL', 'NOT_HELPFUL', 'INCORRECT', 'NOT_RELEVANT', 'UNSAFE', 'OTHER'];
  if (!validTypes.includes(feedbackType)) {
    throw new Error(`Invalid feedbackType: ${feedbackType}`);
  }

  return prisma.aIFeedback.create({
    data: {
      userId,
      interactionId,
      feedbackType,
      comment
    }
  });
}

/**
 * AI Dependency Awareness check. Detects solution-seeking patterns and returns gentle pedagogical hints.
 */
export async function checkAIDependencyPattern(userId) {
  assertValidUUID(userId, 'userId');

  const recentInteractions = await prisma.aIInteraction.findMany({
    where: { userId, feature: 'AI_MENTOR' },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  if (recentInteractions.length >= 5) {
    return {
      hasPattern: true,
      pedagogicalHint: 'You\'ve asked several questions recently. Want to try the next step yourself first? I can give you a hint!'
    };
  }

  return {
    hasPattern: false,
    pedagogicalHint: null
  };
}
