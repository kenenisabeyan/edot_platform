/**
 * EDOT Intelligence Domain - Recommendation Service
 * Service layer for managing learner recommendations, Next Best Action DTOs, and feedback loops.
 */

import { prisma } from '../../../lib/prisma.js';
import { generateHybridRecommendations, resolveNextBestAction } from './recommendationEngine.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';

/**
 * Generates and upserts fresh recommendations for a learner.
 * 
 * @param {string} userId 
 */
export async function generateAndPersistRecommendations(userId) {
  const [
    userProgress,
    quizAttempts,
    weaknesses,
    profile,
    pastRecommendations
  ] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, mainCategory: true } } }
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    prisma.learnerWeakness.findMany({ where: { userId } }),
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.learnerRecommendation.findMany({ where: { userId }, take: 30 })
  ]);

  const candidateList = generateHybridRecommendations({
    userProgress,
    quizAttempts,
    weaknesses,
    profile: profile || {},
    pastRecommendations
  });

  // Upsert recommendations into PostgreSQL
  const persisted = [];
  for (const candidate of candidateList) {
    const rec = await prisma.learnerRecommendation.create({
      data: {
        userId,
        recommendationType: candidate.recommendationType,
        targetType: candidate.targetType,
        targetId: candidate.targetId,
        priority: candidate.priority,
        reason: candidate.reason,
        evidence: candidate.evidence,
        confidence: candidate.confidence,
        status: candidate.status,
        expiresAt: candidate.expiresAt
      }
    });
    persisted.push(rec);
  }

  return persisted;
}

/**
 * Gets active pending recommendations for a learner.
 * 
 * @param {string} userId 
 */
export async function getLearnerRecommendations(userId) {
  let recommendations = await prisma.learnerRecommendation.findMany({
    where: {
      userId,
      status: 'PENDING'
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  if (recommendations.length === 0) {
    recommendations = await generateAndPersistRecommendations(userId);
  }

  return recommendations;
}

/**
 * Resolves the Next Best Action for a student.
 * 
 * @param {string} userId 
 */
export async function getNextBestAction(userId) {
  const recommendations = await getLearnerRecommendations(userId);
  return resolveNextBestAction(recommendations);
}

/**
 * Dismisses a recommendation (feedback loop: DISMISSED).
 * 
 * @param {string} userId 
 * @param {string} recommendationId 
 */
export async function dismissRecommendation(userId, recommendationId) {
  const rec = await prisma.learnerRecommendation.findFirst({
    where: { id: recommendationId, userId }
  });

  if (!rec) {
    throw new NotFoundError(`Recommendation [${recommendationId}] not found`);
  }

  return prisma.learnerRecommendation.update({
    where: { id: rec.id },
    data: {
      status: 'DISMISSED',
      actedAt: new Date()
    }
  });
}

/**
 * Completes a recommendation (feedback loop: COMPLETED).
 * 
 * @param {string} userId 
 * @param {string} recommendationId 
 */
export async function completeRecommendation(userId, recommendationId) {
  const rec = await prisma.learnerRecommendation.findFirst({
    where: { id: recommendationId, userId }
  });

  if (!rec) {
    throw new NotFoundError(`Recommendation [${recommendationId}] not found`);
  }

  return prisma.learnerRecommendation.update({
    where: { id: rec.id },
    data: {
      status: 'COMPLETED',
      actedAt: new Date()
    }
  });
}
