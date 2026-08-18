/**
 * EDOT Intelligence Domain - Learning Analytics Service
 * Computes learner metrics, engagement patterns, risk detection, and aggregates admin insights.
 */

import { prisma } from '../../../lib/prisma.js';
import { RiskLevels } from '../shared/contracts.js';

/**
 * Recalculates analytical scores for a learner and persists the LearnerAnalyticsReport.
 * 
 * @param {string} userId 
 */
export async function recalculateLearnerAnalytics(userId) {
  const [profile, progressLogs, sessions, quizAttempts] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.progressLog.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30
    }),
    prisma.learningSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  ]);

  const totalSessions = sessions.length;
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSessions = sessions.filter((s) => new Date(s.startedAt) > recentCutoff);

  const consistencyScore = Math.min(100, Math.round(progressLogs.length * 4));
  const engagementScore = Math.min(
    100,
    Math.round(
      (recentSessions.length / Math.max(totalSessions, 1)) * 50 +
      (profile?.studyConsistencyScore || 0) * 0.5
    )
  );

  const quizAvg = profile?.quizAverage || (
    quizAttempts.length > 0
      ? Math.round((quizAttempts.filter(q => q.isCorrect).length / quizAttempts.length) * 100)
      : 0
  );

  const momentumScore = Math.min(
    100,
    Math.round(consistencyScore * 0.4 + engagementScore * 0.3 + quizAvg * 0.3)
  );

  // Risk Classification
  let riskLevel = RiskLevels.LOW;
  const riskFactors = [];

  if (progressLogs.length === 0 && totalSessions === 0) {
    riskLevel = RiskLevels.HIGH;
    riskFactors.push('No recent learning activity recorded');
  } else if (consistencyScore < 20) {
    riskLevel = RiskLevels.MEDIUM;
    riskFactors.push('Inconsistent study frequency');
  }

  if (quizAvg < 40 && quizAvg > 0) {
    riskLevel = riskLevel === RiskLevels.LOW ? RiskLevels.MEDIUM : riskLevel;
    riskFactors.push('Low assessment mastery score (< 40%)');
  }

  if (recentSessions.length === 0 && totalSessions > 0) {
    riskLevel = riskLevel === RiskLevels.LOW ? RiskLevels.MEDIUM : RiskLevels.HIGH;
    riskFactors.push('Inactive in the past 7 days');
  }

  const report = await prisma.learnerAnalyticsReport.upsert({
    where: { userId },
    update: {
      riskLevel,
      riskFactors,
      engagementScore,
      consistencyScore,
      momentumScore,
      generatedAt: new Date()
    },
    create: {
      userId,
      riskLevel,
      riskFactors,
      engagementScore,
      consistencyScore,
      momentumScore,
      generatedAt: new Date()
    }
  });

  return report;
}

/**
 * Retrieves the analytics report for a student (with fallback generation).
 */
export async function getLearnerAnalytics(userId) {
  let report = await prisma.learnerAnalyticsReport.findUnique({ where: { userId } });
  if (!report) {
    report = await recalculateLearnerAnalytics(userId);
  }
  return report;
}

/**
 * Admin view: returns list of at-risk students with underlying factors.
 */
export async function getAtRiskLearners(limit = 20) {
  return prisma.learnerAnalyticsReport.findMany({
    where: {
      riskLevel: { in: [RiskLevels.MEDIUM, RiskLevels.HIGH, RiskLevels.CRITICAL] }
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true, createdAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Number(limit) || 20, 100)
  });
}
