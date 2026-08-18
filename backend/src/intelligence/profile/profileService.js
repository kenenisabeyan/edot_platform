/**
 * EDOT Intelligence Domain - Learner Profile Service
 * Synthesizes multidimensional student data into dynamic profiles, skill graphs, and relational goals/insights.
 */

import { prisma } from '../../../lib/prisma.js';
import { calculateLearnerMetrics } from './profileCalculator.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Derives and upserts the comprehensive LearnerProfile from raw telemetry and relational models.
 * Safe to run asynchronously after events or on-demand.
 * 
 * @param {string} userId 
 */
export async function syncLearnerProfile(userId) {
  const [
    progressRecords,
    progressLogs,
    enrollments,
    quizAttempts,
    learningEvents,
    existingSkills,
    existingWeaknesses
  ] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: {
        course: { select: { mainCategory: true, title: true, tags: true } }
      }
    }),
    prisma.progressLog.findMany({ where: { userId } }),
    prisma.enrollment.findMany({ where: { studentId: userId } }),
    prisma.quizAttempt.findMany({ where: { userId } }),
    prisma.learningEvent.findMany({ where: { userId }, orderBy: { timestamp: 'desc' } }),
    prisma.learnerSkill.findMany({ where: { userId } }),
    prisma.learnerWeakness.findMany({ where: { userId } })
  ]);

  const completedCourses = progressRecords.filter((e) => e.completed || e.passedFinalExam).length;
  const completedLessons = progressRecords.reduce((total, e) => {
    const arr = Array.isArray(e.completedLessons) ? e.completedLessons : [];
    return total + arr.length;
  }, 0) + progressLogs.length;

  const validScores = progressRecords
    .filter((e) => typeof e.score === 'number' && e.score > 0)
    .map((e) => e.score);

  const quizAverage = validScores.length > 0
    ? validScores.reduce((s, v) => s + v, 0) / validScores.length
    : (quizAttempts.length > 0
      ? Math.round((quizAttempts.filter(q => q.isCorrect).length / quizAttempts.length) * 100)
      : 75);

  // Run deterministic metrics calculation with explainable reasons
  const calculatedMetrics = calculateLearnerMetrics({
    events: learningEvents,
    quizAttempts,
    progressLogs,
    skills: existingSkills,
    weaknesses: existingWeaknesses
  });

  const categoryMap = progressRecords.reduce((acc, e) => {
    const cat = e.course?.mainCategory || 'General';
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat].total += e.score || 0;
    acc[cat].count += 1;
    return acc;
  }, {});

  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1].total - a[1].total);
  const strengths = sortedCategories.slice(0, 4).map(([cat]) => cat);
  const weaknesses = sortedCategories.slice(-3).map(([cat]) => cat);
  const interests = [...new Set(progressRecords.flatMap((e) => e.course?.tags || []).filter(Boolean))].slice(0, 10);

  const academicLevel = enrollments.length > 3 ? 'Advanced' : 'Intermediate';
  const currentFocus = progressRecords[0]?.course?.title || 'Foundational Skills';

  const profileData = {
    academicLevel,
    interests,
    strengths,
    weaknesses,
    studyHabits: {
      consistencyScore: calculatedMetrics.consistencyScore,
      weeklyStudyHours: Math.max(1, Math.round(learningEvents.length / 5)),
      preferredTime: 'Flexible study blocks'
    },
    learningBehavior: {
      activeCourses: progressRecords.length,
      completedCourses,
      completedLessons
    },
    completedCourses,
    completedLessons,
    quizAverage,
    studyConsistencyScore: calculatedMetrics.consistencyScore,
    weeklyStudyHours: Math.max(1, Math.round(learningEvents.length / 5)),
    currentFocus,

    // Deterministic intelligence & explainable outputs
    engagementScore: calculatedMetrics.engagementScore,
    consistencyScore: calculatedMetrics.consistencyScore,
    learningMomentum: calculatedMetrics.learningMomentum,
    riskLevel: calculatedMetrics.riskLevel,
    riskReasons: calculatedMetrics.riskReasons,
    momentumReasons: calculatedMetrics.momentumReasons,
    recommendedNextAction: calculatedMetrics.recommendedNextAction,
    recommendationRationale: calculatedMetrics.recommendationRationale,

    confidenceScore: calculatedMetrics.confidenceScore,
    aiReadinessScore: Math.min(100, Math.round(calculatedMetrics.consistencyScore * 0.5 + calculatedMetrics.confidenceScore * 0.5)),
    summary: `Learner Profile: Risk [${calculatedMetrics.riskLevel}], Momentum [${calculatedMetrics.learningMomentum}%], Engagement [${calculatedMetrics.engagementScore}%].`
  };

  const profile = await prisma.learnerProfile.upsert({
    where: { userId },
    update: profileData,
    create: { userId, ...profileData }
  });

  return profile;
}

/**
 * Retrieves full learner profile with all relational arrays (skills, goals, interests, insights, weaknesses).
 * 
 * @param {string} userId 
 */
export async function getFullLearnerProfile(userId) {
  let profile = await prisma.learnerProfile.findUnique({
    where: { userId },
    include: {
      skills: true,
      goals: true,
      learnerInterests: true,
      insights: true,
      weaknessEntries: true,
      historyEvents: { orderBy: { occurredAt: 'desc' }, take: 10 }
    }
  });

  if (!profile) {
    profile = await syncLearnerProfile(userId);
    profile = await prisma.learnerProfile.findUnique({
      where: { id: profile.id },
      include: {
        skills: true,
        goals: true,
        learnerInterests: true,
        insights: true,
        weaknessEntries: true,
        historyEvents: { orderBy: { occurredAt: 'desc' }, take: 10 }
      }
    });
  }

  return profile;
}

/**
 * Upserts a specific skill node in the learner's skill graph.
 */
export async function upsertSkillNode(userId, skillData) {
  const profile = await getFullLearnerProfile(userId);

  const masteryScore = skillData.masteryScore ?? 0;
  let masteryState = 'learning';
  if (masteryScore >= 85) masteryState = 'mastered';
  else if (masteryScore >= 50) masteryState = 'practicing';

  return prisma.learnerSkill.upsert({
    where: { profileId_name: { profileId: profile.id, name: skillData.name } },
    update: {
      category: skillData.category,
      proficiencyLevel: skillData.proficiencyLevel || 'beginner',
      masteryScore,
      confidenceScore: skillData.confidenceScore ?? 0,
      evidenceCount: { increment: 1 },
      masteryState,
      lastPracticedAt: new Date()
    },
    create: {
      profileId: profile.id,
      userId,
      name: skillData.name,
      category: skillData.category,
      proficiencyLevel: skillData.proficiencyLevel || 'beginner',
      masteryScore,
      confidenceScore: skillData.confidenceScore ?? 0,
      evidenceCount: 1,
      masteryState,
      lastPracticedAt: new Date()
    }
  });
}
