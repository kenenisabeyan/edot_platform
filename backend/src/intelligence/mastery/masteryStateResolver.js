/**
 * EDOT Intelligence Domain - Mastery State Resolver (Phase 9)
 * 
 * Core Principle: Quiz Score ≠ Mastery.
 * State Transitions: UNKNOWN → EXPOSED → LEARNING → DEVELOPING → PROFICIENT → MASTERED / NEEDS_REINFORCEMENT.
 * Data Sufficiency: SUFFICIENT_DATA | LIMITED_DATA | INSUFFICIENT_DATA | STALE.
 */

import { prisma } from '../../../lib/prisma.js';
import { getNodePrerequisites } from '../knowledge/prerequisiteService.js';

export const MASTERY_STATES = [
  'UNKNOWN',
  'EXPOSED',
  'LEARNING',
  'DEVELOPING',
  'PROFICIENT',
  'MASTERED',
  'NEEDS_REINFORCEMENT'
];

/**
 * Resolves the explainable concept mastery state, confidence, and data sufficiency for a student and concept node.
 */
export async function resolveMasteryState(studentId, nodeId, courseId = null) {
  const now = new Date();

  // Fetch all evidence records for this student and node
  const evidenceList = await prisma.masteryEvidence.findMany({
    where: { studentId, nodeId },
    orderBy: { occurredAt: 'desc' }
  });

  const evidenceCount = evidenceList.length;

  // 1. Check Data Sufficiency Status
  let dataStatus = 'INSUFFICIENT_DATA';
  if (evidenceCount >= 5) dataStatus = 'SUFFICIENT_DATA';
  else if (evidenceCount >= 1) dataStatus = 'LIMITED_DATA';

  if (evidenceCount === 0) {
    return upsertMasteryRecord({
      studentId,
      nodeId,
      courseId,
      masteryScore: 0.0,
      masteryState: 'UNKNOWN',
      dataStatus: 'INSUFFICIENT_DATA',
      masteryConfidence: 0.0,
      evidenceCount: 0,
      prerequisiteMasteryMet: true,
      lastEvidenceAt: null
    });
  }

  // 2. Evaluate Signals
  const positiveCount = evidenceList.filter(e => e.value >= 0.7).length;
  const negativeCount = evidenceList.filter(e => e.value < 0.5).length;
  const lessonExposures = evidenceList.filter(e => e.sourceType === 'LESSON_INTERACTION').length;
  const quizAttempts = evidenceList.filter(e => e.sourceType === 'QUIZ_ATTEMPT' || e.sourceType === 'ASSESSMENT').length;

  // Recency Decay
  const latestEvidence = evidenceList[0];
  const lastEvidenceAt = latestEvidence.occurredAt;
  const daysSinceLastEvidence = Math.max(0, Math.floor((now.getTime() - new Date(lastEvidenceAt).getTime()) / (24 * 60 * 60 * 1000)));
  const decayFactor = Math.max(0.5, Math.pow(0.96, daysSinceLastEvidence));

  // Base weighted score
  const totalWeight = evidenceList.reduce((sum, e) => sum + e.weight, 0);
  const weightedSum = evidenceList.reduce((sum, e) => sum + (e.value * e.weight), 0);
  const rawScore = totalWeight > 0 ? (weightedSum / totalWeight) : 0.0;
  const effectiveScore = Math.min(1.0, Math.max(0.0, rawScore * decayFactor));

  // Prerequisite Check
  const prereqs = await getNodePrerequisites(nodeId);
  let prerequisiteMasteryMet = true;
  if (prereqs.length > 0) {
    const prereqRecords = await prisma.learnerConceptMastery.findMany({
      where: { userId: studentId, nodeId: { in: prereqs.map(p => p.id) } }
    });
    const unmastered = prereqRecords.filter(m => m.masteryState === 'UNKNOWN' || m.masteryState === 'LEARNING' || m.masteryState === 'DEVELOPING');
    if (unmastered.length > 0 || prereqRecords.length < prereqs.length) {
      prerequisiteMasteryMet = false;
    }
  }

  // Fetch existing state to prevent erratic downgrades on single poor result
  const existingRecord = await prisma.learnerConceptMastery.findUnique({
    where: { userId_nodeId: { userId: studentId, nodeId } }
  });
  const previousState = existingRecord ? existingRecord.masteryState : 'UNKNOWN';

  // State Transition Logic
  let masteryState = 'UNKNOWN';

  if (evidenceCount === 1 && quizAttempts === 1 && positiveCount === 1) {
    // Single quiz question success -> LIMITED_DATA & DEVELOPING (never MASTERED)
    masteryState = 'DEVELOPING';
    dataStatus = 'LIMITED_DATA';
  } else if (negativeCount >= 3 && previousState === 'PROFICIENT') {
    // Repeated meaningful difficulty after previous proficiency -> NEEDS_REINFORCEMENT
    masteryState = 'NEEDS_REINFORCEMENT';
  } else if (previousState === 'PROFICIENT' && negativeCount === 1 && positiveCount >= 4) {
    // Single poor result after strong performance -> MAINTAIN PROFICIENT
    masteryState = 'PROFICIENT';
  } else if (positiveCount >= 5 && dataStatus === 'SUFFICIENT_DATA' && prerequisiteMasteryMet && effectiveScore >= 0.85) {
    // Repeated consistent performance with sufficient data & prerequisites met -> MASTERED
    masteryState = 'MASTERED';
    dataStatus = 'SUFFICIENT_DATA';
  } else if (positiveCount >= 3 && effectiveScore >= 0.70) {
    masteryState = 'PROFICIENT';
  } else if (positiveCount >= 1 && effectiveScore >= 0.40) {
    masteryState = 'DEVELOPING';
  } else if (lessonExposures >= 1) {
    masteryState = 'EXPOSED';
  } else {
    masteryState = 'LEARNING';
  }

  // Mandatory Safety Rule: MASTERED state CANNOT be declared with INSUFFICIENT_DATA
  if (masteryState === 'MASTERED' && dataStatus === 'INSUFFICIENT_DATA') {
    masteryState = 'DEVELOPING';
  }

  const confidenceScore = Math.min(1.0, Math.max(0.2, (0.5 + (evidenceCount * 0.1) - (prerequisiteMasteryMet ? 0 : 0.2))));

  return upsertMasteryRecord({
    studentId,
    nodeId,
    courseId,
    masteryScore: Math.round(effectiveScore * 100) / 100,
    masteryState,
    dataStatus,
    masteryConfidence: Math.round(confidenceScore * 100) / 100,
    decayFactor: Math.round(decayFactor * 100) / 100,
    evidenceCount,
    prerequisiteMasteryMet,
    lastEvidenceAt
  });
}

async function upsertMasteryRecord({
  studentId,
  nodeId,
  courseId,
  masteryScore,
  masteryState,
  dataStatus,
  masteryConfidence,
  decayFactor = 1.0,
  evidenceCount = 0,
  prerequisiteMasteryMet = true,
  lastEvidenceAt = null
}) {
  const now = new Date();

  return prisma.learnerConceptMastery.upsert({
    where: { userId_nodeId: { userId: studentId, nodeId } },
    create: {
      userId: studentId,
      nodeId,
      courseId,
      masteryScore,
      masteryLevel: masteryState,
      masteryState,
      dataStatus,
      confidenceScore: masteryConfidence,
      masteryConfidence,
      decayFactor,
      evidenceCount,
      prerequisiteMasteryMet,
      lastEvidenceAt: lastEvidenceAt || now,
      lastEvaluatedAt: now,
      totalAttempts: evidenceCount
    },
    update: {
      courseId,
      masteryScore,
      masteryLevel: masteryState,
      masteryState,
      dataStatus,
      confidenceScore: masteryConfidence,
      masteryConfidence,
      decayFactor,
      evidenceCount,
      prerequisiteMasteryMet,
      lastEvidenceAt: lastEvidenceAt || now,
      lastEvaluatedAt: now,
      updatedAt: now
    }
  });
}
