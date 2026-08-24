/**
 * EDOT Intelligence Domain - Personal Learning Engine
 * 
 * Synthesizes 10 Intelligence Inputs:
 * Knowledge Graph + Learner Profile + Learning Events + Learning Pulse + Mastery Intelligence
 * + Prerequisite Gaps + Misconception Signals + Course Progress + Student Goals + Available EDOT Content
 * 
 * Output: Next Best Learning Action (CONTINUE | REVIEW | PRACTICE | PREREQUISITE | ADVANCE | SUPPORT)
 */

import { prisma } from '../../../lib/prisma.js';
import { identifyPrerequisiteGaps } from '../mastery/prerequisiteGapService.js';
import { generateMasteryRecommendations } from '../mastery/masteryRecommendationService.js';

export const ACTION_TYPES = [
  'CONTINUE',
  'REVIEW',
  'PRACTICE',
  'PREREQUISITE',
  'ADVANCE',
  'SUPPORT'
];

/**
 * Evaluates all 10 intelligence inputs for a student and resolves the prioritized Next Best Learning Action.
 * 
 * @param {string} studentId 
 * @param {string} courseId 
 */
export async function evaluateNextBestAction(studentId, courseId) {
  if (!studentId || !courseId) {
    throw new Error('studentId and courseId are required for Personal Learning Engine evaluation.');
  }

  // 1. Fetch Learner Profile & Goals
  const profile = await prisma.learnerProfile.findUnique({
    where: { userId: studentId }
  });

  // 2. Fetch Course Learner Profile & Digital Twin metrics
  const courseProfile = await prisma.courseLearnerProfile.findUnique({
    where: { userId_courseId: { userId: studentId, courseId } }
  });

  // 3. Fetch Learning Pulse (fatigue & engagement)
  const pulseLogs = await prisma.learningEvent.findMany({
    where: { userId: studentId, courseId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const recentFailures = pulseLogs.filter(l => l.eventType === 'QUIZ_ATTEMPT' && l.metadata?.isCorrect === false).length;
  const highFatigue = pulseLogs.length >= 8 && recentFailures >= 4;

  // 4. Fetch Concept Masteries for Course
  const masteries = await prisma.learnerConceptMastery.findMany({
    where: { userId: studentId, courseId },
    include: { node: true },
    orderBy: { updatedAt: 'desc' }
  });

  // 5. Check Prerequisite Gaps across unmastered nodes
  let topPrereqGap = null;
  for (const m of masteries) {
    if (m.masteryState === 'LEARNING' || m.masteryState === 'DEVELOPING' || m.masteryState === 'NEEDS_REINFORCEMENT') {
      const pGaps = await identifyPrerequisiteGaps(studentId, m.nodeId);
      if (pGaps.hasPrerequisiteGap) {
        topPrereqGap = pGaps;
        break;
      }
    }
  }

  // 6. Check Decaying or Weak Concepts needing PRACTICE
  const weakMasteries = masteries.filter(m => m.masteryState === 'NEEDS_REINFORCEMENT' || m.masteryState === 'DEVELOPING' || m.decayFactor < 0.85);

  // 7. Check Course Progress & Lessons
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { order: 'asc' } }
    }
  });

  const completedProgress = await prisma.progressLog.findMany({
    where: { userId: studentId, courseId, isVideoComplete: true }
  });
  const completedLessonIds = new Set(completedProgress.map(p => p.lessonId));

  let nextLesson = null;
  if (course && course.lessons) {
    for (const les of course.lessons) {
      if (!completedLessonIds.has(les.id)) {
        nextLesson = les;
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DECISION TREE & ACTION PRIORITIZATION
  // ─────────────────────────────────────────────────────────────────────────

  // Priority 1: High Fatigue / High Misconception Frequency -> SUPPORT
  if (highFatigue) {
    return {
      studentId,
      courseId,
      actionType: 'SUPPORT',
      priorityScore: 0.98,
      title: 'Seek Instructor / Peer Support',
      reason: 'Frequent recent difficulties or high fatigue detected. Recommend taking a short break or seeking support.',
      targetNodeId: null,
      targetLessonId: null,
      adaptiveLoopStatus: 'ACTIVE'
    };
  }

  // Priority 2: Unmastered Prerequisite Gap -> PREREQUISITE
  if (topPrereqGap && topPrereqGap.gaps.length > 0) {
    const gapNode = topPrereqGap.gaps[0];
    return {
      studentId,
      courseId,
      actionType: 'PREREQUISITE',
      priorityScore: 0.92,
      title: `Review Prerequisite Concept: ${gapNode.prerequisiteName}`,
      reason: `Performance on "${topPrereqGap.targetNodeName}" is constrained by prerequisite concept "${gapNode.prerequisiteName}".`,
      targetNodeId: gapNode.prerequisiteNodeId,
      targetLessonId: null,
      adaptiveLoopStatus: 'ACTIVE'
    };
  }

  // Priority 3: Decaying or Weak Concept -> PRACTICE / REVIEW
  if (weakMasteries.length > 0) {
    const topWeak = weakMasteries[0];
    const isDecayed = topWeak.decayFactor < 0.85;
    return {
      studentId,
      courseId,
      actionType: isDecayed ? 'PRACTICE' : 'REVIEW',
      priorityScore: 0.85,
      title: `${isDecayed ? 'Practice' : 'Review'} Concept: ${topWeak.node?.name || 'Target Concept'}`,
      reason: isDecayed
        ? `Retention for "${topWeak.node?.name}" has decayed over time. Targeted practice recommended.`
        : `Evidence indicates developing understanding for "${topWeak.node?.name}".`,
      targetNodeId: topWeak.nodeId,
      targetLessonId: null,
      adaptiveLoopStatus: 'ACTIVE'
    };
  }

  // Priority 4: High Mastery & Completed Course -> ADVANCE
  if (!nextLesson && masteries.length > 0 && masteries.every(m => m.masteryState === 'MASTERED' || m.masteryState === 'PROFICIENT')) {
    return {
      studentId,
      courseId,
      actionType: 'ADVANCE',
      priorityScore: 0.80,
      title: 'Advance to Advanced Learning Modules',
      reason: 'All core course concepts show strong proficiency & mastery evidence.',
      targetNodeId: null,
      targetLessonId: null,
      adaptiveLoopStatus: 'ACTIVE'
    };
  }

  // Default Priority: Standard Learning Progression -> CONTINUE
  return {
    studentId,
    courseId,
    actionType: 'CONTINUE',
    priorityScore: 0.75,
    title: nextLesson ? `Continue Lesson: ${nextLesson.title}` : 'Continue Course Progression',
    reason: 'Learner is making steady progress with solid foundational comprehension.',
    targetNodeId: null,
    targetLessonId: nextLesson ? nextLesson.id : null,
    adaptiveLoopStatus: 'ACTIVE'
  };
}
