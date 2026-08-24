/**
 * EDOT Intelligence Domain - Intelligent Nudges & Anti-Fatigue Engine
 * 
 * Signal-triggered intelligent notifications with strict anti-fatigue controls:
 * - Max 2 active nudges generated per user in a rolling 24-hour window.
 * - Signal triggers: Rest & Reset, Quiz Recovery, Milestone Momentum, Streak Protection.
 * - Zero non-actionable or spammy notifications.
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateLearnerFatigue } from '../monitoring/learningPulseEngine.js';

const MAX_DAILY_NUDGES = 2;

/**
 * Triggers signal-driven intelligent nudges while enforcing anti-fatigue caps.
 * 
 * @param {string} studentId 
 */
export async function triggerIntelligentNudges(studentId) {
  if (!studentId) return [];

  const now = new Date();
  const TWENTY_FOUR_HOURS_AGO = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Anti-Fatigue Control: Check nudges created in past 24 hours
  const recentNudges = await prisma.intelligentNudge.findMany({
    where: {
      userId: studentId,
      createdAt: { gte: TWENTY_FOUR_HOURS_AGO }
    }
  });

  if (recentNudges.length >= MAX_DAILY_NUDGES) {
    // Anti-Fatigue Cap Reached
    return await getActiveNudges(studentId);
  }

  const newNudgesToCreate = [];

  // 2. Evaluate Fatigue & Continuous Session Signal
  const fatigueData = await evaluateLearnerFatigue(studentId);
  if (fatigueData && fatigueData.restRecommended) {
    const hasExistingRestNudge = recentNudges.some(n => n.triggerReason === 'REST_RECOMMENDATION');
    if (!hasExistingRestNudge) {
      newNudgesToCreate.push({
        userId: studentId,
        triggerReason: 'REST_RECOMMENDATION',
        priority: 'HIGH',
        title: 'Time for a 10-Minute Rest Break! ☕',
        message: fatigueData.recommendationMessage,
        recommendedAction: { type: 'TAKE_BREAK', durationMinutes: 10 },
        deliveryChannel: 'IN_APP',
        expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000), // Expires in 4h
        status: 'ACTIVE'
      });
    }
  }

  // 3. Evaluate Quiz Recovery Signal
  if (recentNudges.length + newNudgesToCreate.length < MAX_DAILY_NUDGES) {
    const recentFailedQuiz = await prisma.learningEvent.findFirst({
      where: {
        userId: studentId,
        eventType: 'QUIZ_FAILED',
        timestamp: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) }
      },
      orderBy: { timestamp: 'desc' }
    });

    if (recentFailedQuiz) {
      const hasExistingQuizNudge = recentNudges.some(n => n.triggerReason === 'QUIZ_RECOVERY');
      if (!hasExistingQuizNudge) {
        newNudgesToCreate.push({
          userId: studentId,
          triggerReason: 'QUIZ_RECOVERY',
          priority: 'MEDIUM',
          title: 'Review Quiz Concepts 🎯',
          message: 'A short review of your recent quiz questions will help reinforce your understanding before retrying.',
          recommendedAction: { type: 'REVIEW_QUIZ', courseId: recentFailedQuiz.courseId },
          deliveryChannel: 'IN_APP',
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          status: 'ACTIVE'
        });
      }
    }
  }

  // 4. Evaluate Milestone Momentum Signal (90%+ course progress)
  if (recentNudges.length + newNudgesToCreate.length < MAX_DAILY_NUDGES) {
    const activeCourseProgress = await prisma.userCourseProgress.findFirst({
      where: {
        userId: studentId,
        progress: { gte: 85, lt: 100 }
      },
      include: { course: { select: { title: true } } }
    });

    if (activeCourseProgress) {
      const hasExistingMilestoneNudge = recentNudges.some(n => n.triggerReason === 'MILESTONE_MOMENTUM');
      if (!hasExistingMilestoneNudge) {
        newNudgesToCreate.push({
          userId: studentId,
          triggerReason: 'MILESTONE_MOMENTUM',
          priority: 'MEDIUM',
          title: 'Almost Finished! 🏁',
          message: `You're at ${Math.round(activeCourseProgress.progress)}% in "${activeCourseProgress.course?.title || 'your course'}". Finish the remaining lessons to claim your certificate!`,
          recommendedAction: { type: 'CONTINUE_COURSE', courseId: activeCourseProgress.courseId },
          deliveryChannel: 'IN_APP',
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          status: 'ACTIVE'
        });
      }
    }
  }

  // Batch insert valid new nudges
  if (newNudgesToCreate.length > 0) {
    await prisma.intelligentNudge.createMany({
      data: newNudgesToCreate
    });
  }

  return await getActiveNudges(studentId);
}

/**
 * Returns un-dismissed, non-expired active nudges for a student.
 * 
 * @param {string} studentId 
 */
export async function getActiveNudges(studentId) {
  if (!studentId) return [];

  const now = new Date();

  return await prisma.intelligentNudge.findMany({
    where: {
      userId: studentId,
      status: 'ACTIVE',
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Dismisses an active nudge and updates anti-fatigue tracking.
 * 
 * @param {string} studentId 
 * @param {string} nudgeId 
 */
export async function dismissNudge(studentId, nudgeId) {
  if (!studentId || !nudgeId) return null;

  return await prisma.intelligentNudge.updateMany({
    where: {
      id: nudgeId,
      userId: studentId
    },
    data: {
      status: 'DISMISSED'
    }
  });
}
