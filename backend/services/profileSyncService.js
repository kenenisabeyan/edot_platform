/**
 * profileSyncService.js
 *
 * Auto-derives and upserts the LearnerProfile from real progress data.
 * Called fire-and-forget from progressRoutes after each successful ping.
 * Never throws — all errors are logged and swallowed so the ping response
 * is never blocked.
 */

import { prisma } from '../lib/prisma.js';

/**
 * Derive a LearnerProfile from DB data and upsert it.
 * Safe to call without awaiting — errors are caught internally.
 *
 * @param {string} userId
 */
export async function syncLearnerProfile(userId) {
  try {
    const [progressRecords, progressLogs, enrollments] = await Promise.all([
      prisma.userCourseProgress.findMany({
        where: { userId },
        include: { course: { select: { mainCategory: true, title: true, tags: true } } }
      }),
      prisma.progressLog.findMany({ where: { userId } }),
      prisma.enrollment.findMany({ where: { studentId: userId } })
    ]);

    const completedCourses = progressRecords.filter((e) => e.completed || e.passedFinalExam).length;
    const completedLessons =
      progressRecords.reduce((total, e) => {
        const arr = Array.isArray(e.completedLessons) ? e.completedLessons : [];
        return total + arr.length;
      }, 0) + progressLogs.length;

    const courseScores = progressRecords
      .filter((e) => typeof e.score === 'number' && e.score > 0)
      .map((e) => e.score);
    const quizAverage =
      courseScores.length > 0
        ? courseScores.reduce((s, v) => s + v, 0) / courseScores.length
        : 0;

    // Category-based strength / weakness derivation
    const categoryPerf = progressRecords.reduce((acc, e) => {
      const cat = e.course?.mainCategory || 'General';
      if (!acc[cat]) acc[cat] = { totalScore: 0, count: 0 };
      acc[cat].totalScore += e.score || 0;
      acc[cat].count += 1;
      return acc;
    }, {});

    const sortedCats = Object.entries(categoryPerf).sort(
      (a, b) => b[1].totalScore - a[1].totalScore
    );
    const strengths = sortedCats.slice(0, 4).map(([cat]) => cat);
    const weaknesses = sortedCats.slice(-3).map(([cat]) => cat);

    // Collect interests from enrolled course tags
    const interests = [
      ...new Set(
        progressRecords.flatMap((e) => e.course?.tags || []).filter(Boolean)
      )
    ].slice(0, 10);

    const studyConsistencyScore = Math.min(
      100,
      Math.round((progressLogs.length * 4) + (completedCourses * 5))
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
    const currentFocus = progressRecords[0]?.course?.title || 'Building momentum';

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
      summary: `Auto-synced profile. ${completedCourses} completed, ${Math.round(quizAverage)}% quiz avg.`
    };

    await prisma.learnerProfile.upsert({
      where: { userId },
      update: profileData,
      create: { userId, ...profileData }
    });
  } catch (error) {
    // Fire-and-forget — never surface this error to the caller
    console.error('[profileSyncService] Failed to sync learner profile:', error.message);
  }
}

export default { syncLearnerProfile };
