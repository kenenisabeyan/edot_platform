/**
 * EDOT Intelligence Domain - Concept Understanding Service
 * Manages concept explanation evaluation and persistence.
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateLearnerExplanation } from './understandingEvaluator.js';

/**
 * Analyzes student's concept explanation and records analysis item.
 * 
 * @param {string} userId 
 * @param {string} conceptName 
 * @param {string} explanationText 
 */
export async function analyzeConceptExplanation(userId, conceptName, explanationText) {
  const result = evaluateLearnerExplanation(conceptName, explanationText);

  const record = await prisma.conceptUnderstandingAnalysis.create({
    data: {
      userId,
      conceptName: result.conceptName,
      explanationText: result.explanationText,
      correctConcepts: result.correctConcepts,
      missingConcepts: result.missingConcepts,
      misconception: result.misconception,
      confidence: result.confidence,
      recommendedExplanation: result.recommendedExplanation,
      followUpQuestion: result.followUpQuestion,
      recommendedPractice: result.recommendedPractice
    }
  });

  return {
    id: record.id,
    conceptName: result.conceptName,
    correctConcepts: result.correctConcepts,
    missingConcepts: result.missingConcepts,
    misconception: result.misconception,
    confidence: result.confidence,
    recommendedExplanation: result.recommendedExplanation,
    followUpQuestion: result.followUpQuestion,
    recommendedPractice: result.recommendedPractice,
    provenance: result.provenance,
    createdAt: record.createdAt
  };
}

/**
 * Retrieves historical concept understanding evaluations for a user.
 * 
 * @param {string} userId 
 */
export async function getUserUnderstandingHistory(userId) {
  const records = await prisma.conceptUnderstandingAnalysis.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  return records.map(r => ({
    id: r.id,
    conceptName: r.conceptName,
    explanationText: r.explanationText,
    correctConcepts: r.correctConcepts,
    missingConcepts: r.missingConcepts,
    misconception: r.misconception,
    confidence: r.confidence,
    recommendedExplanation: r.recommendedExplanation,
    followUpQuestion: r.followUpQuestion,
    recommendedPractice: r.recommendedPractice,
    createdAt: r.createdAt
  }));
}
