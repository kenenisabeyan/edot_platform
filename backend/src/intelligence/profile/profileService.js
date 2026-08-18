/**
 * EDOT Intelligence Domain - Learner Profile Service
 * Synthesizes multidimensional student data into dynamic profiles & skill graphs.
 */

import { prisma } from '../../../lib/prisma.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Derives and upserts the comprehensive LearnerProfile from raw data.
 * Safe to run asynchronously or on-demand.
 * 
 * @param {string} userId 
 */
export async function syncLearnerProfile(userId) {
  const [progressRecords, progressLogs, enrollments, quizAttempts] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: {
        course: { select: { mainCategory: true, title: true, tags: true } }
      }
    }),
    prisma.progressLog.findMany({ where: { userId } }),
    prisma.enrollment.findMany({ where: { studentId: userId } }),
    prisma.quizAttempt.findMany({ where: { userId } })
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
      : 0);

  // Category-based performance derivation
  const categoryMap = progressRecords.reduce((acc, e) => {
    const cat = e.course?.mainCategory || 'General';
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat].total += e.score || 0;
    acc[cat].count += 1;
    return acc;
  }, {});

  const sortedCategories = Object.entries(categoryMap).sort(
    (a, b) => b[1].total - a[1].total
  );

  const strengths = sortedCategories.slice(0, 4).map(([cat]) => cat);
  const weaknesses = sortedCategories.slice(-3).map(([cat]) => cat);

  const interests = [
    ...new Set(progressRecords.flatMap((e) => e.course?.tags || []).filter(Boolean))
  ].slice(0, 10);

  const studyConsistencyScore = Math.min(
    100,
    Math.round(progressLogs.length * 4 + completedCourses * 5)
  );

  const weeklyStudyHours = Math.max(
    1,
    Math.round((progressLogs.length + completedLessons) / 6)
  );

  const confidenceScore = Math.min(100, Math.round(quizAverage + completedCourses * 4));
  const aiReadinessScore = Math.min(
    100,
    Math.round(studyConsistencyScore * 0.6 + confidenceScore * 0.4)
  );
  const academicLevel = enrollments.length > 3 ? 'Advanced' : 'Intermediate';
  const currentFocus = progressRecords[0]?.course?.title || 'Foundational Growth';

  const profileData = {
    academicLevel,
    interests,
    strengths,
    weaknesses,
    studyHabits: {
      consistencyScore: studyConsistencyScore,
      weeklyStudyHours,
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
    studyConsistencyScore,
    weeklyStudyHours,
    currentFocus,
    confidenceScore,
    aiReadinessScore,
    summary: `Dynamic profile: ${completedCourses} courses finished, ${Math.round(quizAverage)}% quiz average.`
  };

  const profile = await prisma.learnerProfile.upsert({
    where: { userId },
    update: profileData,
    create: { userId, ...profileData }
  });

  return profile;
}

/**
 * Retrieves full learner profile with related skills and weakness items.
 * 
 * @param {string} userId 
 */
export async function getFullLearnerProfile(userId) {
  let profile = await prisma.learnerProfile.findUnique({
    where: { userId },
    include: {
      skills: true,
      weaknessEntries: true,
      historyEvents: { orderBy: { occurredAt: 'desc' }, take: 10 },
      progressSnapshots: { orderBy: { generatedAt: 'desc' }, take: 5 }
    }
  });

  if (!profile) {
    profile = await syncLearnerProfile(userId);
    profile = await prisma.learnerProfile.findUnique({
      where: { id: profile.id },
      include: {
        skills: true,
        weaknessEntries: true,
        historyEvents: { orderBy: { occurredAt: 'desc' }, take: 10 },
        progressSnapshots: { orderBy: { generatedAt: 'desc' }, take: 5 }
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

  return prisma.learnerSkill.upsert({
    where: { profileId_name: { profileId: profile.id, name: skillData.name } },
    update: {
      category: skillData.category,
      proficiencyLevel: skillData.proficiencyLevel || 'beginner',
      masteryScore: skillData.masteryScore ?? 0,
      confidenceScore: skillData.confidenceScore ?? 0,
      evidenceCount: { increment: 1 },
      lastPracticedAt: new Date()
    },
    create: {
      profileId: profile.id,
      name: skillData.name,
      category: skillData.category,
      proficiencyLevel: skillData.proficiencyLevel || 'beginner',
      masteryScore: skillData.masteryScore ?? 0,
      confidenceScore: skillData.confidenceScore ?? 0,
      evidenceCount: 1,
      lastPracticedAt: new Date()
    }
  });
}
