/**
 * EDOT Intelligence Domain - Instructor Intelligence Service
 * 
 * Provides teaching command center analytics, class health calculation, student support detection,
 * difficult concept discovery (with minimum 2-student evidence threshold), and explainable trend analysis.
 * Strictly scoped to authorized assigned courses.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveInstructorContext, verifyInstructorCourseAccess } from '../context/instructorContextResolver.js';
import { evaluateLearnerFatigue } from '../monitoring/learningPulseEngine.js';

const MIN_DIFFICULT_CONCEPT_EVIDENCE_THRESHOLD = 2; // Minimum struggling students required before flagging a concept

/**
 * Computes high-level Teaching Overview statistics across authorized assigned courses.
 * 
 * @param {string} instructorId 
 */
export async function getTeachingOverview(instructorId) {
  const context = await resolveInstructorContext(instructorId);

  if (context.assignedCourseIds.length === 0) {
    return {
      instructorId,
      instructorName: context.instructorName,
      dataStatus: 'INSUFFICIENT',
      activeCoursesCount: 0,
      totalActiveStudents: 0,
      studentsOnTrack: 0,
      studentsNeedingAttention: 0,
      studentsRecommendedForSupport: 0,
      recentlyInactiveStudents: 0,
      averageCourseProgress: 0,
      recentEngagementTrend: 'STABLE',
      message: 'No assigned courses found. Assign courses to initialize teaching intelligence.'
    };
  }

  const [
    courseProfiles,
    userProgresses,
    recentEvents
  ] = await Promise.all([
    prisma.courseLearnerProfile.findMany({
      where: { courseId: { in: context.assignedCourseIds } }
    }),
    prisma.userCourseProgress.findMany({
      where: { courseId: { in: context.assignedCourseIds } },
      select: { progress: true, userId: true }
    }),
    prisma.learningEvent.findMany({
      where: {
        courseId: { in: context.assignedCourseIds },
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      select: { userId: true, timestamp: true }
    })
  ]);

  const studentsOnTrack = courseProfiles.filter(p => p.learningStatus === 'ON_TRACK' || p.learningStatus === 'COMPLETED').length;
  const studentsNeedingAttention = courseProfiles.filter(p => p.learningStatus === 'NEEDS_ATTENTION').length;
  const studentsRecommendedForSupport = courseProfiles.filter(p => p.learningStatus === 'SUPPORT_RECOMMENDED').length;

  // Inactive students (no event in 5 days)
  const activeUserSet7d = new Set(recentEvents.map(e => e.userId));
  const recentlyInactiveStudents = context.enrolledStudentIds.filter(sId => !activeUserSet7d.has(sId)).length;

  const totalProgress = userProgresses.reduce((acc, p) => acc + (p.progress || 0), 0);
  const averageCourseProgress = userProgresses.length > 0 ? Math.round(totalProgress / userProgresses.length) : 0;

  const recentEngagementTrend = recentEvents.length > context.enrolledStudentIds.length * 3 ? 'IMPROVING' : (recentEvents.length > 0 ? 'STABLE' : 'DECLINING');

  return {
    instructorId,
    instructorName: context.instructorName,
    dataStatus: 'SUFFICIENT',
    activeCoursesCount: context.activeCoursesCount,
    totalActiveStudents: context.activeStudentsCount,
    studentsOnTrack,
    studentsNeedingAttention,
    studentsRecommendedForSupport,
    recentlyInactiveStudents,
    averageCourseProgress,
    recentEngagementTrend,
    generatedAt: new Date()
  };
}

/**
 * Computes Class Learning Health for a specific course using multiple real signals.
 * 
 * @param {string} instructorId 
 * @param {string} courseId 
 */
export async function getCourseHealthSummary(instructorId, courseId) {
  await verifyInstructorCourseAccess(instructorId, courseId);

  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    course,
    enrollments,
    courseProfiles,
    quizAttempts,
    recentEvents
  ] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, mainCategory: true, totalStudents: true }
    }),
    prisma.enrollment.findMany({
      where: { courseId, status: 'approved' },
      select: { studentId: true }
    }),
    prisma.courseLearnerProfile.findMany({
      where: { courseId }
    }),
    prisma.quizAttempt.findMany({
      where: { courseId }
    }),
    prisma.learningEvent.findMany({
      where: { courseId, timestamp: { gte: SEVEN_DAYS_AGO } }
    })
  ]);

  const totalEnrolled = enrollments.length;
  if (totalEnrolled === 0) {
    return {
      courseId,
      courseTitle: course?.title || 'Course',
      healthStatus: 'HEALTHY',
      dataStatus: 'INSUFFICIENT',
      message: 'No enrolled students yet in this course.',
      signals: []
    };
  }

  const signals = [];
  let riskScore = 0;

  // Signal 1: Inactivity ratio
  const activeStudentSet = new Set(recentEvents.map(e => e.userId));
  const inactiveStudentCount = totalEnrolled - activeStudentSet.size;
  const inactivityRatio = inactiveStudentCount / totalEnrolled;

  if (inactivityRatio >= 0.4) {
    riskScore += 35;
    signals.push({
      type: 'HIGH_INACTIVITY',
      severity: 'HIGH',
      description: `${Math.round(inactivityRatio * 100)}% of enrolled students have been inactive over the last 7 days.`
    });
  } else if (inactivityRatio >= 0.2) {
    riskScore += 15;
    signals.push({
      type: 'MODERATE_INACTIVITY',
      severity: 'MEDIUM',
      description: `${inactiveStudentCount} students logged zero activity this week.`
    });
  }

  // Signal 2: Quiz Accuracy
  if (quizAttempts.length > 0) {
    const correctCount = quizAttempts.filter(q => q.isCorrect).length;
    const accuracy = Math.round((correctCount / quizAttempts.length) * 100);
    if (accuracy < 60) {
      riskScore += 35;
      signals.push({
        type: 'LOW_QUIZ_PERFORMANCE',
        severity: 'HIGH',
        description: `Average quiz accuracy is low (${accuracy}% across ${quizAttempts.length} attempts).`
      });
    } else if (accuracy < 75) {
      riskScore += 15;
      signals.push({
        type: 'MODERATE_QUIZ_PERFORMANCE',
        severity: 'MEDIUM',
        description: `Average quiz accuracy is moderate (${accuracy}%).`
      });
    }
  }

  // Signal 3: Students needing attention status
  const attentionCount = courseProfiles.filter(p => p.learningStatus === 'NEEDS_ATTENTION' || p.learningStatus === 'SUPPORT_RECOMMENDED').length;
  if (attentionCount > 0) {
    riskScore += attentionCount * 10;
    signals.push({
      type: 'STUDENTS_NEEDING_ATTENTION',
      severity: attentionCount >= 3 ? 'HIGH' : 'MEDIUM',
      description: `${attentionCount} student(s) currently flagged as needing attention or support.`
    });
  }

  let healthStatus = 'HEALTHY';
  if (riskScore >= 60) healthStatus = 'SUPPORT_RECOMMENDED';
  else if (riskScore >= 35) healthStatus = 'NEEDS_ATTENTION';
  else if (riskScore >= 15) healthStatus = 'WATCH';

  return {
    courseId,
    courseTitle: course?.title || 'Course',
    healthStatus,
    riskScore: Math.min(100, riskScore),
    totalEnrolled,
    activeStudents7d: activeStudentSet.size,
    signals,
    generatedAt: new Date()
  };
}

/**
 * Retrieves a prioritized list of authorized students needing support with explainable rationale.
 * 
 * @param {string} instructorId 
 * @param {object} [options] 
 * @param {string} [options.courseId] 
 * @param {number} [options.limit=20] 
 */
export async function getStudentsNeedingSupport(instructorId, { courseId = null, limit = 20 } = {}) {
  const context = await resolveInstructorContext(instructorId);

  let targetCourseIds = context.assignedCourseIds;
  if (courseId) {
    await verifyInstructorCourseAccess(instructorId, courseId);
    targetCourseIds = [String(courseId)];
  }

  if (targetCourseIds.length === 0) return [];

  // Fetch course profiles & learner data
  const profiles = await prisma.courseLearnerProfile.findMany({
    where: {
      courseId: { in: targetCourseIds },
      learningStatus: { in: ['NEEDS_ATTENTION', 'SUPPORT_RECOMMENDED', 'ACTIVE'] }
    },
    include: {
      user: { select: { id: true, name: true, avatar: true, email: true } },
      course: { select: { id: true, title: true } }
    },
    take: Math.min(Number(limit) || 20, 50)
  });

  const studentsList = [];

  for (const prof of profiles) {
    const fatigue = await evaluateLearnerFatigue(prof.userId);
    const recentEvents = await prisma.learningEvent.findMany({
      where: { userId: prof.userId, courseId: prof.courseId },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    const lastEvent = recentEvents[0];
    const daysInactive = lastEvent ? Math.floor((Date.now() - new Date(lastEvent.timestamp)) / (24 * 60 * 60 * 1000)) : 7;

    let reason = 'Reduced activity and progress stagnation detected.';
    let recommendedAction = 'Send supportive check-in message.';

    if (daysInactive >= 5) {
      reason = `Inactivity detected: No learning activity for ${daysInactive} consecutive days.`;
      recommendedAction = 'Send encouragement or review progress.';
    } else if (fatigue && fatigue.fatigueLevel === 'HIGH_FATIGUE') {
      reason = 'High study fatigue: Prolonged study session without adequate breaks.';
      recommendedAction = 'Recommend rest break & pacing strategy.';
    } else if (prof.learningStatus === 'SUPPORT_RECOMMENDED') {
      reason = 'Quiz scores indicate difficulty with core concepts in recent modules.';
      recommendedAction = 'Assign review practice or schedule 1-on-1 support session.';
    }

    studentsList.push({
      studentId: prof.userId,
      studentName: prof.user?.name || 'Student',
      studentAvatar: prof.user?.avatar || 'default-avatar.png',
      courseId: prof.courseId,
      courseTitle: prof.course?.title || 'Course',
      learningStatus: prof.learningStatus,
      daysInactive,
      reason,
      recommendedNextAction: recommendedAction,
      lastActiveAt: lastEvent ? lastEvent.timestamp : prof.lastActivityAt,
      dataCoverage: recentEvents.length > 0 ? 'SUFFICIENT' : 'INSUFFICIENT'
    });
  }

  return studentsList.sort((a, b) => b.daysInactive - a.daysInactive);
}

/**
 * Detects difficult lessons or concepts using real telemetry signals.
 * Enforces MIN_DIFFICULT_CONCEPT_EVIDENCE_THRESHOLD (>=2 struggling students) to avoid false positives.
 * 
 * @param {string} instructorId 
 * @param {string} courseId 
 */
export async function getDifficultConcepts(instructorId, courseId) {
  await verifyInstructorCourseAccess(instructorId, courseId);

  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { courseId },
    include: { user: { select: { name: true } } }
  });

  if (quizAttempts.length === 0) {
    return {
      courseId,
      dataStatus: 'INSUFFICIENT',
      message: 'No quiz attempts recorded yet for this course.',
      difficultConcepts: []
    };
  }

  // Group attempts by topic/lesson
  const topicMap = {};
  quizAttempts.forEach(q => {
    const topic = q.topic || 'General Concepts';
    if (!topicMap[topic]) {
      topicMap[topic] = {
        topic,
        attempts: [],
        strugglingUserIds: new Set()
      };
    }
    topicMap[topic].attempts.push(q);
    if (!q.isCorrect) {
      topicMap[topic].strugglingUserIds.add(q.userId);
    }
  });

  const difficultConcepts = [];

  Object.values(topicMap).forEach(group => {
    const affectedCount = group.strugglingUserIds.size;
    const totalAttempts = group.attempts.length;
    const correctCount = group.attempts.filter(a => a.isCorrect).length;
    const averageScore = Math.round((correctCount / totalAttempts) * 100);

    // Enforce Minimum Evidence Threshold (>= 2 struggling students)
    if (affectedCount >= MIN_DIFFICULT_CONCEPT_EVIDENCE_THRESHOLD && averageScore < 70) {
      difficultConcepts.push({
        topic: group.topic,
        courseId,
        affectedStudentsCount: affectedCount,
        totalAttempts,
        averageScore,
        evidenceSignal: `${affectedCount} students scored below performance threshold on topic "${group.topic}" (average score: ${averageScore}%).`,
        suggestedActions: [
          { actionType: 'REVIEW_LESSON', label: 'Review Lesson' },
          { actionType: 'CREATE_PRACTICE', label: 'Assign Practice Quiz' },
          { actionType: 'SEND_ANNOUNCEMENT', label: 'Send Course Announcement' }
        ]
      });
    }
  });

  return {
    courseId,
    dataStatus: difficultConcepts.length > 0 ? 'SUFFICIENT' : 'HEALTHY_CURRICULUM',
    difficultConceptsCount: difficultConcepts.length,
    difficultConcepts
  };
}

/**
 * Analyzes engagement and performance trends for a course over time.
 * 
 * @param {string} instructorId 
 * @param {string} courseId 
 */
export async function getEngagementPerformanceTrends(instructorId, courseId) {
  await verifyInstructorCourseAccess(instructorId, courseId);

  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const TWENTY_EIGHT_DAYS_AGO = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const events = await prisma.learningEvent.findMany({
    where: {
      courseId,
      timestamp: { gte: TWENTY_EIGHT_DAYS_AGO }
    }
  });

  const recent7dEvents = events.filter(e => new Date(e.timestamp) >= SEVEN_DAYS_AGO);
  const prior21dEvents = events.filter(e => new Date(e.timestamp) < SEVEN_DAYS_AGO);

  const expected7dVolume = prior21dEvents.length / 3;
  let engagementTrend = 'STABLE';
  if (expected7dVolume > 0) {
    const ratio = recent7dEvents.length / expected7dVolume;
    if (ratio >= 1.25) engagementTrend = 'IMPROVING';
    else if (ratio <= 0.75) engagementTrend = 'DECLINING';
  }

  return {
    courseId,
    engagementTrend,
    recent7dEventsCount: recent7dEvents.length,
    prior21dAverageVolume: Math.round(expected7dVolume),
    dataCoverage: events.length > 0 ? 'SUFFICIENT' : 'INSUFFICIENT_DATA',
    evaluatedAt: now
  };
}

/**
 * Retrieves the Learning Pulse distribution strictly for an instructor's authorized students.
 * 
 * @param {string} instructorId 
 * @param {string} [courseId] 
 */
export async function getLearningPulseDistribution(instructorId, courseId = null) {
  const context = await resolveInstructorContext(instructorId);

  let targetCourseIds = context.assignedCourseIds;
  if (courseId) {
    await verifyInstructorCourseAccess(instructorId, courseId);
    targetCourseIds = [String(courseId)];
  }

  if (targetCourseIds.length === 0) {
    return { distribution: { ON_TRACK: 0, NEEDS_ATTENTION: 0, SUPPORT_RECOMMENDED: 0, COMPLETED: 0, NOT_STARTED: 0 } };
  }

  const profiles = await prisma.courseLearnerProfile.findMany({
    where: { courseId: { in: targetCourseIds } }
  });

  const distribution = {
    ON_TRACK: 0,
    NEEDS_ATTENTION: 0,
    SUPPORT_RECOMMENDED: 0,
    COMPLETED: 0,
    NOT_STARTED: 0
  };

  profiles.forEach(p => {
    const status = p.learningStatus || 'NOT_STARTED';
    if (distribution[status] !== undefined) {
      distribution[status] += 1;
    } else {
      distribution.ON_TRACK += 1;
    }
  });

  return {
    instructorId,
    courseId: courseId || 'ALL_ASSIGNED',
    totalTrackedStudents: profiles.length,
    distribution
  };
}
