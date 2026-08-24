/**
 * EDOT Intelligence Domain - Learner Context Resolver (Phase 10)
 * 
 * Unifies 10 Intelligence Inputs:
 * 1. Student Identity & Goals (LearnerProfile)
 * 2. Authorized Enrollment & Course Progress (Enrollment, ProgressLog)
 * 3. Current Course Structure (Course, Lesson, Quiz, Assignment)
 * 4. Recent Telemetry (LearningEvent)
 * 5. Learning Pulse (Activity, Fatigue, Nudges)
 * 6. Concept Mastery Records (LearnerConceptMastery)
 * 7. Prerequisite Graph & Gaps (KnowledgeNode, KnowledgeRelationship)
 * 8. Misconception Signals (LearnerWeakness)
 * 9. Existing Recommendations & Dismissal Memory (PersonalizedLearningAction)
 * 10. Available Authorized Content (KnowledgeContentMapping)
 */

import { prisma } from '../../../lib/prisma.js';
import { identifyPrerequisiteGaps } from '../mastery/prerequisiteGapService.js';

export async function resolveLearnerContext(studentId, courseId = null) {
  if (!studentId) {
    throw new Error('studentId is required for LearnerContextResolver.');
  }

  // 1. Fetch Student Identity & Profile
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, role: true }
  });

  const profile = await prisma.learnerProfile.findUnique({
    where: { userId: studentId }
  });

  // 2. Fetch Enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: 'approved' },
    include: { course: true }
  });

  const activeCourseId = courseId || (enrollments.length > 0 ? enrollments[0].courseId : null);

  if (!activeCourseId) {
    return {
      studentId,
      user,
      profile,
      enrollments,
      activeCourseId: null,
      courseProgress: null,
      pulse: { isFatigued: false },
      masteries: [],
      prerequisiteGaps: [],
      weakConcepts: [],
      dismissedActionTypes: []
    };
  }

  // 3. Fetch Course & Lessons
  const course = await prisma.course.findUnique({
    where: { id: activeCourseId },
    include: {
      lessons: { orderBy: { order: 'asc' } }
    }
  });

  // 4. Fetch Progress Logs
  const progressLogs = await prisma.progressLog.findMany({
    where: { userId: studentId, courseId: activeCourseId, isVideoComplete: true }
  });
  const completedLessonIds = new Set(progressLogs.map(p => p.lessonId));

  // 5. Fetch Recent Telemetry (Learning Pulse & Fatigue)
  const recentEvents = await prisma.learningEvent.findMany({
    where: { userId: studentId, courseId: activeCourseId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const recentFailures = recentEvents.filter(e => e.eventType === 'QUIZ_ATTEMPT' && e.metadata?.isCorrect === false).length;
  const isFatigued = recentEvents.length >= 8 && recentFailures >= 4;

  // 6. Fetch Concept Masteries
  const masteries = await prisma.learnerConceptMastery.findMany({
    where: { userId: studentId, courseId: activeCourseId },
    include: { node: true },
    orderBy: { updatedAt: 'desc' }
  });

  // 7. Resolve Prerequisite Gaps
  const prerequisiteGaps = [];
  for (const m of masteries) {
    if (m.masteryState === 'LEARNING' || m.masteryState === 'DEVELOPING' || m.masteryState === 'NEEDS_REINFORCEMENT') {
      const pGaps = await identifyPrerequisiteGaps(studentId, m.nodeId);
      if (pGaps.hasPrerequisiteGap) {
        prerequisiteGaps.push(pGaps);
      }
    }
  }

  // 8. Filter Weak Concepts & Retention Decay
  const weakConcepts = masteries.filter(m => m.masteryState === 'NEEDS_REINFORCEMENT' || m.masteryState === 'DEVELOPING' || m.decayFactor < 0.85);

  // 9. Fetch Dismissed Action History (Cooldown / Dismissal Memory)
  const dismissedActions = await prisma.personalizedLearningAction.findMany({
    where: { studentId, courseId: activeCourseId, status: 'DISMISSED' },
    select: { actionType: true, targetNodeId: true, targetLessonId: true }
  });

  return {
    studentId,
    user,
    profile,
    enrollments,
    activeCourseId,
    course,
    completedLessonIds,
    recentEvents,
    pulse: { isFatigued, recentFailures, totalRecentEvents: recentEvents.length },
    masteries,
    prerequisiteGaps,
    weakConcepts,
    dismissedActions
  };
}
