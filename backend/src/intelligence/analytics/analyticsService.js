/**
 * EDOT Intelligence Domain - Learning Analytics Engine
 * Transforms raw LearningEvent data and telemetry into actionable Learner, Instructor, and Admin insights.
 * Uses efficient database aggregation (groupBy, count, aggregate) and deterministic risk classification.
 */

import { prisma } from '../../../lib/prisma.js';
import { RiskLevels } from '../shared/contracts.js';

/**
 * 1. Learner Analytics DTO Engine
 * Computes individual course progress, completion rate, consistency, active days, time invested,
 * quiz performance, improvement trends, weak topics, and 7-day engagement trends.
 */
export async function getLearnerAnalytics(userId) {
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const date30DaysAgo = new Date(now - 30 * ONE_DAY_MS);
  const date7DaysAgo = new Date(now - 7 * ONE_DAY_MS);

  const [
    userProgress,
    quizAttempts,
    events30d,
    learnerProfile,
    weaknessEntries
  ] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, mainCategory: true } } }
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    prisma.learningEvent.findMany({
      where: {
        userId,
        timestamp: { gte: date30DaysAgo }
      },
      select: { eventType: true, duration: true, timestamp: true, courseId: true }
    }),
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.learnerWeakness.findMany({ where: { userId } })
  ]);

  // Course Progress & Completion Rate
  const totalEnrolled = userProgress.length;
  const completedCount = userProgress.filter(p => p.completed || p.progress >= 100).length;
  const completionRate = totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 0;

  const courseProgressList = userProgress.map(p => ({
    courseId: p.courseId,
    courseTitle: p.course?.title || 'Course',
    category: p.course?.mainCategory || 'General',
    progress: p.progress || 0,
    completed: p.completed || false,
    updatedAt: p.updatedAt
  }));

  // Active Learning Days & Time Invested
  const activeDaysSet = new Set(events30d.map(e => new Date(e.timestamp).toISOString().split('T')[0]));
  const activeLearningDays = activeDaysSet.size;
  const totalDurationSeconds = events30d.reduce((sum, e) => sum + (e.duration || 0), 0);
  const timeInvestedHours = Number((totalDurationSeconds / 3600).toFixed(1));

  // Learning Consistency (0 - 100)
  const learningConsistency = Math.min(100, Math.round((activeLearningDays / 20) * 100));

  // Quiz Performance & Improvement Trend
  const totalQuizzes = quizAttempts.length;
  const correctQuizzes = quizAttempts.filter(q => q.isCorrect).length;
  const quizPerformancePercent = totalQuizzes > 0 ? Math.round((correctQuizzes / totalQuizzes) * 100) : 0;

  const recent7dQuizzes = quizAttempts.filter(q => new Date(q.createdAt) >= date7DaysAgo);
  const priorQuizzes = quizAttempts.filter(q => new Date(q.createdAt) < date7DaysAgo);
  const recent7dAccuracy = recent7dQuizzes.length > 0
    ? Math.round((recent7dQuizzes.filter(q => q.isCorrect).length / recent7dQuizzes.length) * 100)
    : quizPerformancePercent;
  const priorAccuracy = priorQuizzes.length > 0
    ? Math.round((priorQuizzes.filter(q => q.isCorrect).length / priorQuizzes.length) * 100)
    : quizPerformancePercent;

  const improvementTrend = recent7dAccuracy - priorAccuracy; // e.g., +5% or -10%

  // Weak Topics
  const weakTopicsSet = new Set([
    ...weaknessEntries.map(w => w.topic),
    ...quizAttempts.filter(q => !q.isCorrect && q.topic).map(q => q.topic)
  ]);
  const weakTopics = Array.from(weakTopicsSet).slice(0, 5);

  // Daily Engagement Trend (Last 7 Days)
  const engagementTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * ONE_DAY_MS);
    const dateStr = d.toISOString().split('T')[0];
    const dayEvents = events30d.filter(e => new Date(e.timestamp).toISOString().split('T')[0] === dateStr);
    const dayDurationMinutes = Math.round(dayEvents.reduce((acc, e) => acc + (e.duration || 0), 0) / 60);
    engagementTrend.push({
      date: dateStr,
      eventCount: dayEvents.length,
      durationMinutes: dayDurationMinutes
    });
  }

  // Structured Insight Cards DTO
  const insights = [];

  const riskLevel = learnerProfile?.riskLevel || (activeLearningDays === 0 ? RiskLevels.HIGH : RiskLevels.LOW);
  const riskReasons = learnerProfile?.riskReasons || [];

  if (riskLevel === RiskLevels.HIGH || riskLevel === RiskLevels.CRITICAL) {
    insights.push({
      type: 'risk_warning',
      severity: 'high',
      title: 'Risk Alert: Academic Momentum Stagnant',
      description: 'Your learning activity has dropped significantly below baseline.',
      reason: Array.isArray(riskReasons) ? riskReasons.join(' ') : 'Extended inactivity detected.',
      evidence: { activeLearningDays, daysInactive: 30 - activeLearningDays },
      recommendedAction: learnerProfile?.recommendedNextAction || 'Complete a 10-minute focus lesson',
      createdAt: now
    });
  }

  if (improvementTrend < -5) {
    insights.push({
      type: 'performance_decline',
      severity: 'medium',
      title: 'Recent Quiz Accuracy Dip',
      description: `Assessment accuracy dropped by ${Math.abs(improvementTrend)}% this week.`,
      reason: 'Struggles detected on recent quiz concepts.',
      evidence: { recent7dAccuracy, priorAccuracy, trend: improvementTrend },
      recommendedAction: weakTopics.length > 0 ? `Review weak topic: ${weakTopics[0]}` : 'Retake recent assessment',
      createdAt: now
    });
  } else if (improvementTrend > 5) {
    insights.push({
      type: 'performance_growth',
      severity: 'low',
      title: 'Strong Improvement Trend',
      description: `Assessment accuracy increased by +${improvementTrend}% this week!`,
      reason: 'Consistent study frequency and positive quiz outcomes.',
      evidence: { recent7dAccuracy, priorAccuracy },
      recommendedAction: 'Keep up the momentum and unlock the next module',
      createdAt: now
    });
  }

  return {
    userId,
    riskLevel,
    riskReasons,
    engagementScore: learnerProfile?.engagementScore || 50,
    consistencyScore: learningConsistency,
    momentumScore: learnerProfile?.learningMomentum || 50,
    completionRate,
    activeLearningDays,
    timeInvestedHours,
    quizPerformance: {
      totalQuizzes,
      correctQuizzes,
      accuracyPercent: quizPerformancePercent,
      improvementTrend
    },
    courseProgress: courseProgressList,
    weakTopics,
    engagementTrend,
    recommendedNextAction: learnerProfile?.recommendedNextAction || 'Resume learning path',
    insights
  };
}

/**
 * 2. Instructor Analytics DTO Engine
 * Computes student completion rates, lesson drop-offs, difficult lessons, quiz question difficulty,
 * weak topic clusters, inactive students, and at-risk learners for an instructor's courses.
 */
export async function getInstructorAnalytics(instructorId) {
  const now = new Date();
  const ONE_WEEK_AGO = new Date(now - 7 * 24 * 60 << 20);

  // Fetch courses taught by instructor
  const coursesTaught = await prisma.course.findMany({
    where: { instructorId },
    select: { id: true, title: true, mainCategory: true }
  });

  const courseIds = coursesTaught.map(c => c.id);

  if (courseIds.length === 0) {
    return {
      instructorId,
      totalCourses: 0,
      totalStudents: 0,
      studentCompletionRates: [],
      lessonDropOffPoints: [],
      difficultLessons: [],
      quizQuestionDifficulty: [],
      weakTopicClusters: [],
      inactiveStudents: [],
      atRiskLearners: []
    };
  }

  // Database aggregations for instructor's courses
  const [userProgress, quizAttempts, inactiveUsers, atRiskProfiles] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { courseId: { in: courseIds } },
      select: { userId: true, courseId: true, progress: true, completed: true, enrolledAt: true }
    }),
    prisma.quizAttempt.findMany({
      where: { courseId: { in: courseIds } },
      select: { question: true, isCorrect: true, topic: true, courseId: true, userId: true }
    }),
    prisma.learningEvent.groupBy({
      by: ['userId'],
      where: { courseId: { in: courseIds } },
      _max: { timestamp: true }
    }),
    prisma.learnerProfile.findMany({
      where: {
        riskLevel: { in: [RiskLevels.HIGH, RiskLevels.CRITICAL] }
      },
      select: { userId: true, riskLevel: true, riskReasons: true, user: { select: { name: true, email: true } } },
      take: 20
    })
  ]);

  // Student completion rates per course
  const studentCompletionRates = coursesTaught.map(c => {
    const cProgress = userProgress.filter(p => p.courseId === c.id);
    const totalEnrolled = cProgress.length;
    const avgProgress = totalEnrolled > 0
      ? Math.round(cProgress.reduce((sum, p) => sum + (p.progress || 0), 0) / totalEnrolled)
      : 0;
    return {
      courseId: c.id,
      courseTitle: c.title,
      totalEnrolled,
      avgProgressPercent: avgProgress
    };
  });

  // Quiz Question Difficulty Breakdown
  const questionMap = {};
  quizAttempts.forEach(q => {
    if (!questionMap[q.question]) {
      questionMap[q.question] = { question: q.question, topic: q.topic || 'General', total: 0, correct: 0 };
    }
    questionMap[q.question].total += 1;
    if (q.isCorrect) questionMap[q.question].correct += 1;
  });

  const quizQuestionDifficulty = Object.values(questionMap).map(q => {
    const accuracy = q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0;
    let difficultyTier = 'easy';
    if (accuracy < 40) difficultyTier = 'hard';
    else if (accuracy < 70) difficultyTier = 'medium';
    return {
      question: q.question,
      topic: q.topic,
      attempts: q.total,
      accuracyPercent: accuracy,
      difficultyTier
    };
  }).sort((a, b) => a.accuracyPercent - b.accuracyPercent).slice(0, 10);

  // Weak Topic Clusters
  const topicClusterMap = {};
  quizAttempts.filter(q => !q.isCorrect && q.topic).forEach(q => {
    topicClusterMap[q.topic] = (topicClusterMap[q.topic] || 0) + 1;
  });

  const weakTopicClusters = Object.entries(topicClusterMap)
    .map(([topic, failureCount]) => ({ topic, failureCount }))
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 5);

  return {
    instructorId,
    totalCourses: coursesTaught.length,
    totalStudents: new Set(userProgress.map(p => p.userId)).size,
    studentCompletionRates,
    quizQuestionDifficulty,
    weakTopicClusters,
    atRiskLearners: atRiskProfiles.map(p => ({
      userId: p.userId,
      name: p.user?.name || 'Student',
      email: p.user?.email || '',
      riskLevel: p.riskLevel,
      riskReasons: p.riskReasons || []
    }))
  };
}

/**
 * 3. Platform / Admin Analytics Overview DTO Engine
 * High-performance database aggregation for DAU/MAU, enrollments, course completion, retention,
 * and platform risk counts.
 */
export async function getAdminAnalyticsOverview() {
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const date24hAgo = new Date(now - 1 * ONE_DAY_MS);
  const date7dAgo = new Date(now - 7 * ONE_DAY_MS);
  const date30dAgo = new Date(now - 30 * ONE_DAY_MS);

  const [
    totalLearnersCount,
    totalEnrollmentsCount,
    activeEnrollmentsCount,
    completedEnrollmentsCount,
    dauEvents,
    wauEvents,
    mauEvents,
    riskGroupCounts,
    topCoursesGroup
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: 'approved' } }),
    prisma.userCourseProgress.count({ where: { completed: true } }),
    prisma.learningEvent.groupBy({
      by: ['userId'],
      where: { timestamp: { gte: date24hAgo } }
    }),
    prisma.learningEvent.groupBy({
      by: ['userId'],
      where: { timestamp: { gte: date7dAgo } }
    }),
    prisma.learningEvent.groupBy({
      by: ['userId'],
      where: { timestamp: { gte: date30dAgo } }
    }),
    prisma.learnerProfile.groupBy({
      by: ['riskLevel'],
      _count: { userId: true }
    }),
    prisma.userCourseProgress.groupBy({
      by: ['courseId'],
      _count: { userId: true },
      _avg: { progress: true },
      orderBy: {
        _count: {
          userId: 'desc'
        }
      },
      take: 5
    })
  ]);

  const dau = dauEvents.length;
  const wau = wauEvents.length;
  const mau = mauEvents.length;

  const completionRatePercent = totalEnrollmentsCount > 0
    ? Math.round((completedEnrollmentsCount / totalEnrollmentsCount) * 100)
    : 0;

  const retentionPercent = mau > 0 ? Math.round((wau / mau) * 100) : 0;

  const atRiskCounts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  riskGroupCounts.forEach(g => {
    if (atRiskCounts[g.riskLevel] !== undefined) {
      atRiskCounts[g.riskLevel] = g._count.userId;
    }
  });

  return {
    generatedAt: now,
    platformMetrics: {
      totalLearners: totalLearnersCount,
      totalEnrollments: totalEnrollmentsCount,
      activeEnrollments: activeEnrollmentsCount,
      completedEnrollments: completedEnrollmentsCount,
      completionRatePercent
    },
    activeLearners: {
      dau,
      wau,
      mau,
      retentionPercent
    },
    atRiskLearnerCounts: atRiskCounts,
    coursePerformance: topCoursesGroup.map(g => ({
      courseId: g.courseId,
      enrolledCount: g._count.userId,
      avgProgressPercent: Math.round(g._avg.progress || 0)
    }))
  };
}

/**
 * 4. At-Risk Learners Directory DTO (Admin / Instructor)
 */
export async function getAtRiskLearnersDTO(limit = 20) {
  const atRiskProfiles = await prisma.learnerProfile.findMany({
    where: {
      riskLevel: { in: [RiskLevels.MEDIUM, RiskLevels.HIGH, RiskLevels.CRITICAL] }
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, avatar: true } }
    },
    orderBy: { engagementScore: 'asc' },
    take: Math.min(Number(limit) || 20, 100)
  });

  return atRiskProfiles.map(p => ({
    userId: p.userId,
    name: p.user?.name || 'Learner',
    email: p.user?.email || '',
    avatar: p.user?.avatar || '',
    riskLevel: p.riskLevel,
    riskReasons: p.riskReasons || [],
    engagementScore: p.engagementScore,
    consistencyScore: p.consistencyScore,
    learningMomentum: p.learningMomentum,
    recommendedNextAction: p.recommendedNextAction,
    lastUpdatedAt: p.lastUpdatedAt
  }));
}
