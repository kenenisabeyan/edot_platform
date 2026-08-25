/**
 * EDOT Intelligence Domain - AI Quality Orchestrator
 * Master orchestrator for Phase 19 coordinating prompt injection defense, knowledge grounding,
 * output validation, multi-dimensional quality scoring, incident tracking, model regression testing,
 * and AI Quality Center admin metrics with failure isolation.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import { validateAIRequest, REQUEST_RISK_LEVELS } from './aiRequestValidator.js';
import { evaluateKnowledgeGrounding, HALLUCINATION_RISKS } from './knowledgeGroundingValidator.js';
import { validateAndSanitizeAIOutput } from './aiOutputValidator.js';
import { evaluateAIInteraction, recordAIFeedback, checkAIDependencyPattern } from './aiQualityEvaluationService.js';
import { createAIIncident, updateIncidentStatus } from './aiIncidentService.js';
import {
  createAIEvaluationDataset,
  addAIEvaluationCase,
  runModelEvaluation,
  detectModelRegression
} from './aiRegressionEvaluator.js';

export {
  validateAIRequest,
  REQUEST_RISK_LEVELS,
  evaluateKnowledgeGrounding,
  HALLUCINATION_RISKS,
  validateAndSanitizeAIOutput,
  evaluateAIInteraction,
  recordAIFeedback,
  checkAIDependencyPattern,
  createAIIncident,
  updateIncidentStatus,
  createAIEvaluationDataset,
  addAIEvaluationCase,
  runModelEvaluation,
  detectModelRegression
};

/**
 * Standardized AI Interaction Handler enforcing full interaction lifecycle and failure isolation.
 */
export async function processAIInteraction(userId, { prompt, feature = 'AI_MENTOR', interactionType = 'CHAT_RESPONSE', retrievedKnowledge = [], generatorFn }) {
  assertValidUUID(userId, 'userId');

  const startTime = Date.now();

  // 1. RECEIVED & VALIDATED
  const requestCheck = validateAIRequest(userId, prompt, feature);

  // Create initial AIInteraction row
  const interaction = await prisma.aIInteraction.create({
    data: {
      userId,
      feature,
      interactionType,
      requestStatus: requestCheck.isBlocked ? 'BLOCKED' : 'SAFETY_CHECKED',
      responseStatus: requestCheck.isBlocked ? 'BLOCKED' : 'DELIVERED',
      latencyMs: 0
    }
  });

  if (requestCheck.isBlocked) {
    // Log incident
    await createAIIncident({
      category: 'PROMPT_INJECTION_ATTEMPT',
      severity: 'HIGH',
      summary: `Prompt injection attempt detected for feature ${feature}`,
      createdBy: userId
    }).catch(() => {});

    return {
      interactionId: interaction.id,
      responseStatus: 'BLOCKED',
      deliveredResponse: 'I can only assist with authorized educational learning topics.',
      isFallback: true
    };
  }

  // 2. GENERATING
  let rawOutput = '';
  try {
    if (typeof generatorFn === 'function') {
      rawOutput = await generatorFn(requestCheck.sanitizedPrompt);
    } else {
      rawOutput = 'I am your EDOT AI Mentor. How can I help you with your course today?';
    }
  } catch (err) {
    // Failure isolation: Provider failure fallback
    await prisma.aIInteraction.update({
      where: { id: interaction.id },
      data: { requestStatus: 'FAILED', responseStatus: 'FALLBACK_DELIVERED', latencyMs: Date.now() - startTime }
    });

    return {
      interactionId: interaction.id,
      responseStatus: 'FALLBACK_DELIVERED',
      deliveredResponse: 'I am experiencing a temporary connection issue. You can review your course material or try again shortly.',
      isFallback: true
    };
  }

  // 3. OUTPUT_VALIDATED & KNOWLEDGE GROUNDING
  const outputCheck = validateAndSanitizeAIOutput(rawOutput);
  const grounding = evaluateKnowledgeGrounding(prompt, outputCheck.sanitizedOutput, retrievedKnowledge);

  let finalResponse = outputCheck.sanitizedOutput;
  let isFallback = false;

  if (grounding.fallbackMessage) {
    finalResponse = grounding.fallbackMessage;
    isFallback = true;
  }

  // 4. EVALUATED (Failure isolated)
  evaluateAIInteraction(interaction.id, {
    prompt,
    response: finalResponse,
    retrievedKnowledge
  }).catch(() => {});

  const latencyMs = Date.now() - startTime;

  await prisma.aIInteraction.update({
    where: { id: interaction.id },
    data: {
      requestStatus: 'DELIVERED',
      responseStatus: isFallback ? 'FALLBACK_DELIVERED' : 'DELIVERED',
      latencyMs
    }
  });

  return {
    interactionId: interaction.id,
    responseStatus: isFallback ? 'FALLBACK_DELIVERED' : 'DELIVERED',
    deliveredResponse: finalResponse,
    isFallback
  };
}

/**
 * Admin AI Quality Center overview metrics & health scorecard.
 */
export async function getAIQualityCenterOverview() {
  const [totalInteractions, totalFeedbacks, openIncidents, evaluations] = await Promise.all([
    prisma.aIInteraction.count(),
    prisma.aIFeedback.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
    prisma.aIIncident.count({ where: { status: 'OPEN' } }),
    prisma.aIQualityEvaluation.findMany({ take: 100, orderBy: { createdAt: 'desc' } })
  ]);

  const helpfulCount = totalFeedbacks.filter(f => f.feedbackType === 'HELPFUL').length;
  const helpfulnessPercent = totalFeedbacks.length > 0 ? Math.round((helpfulCount / totalFeedbacks.length) * 100) : 100;

  const lowRiskCount = evaluations.filter(e => e.hallucinationRisk === 'LOW_RISK').length;
  const groundednessPercent = evaluations.length > 0 ? Math.round((lowRiskCount / evaluations.length) * 100) : 100;

  return {
    scorecard: {
      helpfulness: helpfulnessPercent >= 80 ? 'Healthy' : 'Watch',
      groundedness: groundednessPercent >= 80 ? 'Healthy' : 'Watch',
      safety: openIncidents === 0 ? 'Healthy' : 'Watch',
      responseQuality: 'Healthy',
      latency: 'Healthy'
    },
    totalInteractions,
    totalFeedbacksCount: totalFeedbacks.length,
    helpfulnessPercent,
    groundednessPercent,
    openIncidentsCount: openIncidents,
    generatedAt: new Date().toISOString()
  };
}
