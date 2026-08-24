/**
 * EDOT Intelligence Domain - Learning Analytics Service
 * 
 * Computes empirical analytics for student and course learning behavior:
 * - calculateCourseProgress(studentId, courseId)
 * - calculateLessonCompletion(studentId, courseId)
 * - calculateRecentActivity(studentId, limit)
 * - calculateQuizPerformance(studentId, courseId)
 * - calculateAssignmentPerformance(studentId, courseId)
 * - calculateEngagementTrend(studentId, courseId)
 * - calculateInactivity(studentId, courseId)
 * - calculatePerformanceTrend(studentId, courseId)
 * - getStudentLearningSummary(studentId)
 * - getCourseLearningSummary(studentId, courseId)
 * - getStudentCourseProgress(studentId, courseId)
 * - getRecentLearningActivity(studentId, limit)
 */

import { prisma } from '../../../lib/prisma.js';

export async function calculateCourseProgress(studentId, courseId) {
  const [course, progress, completedEvents] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, lessons: { select: { id: true } } }
    }),
    prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } }
    }),
    prisma.learningEvent.findMany({
      where: {
        userId: studentId,
        courseId,
        eventType: 'LESSON_COMPLETED'
      },
      select: { lessonId: true }
    })
  ]);

  const totalLessons = course?.lessons?.length || 0;
  const uniqueCompletedLessonIds = new Set([
    ...(progress?.completedLessons || []),
    ...completedEvents.map(e => e.lessonId).filter(Boolean)
  ]);

  const completedCount = uniqueCompletedLessonIds.size;
  const progressPercentage = totalLessons > 0
    ? Math.min(100, Math.round((completedCount / totalLessons) * 100))
    : (progress?.progress || 0);

  return {
    totalLessons,
    completedLessonsCount: completedCount,
    progressPercentage,
    isCompleted: progressPercentage >= 100
  };
}

export async function calculateQuizPerformance(studentId, courseId = null) {
  const where = {
    userId: studentId,
    eventType: { in: ['QUIZ_COMPLETED', 'QUIZ_PASSED', 'QUIZ_FAILED'] }
  };
  if (courseId) where.courseId = courseId;

  const quizEvents = await prisma.learningEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    select: { score: true, eventType: true, quizId: true, timestamp: true, metadata: true }
  });

  if (quizEvents.length === 0) {
    return {
      hasData: false,
      attemptCount: 0,
      averageScore: 0,
      passRate: 0,
      trend: 'NO_DATA'
    };
  }

  const scores = quizEvents.map(e => e.score).filter(s => typeof s === 'number' && !isNaN(s));
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const passedCount = quizEvents.filter(e => e.eventType === 'QUIZ_PASSED' || (e.score && e.score >= 70)).length;
  const passRate = Math.round((passedCount / quizEvents.length) * 100);

  let trend = 'STABLE';
  if (scores.length >= 2) {
    const recent = scores.slice(0, Math.ceil(scores.length / 2));
    const older = scores.slice(Math.ceil(scores.length / 2));
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

    if (avgRecent > avgOlder + 5) trend = 'IMPROVING';
    else if (avgRecent < avgOlder - 5) trend = 'DECLINING';
  }

  return {
    hasData: true,
    attemptCount: quizEvents.length,
    averageScore: avgScore,
    passRate,
    recentScores: scores.slice(0, 5),
    trend
  };
}

export async function calculateRecentActivity(studentId, limit = 10) {
  const events = await prisma.learningEvent.findMany({
    where: { userId: studentId },
    orderBy: { timestamp: 'desc' },
    take: limit
  });

  return events;
}

export async function getStudentLearningSummary(studentId) {
  const [profile, courseProfiles, recentEvents, quizPerf] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId: studentId } }),
    prisma.courseLearnerProfile.findMany({
      where: { userId: studentId },
      include: { course: { select: { id: true, title: true, mainCategory: true } } }
    }),
    calculateRecentActivity(studentId, 5),
    calculateQuizPerformance(studentId)
  ]);

  const totalCourses = courseProfiles.length;
  const activeCourses = courseProfiles.filter(cp => cp.learningStatus !== 'COMPLETED').length;
  const completedCourses = courseProfiles.filter(cp => cp.learningStatus === 'COMPLETED').length;

  const dataStatus = recentEvents.length > 0 ? 'SUFFICIENT' : 'INSUFFICIENT';

  return {
    sourceType: 'LEARNING_ANALYTICS_SERVICE',
    sourceIds: [studentId],
    studentId,
    generatedAt: new Date(),
    confidence: dataStatus === 'SUFFICIENT' ? 0.95 : 0.2,
    dataStatus,
    summary: {
      profileStatus: profile?.overallLearningStatus || 'NOT_INITIALIZED',
      totalCoursesEnrolled: totalCourses,
      activeCourses,
      completedCourses,
      quizAverageScore: quizPerf.hasData ? quizPerf.averageScore : null,
      quizPerformanceTrend: quizPerf.trend,
      lastActiveAt: profile?.lastActiveAt || (recentEvents[0]?.timestamp ?? null),
      recentActivitiesCount: recentEvents.length
    },
    message: dataStatus === 'INSUFFICIENT'
      ? 'We are still learning about your learning journey. Complete more activities to unlock personalized insights.'
      : 'Learning data foundation active and synced.'
  };
}

export async function getCourseLearningSummary(studentId, courseId) {
  const [courseProfile, courseProgress, quizPerf, recentEvents] = await Promise.all([
    prisma.courseLearnerProfile.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } },
      include: { course: { select: { id: true, title: true, mainCategory: true } } }
    }),
    calculateCourseProgress(studentId, courseId),
    calculateQuizPerformance(studentId, courseId),
    prisma.learningEvent.findMany({
      where: { userId: studentId, courseId },
      orderBy: { timestamp: 'desc' },
      take: 5
    })
  ]);

  const dataStatus = (courseProgress.completedLessonsCount > 0 || quizPerf.hasData || recentEvents.length > 0)
    ? 'SUFFICIENT'
    : 'INSUFFICIENT';

  return {
    sourceType: 'COURSE_LEARNING_ANALYTICS',
    sourceIds: [studentId, courseId],
    studentId,
    courseId,
    generatedAt: new Date(),
    confidence: dataStatus === 'SUFFICIENT' ? 0.9 : 0.1,
    dataStatus,
    courseSummary: {
      courseId,
      courseTitle: courseProfile?.course?.title || null,
      progressPercentage: courseProgress.progressPercentage,
      completedLessonsCount: courseProgress.completedLessonsCount,
      totalLessons: courseProgress.totalLessons,
      learningStatus: courseProfile?.learningStatus || (courseProgress.isCompleted ? 'COMPLETED' : 'ACTIVE'),
      engagementLevel: courseProfile?.engagementLevel || 'MEDIUM',
      performanceTrend: quizPerf.hasData ? quizPerf.trend : 'STABLE',
      quizAverage: quizPerf.hasData ? quizPerf.averageScore : null,
      lastActivityAt: courseProfile?.lastActivityAt || (recentEvents[0]?.timestamp ?? null)
    },
    message: dataStatus === 'INSUFFICIENT'
      ? 'No learning activity recorded for this course yet. Complete lessons or quizzes to unlock insights.'
      : 'Course learning summary calculated from real telemetry.'
  };
}
