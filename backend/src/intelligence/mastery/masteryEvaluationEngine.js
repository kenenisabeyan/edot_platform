/**
 * EDOT Intelligence Domain - Concept Mastery Evaluation Engine (Phase 9)
 * 
 * Computes true concept & skill mastery for students by integrating:
 * 1. Learner Telemetry & Quiz Question accuracy (Phases 0–7).
 * 2. Knowledge Nodes & Prerequisite Graphs (Phase 8).
 * 3. Time-based retention decay curves (Ebbinghaus decay).
 * 4. Prerequisite confidence weighting.
 */

import { prisma } from '../../../lib/prisma.js';
import { getNodePrerequisites } from '../knowledge/prerequisiteService.js';

/**
 * Evaluates and updates concept mastery records for a target student in a course.
 * 
 * @param {string} studentId 
 * @param {string} courseId 
 */
export async function evaluateStudentConceptMastery(studentId, courseId) {
  if (!studentId || !courseId) {
    throw new Error('studentId and courseId are required for concept mastery evaluation.');
  }

  const now = new Date();

  // 1. Fetch all mapped KnowledgeNodes for this course
  const mappings = await prisma.knowledgeContentMapping.findMany({
    where: { courseId, reviewStatus: { in: ['APPROVED', 'AUTO_DETECTED'] } },
    include: { node: true }
  });

  const nodeMap = new Map();
  mappings.forEach(m => nodeMap.set(m.nodeId, m.node));
  const nodes = Array.from(nodeMap.values());

  // 2. Fetch student quiz attempts for this course
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { userId: studentId, courseId },
    orderBy: { createdAt: 'desc' }
  });

  // 3. Fetch student learning events
  const learningEvents = await prisma.learningEvent.findMany({
    where: { userId: studentId, courseId },
    orderBy: { timestamp: 'desc' }
  });

  const evaluatedMasteries = [];

  for (const node of nodes) {
    // Determine attempt count & success count from quiz attempts
    const totalAttempts = quizAttempts.length;
    const successfulAttempts = quizAttempts.filter(q => q.isCorrect || q.score >= 70).length;

    let baseAccuracy = totalAttempts > 0 ? (successfulAttempts / totalAttempts) : 0.5;
    if (learningEvents.length >= 5) baseAccuracy = Math.min(1.0, baseAccuracy + 0.15);

    // Retention decay curve based on days since last activity
    const lastEvent = learningEvents[0];
    const lastPracticedAt = lastEvent ? new Date(lastEvent.timestamp) : now;
    const daysSincePractice = Math.max(0, Math.floor((now.getTime() - lastPracticedAt.getTime()) / (24 * 60 * 60 * 1000)));

    const decayFactor = Math.max(0.5, Math.pow(0.96, daysSincePractice));

    // Prerequisite Node Weighting Check
    const prereqs = await getNodePrerequisites(node.id);
    let prerequisiteMasteryMet = true;
    let prereqConfidencePenalty = 0.0;

    if (prereqs.length > 0) {
      const prereqMasteries = await prisma.learnerConceptMastery.findMany({
        where: { userId: studentId, nodeId: { in: prereqs.map(p => p.id) } }
      });

      const unmasteredPrereqs = prereqMasteries.filter(m => m.masteryLevel === 'NOVICE' || m.masteryLevel === 'DEVELOPING');
      if (unmasteredPrereqs.length > 0 || prereqMasteries.length < prereqs.length) {
        prerequisiteMasteryMet = false;
        prereqConfidencePenalty = 0.2;
      }
    }

    const effectiveScore = Math.min(1.0, Math.max(0.0, baseAccuracy * decayFactor));
    const confidenceScore = Math.min(1.0, Math.max(0.2, (0.85 - prereqConfidencePenalty)));

    // Categorize mastery level
    let masteryLevel = 'NOVICE';
    if (effectiveScore >= 0.85) masteryLevel = 'MASTERY';
    else if (effectiveScore >= 0.70) masteryLevel = 'PROFICIENT';
    else if (effectiveScore >= 0.40) masteryLevel = 'DEVELOPING';

    // Upsert LearnerConceptMastery record
    const masteryRecord = await prisma.learnerConceptMastery.upsert({
      where: { userId_nodeId: { userId: studentId, nodeId: node.id } },
      create: {
        userId: studentId,
        nodeId: node.id,
        courseId,
        masteryScore: Math.round(effectiveScore * 100) / 100,
        masteryLevel,
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        decayFactor: Math.round(decayFactor * 100) / 100,
        lastEvaluatedAt: now,
        lastPracticedAt,
        totalAttempts,
        successfulAttempts,
        prerequisiteMasteryMet
      },
      update: {
        courseId,
        masteryScore: Math.round(effectiveScore * 100) / 100,
        masteryLevel,
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        decayFactor: Math.round(decayFactor * 100) / 100,
        lastEvaluatedAt: now,
        lastPracticedAt,
        totalAttempts,
        successfulAttempts,
        prerequisiteMasteryMet,
        updatedAt: now
      }
    });

    evaluatedMasteries.push(masteryRecord);
  }

  return {
    studentId,
    courseId,
    evaluatedCount: evaluatedMasteries.length,
    masteries: evaluatedMasteries,
    evaluatedAt: now
  };
}

/**
 * Retrieves student concept mastery records.
 * 
 * @param {string} studentId 
 * @param {string} [courseId] 
 */
export async function getStudentConceptMastery(studentId, courseId = null) {
  const where = { userId: studentId };
  if (courseId) where.courseId = courseId;

  return prisma.learnerConceptMastery.findMany({
    where,
    include: { node: { select: { id: true, name: true, type: true, category: true } } },
    orderBy: { masteryScore: 'desc' }
  });
}
