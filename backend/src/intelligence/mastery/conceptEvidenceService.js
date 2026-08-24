/**
 * EDOT Intelligence Domain - Concept Evidence Service (Phase 9)
 * 
 * Traceable evidence collection across 8 source types without storing private AI text.
 */

import { prisma } from '../../../lib/prisma.js';

export const EVIDENCE_SOURCE_TYPES = [
  'LESSON_INTERACTION',
  'QUIZ_ATTEMPT',
  'ASSESSMENT',
  'ASSIGNMENT',
  'PRACTICE',
  'REPEATED_ATTEMPT',
  'MISCONCEPTION_SIGNAL',
  'INSTRUCTOR_REVIEW'
];

/**
 * Records a traceable evidence signal for a student's concept engagement.
 * Idempotent: Prevents duplicate evidence creation for identical sourceId & sourceType.
 */
export async function recordConceptEvidence({
  studentId,
  nodeId,
  courseId = null,
  sourceType,
  sourceId = null,
  signalType = 'PERFORMANCE',
  value = 1.0,
  weight = 1.0,
  confidence = 1.0,
  occurredAt = new Date()
}) {
  if (!studentId || !nodeId || !sourceType) {
    throw new Error('studentId, nodeId, and sourceType are required to record concept evidence.');
  }

  // Check idempotency if sourceId is provided
  if (sourceId) {
    const existing = await prisma.masteryEvidence.findFirst({
      where: { studentId, nodeId, sourceType, sourceId }
    });
    if (existing) {
      return existing; // Idempotent return without duplicate creation
    }
  }

  // Create evidence record
  const evidence = await prisma.masteryEvidence.create({
    data: {
      studentId,
      nodeId,
      courseId,
      sourceType,
      sourceId,
      signalType,
      value: Math.round(value * 100) / 100,
      weight: Math.round(weight * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      occurredAt
    }
  });

  return evidence;
}

/**
 * Retrieves all evidence records for a student and concept node.
 */
export async function getConceptEvidenceSummary(studentId, nodeId) {
  const evidenceList = await prisma.masteryEvidence.findMany({
    where: { studentId, nodeId },
    orderBy: { occurredAt: 'desc' }
  });

  const totalCount = evidenceList.length;
  const positiveSignals = evidenceList.filter(e => e.value >= 0.7).length;
  const negativeSignals = evidenceList.filter(e => e.value < 0.5).length;

  return {
    studentId,
    nodeId,
    totalEvidenceCount: totalCount,
    positiveSignalsCount: positiveSignals,
    negativeSignalsCount: negativeSignals,
    evidenceList
  };
}
