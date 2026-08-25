/**
 * EDOT Intelligence — Phase 12
 * Skill Evidence Engine
 *
 * Aggregates real educational evidence from multiple sources and
 * computes evidence states for a student's skills.
 *
 * PRINCIPLE:
 *   A student NEVER receives a skill merely by clicking "complete lesson."
 *   Evidence must come from demonstrated performance: quiz scores,
 *   assignment results, mastery evidence, practice sessions, and
 *   instructor evaluations.
 *
 * Evidence States (NOT job qualifications — EDOT learning evidence only):
 *   NOT_STARTED       — no evidence found for this skill
 *   EXPLORING         — some exposure (lessons viewed) but minimal performance evidence
 *   DEVELOPING        — quiz/assignment evidence present but inconsistent
 *   DEMONSTRATING     — consistent correct performance across multiple sources
 *   STRONG_EVIDENCE   — strong multi-source performance evidence with mastery signals
 */

import { prisma } from '../../../lib/prisma.js';

export const SKILL_EVIDENCE_STATES = [
  'NOT_STARTED',
  'EXPLORING',
  'DEVELOPING',
  'DEMONSTRATING',
  'STRONG_EVIDENCE'
];

// ── Evidence Source Weights ───────────────────────────────────────────────────

const SOURCE_WEIGHTS = {
  KNOWLEDGE_MASTERY: 1.4,   // Phase 9 mastery evidence — highest weight
  QUIZ_ATTEMPT: 1.0,        // quiz performance
  ASSIGNMENT: 1.2,          // assignment performance
  PRACTICE: 0.9,            // practice session
  LESSON_COMPLETION: 0.3,   // lesson completion — minimum weight, alone = EXPLORING only
  INSTRUCTOR_EVALUATION: 1.5 // instructor evaluation — highest weight when present
};

// ── Core Evidence Aggregator ──────────────────────────────────────────────────

/**
 * Computes evidence state and confidence for a specific skill (SkillNode)
 * for a given student.
 *
 * Draws from:
 * - Phase 9: LearnerConceptMastery records linked to this SkillNode via KnowledgeNodeSkillMapping
 * - QuizAttempts for courses that map this SkillNode
 * - PracticeSession records for nodes mapped to this SkillNode
 * - LearnerSkill records (legacy skill ledger)
 *
 * @param {string} userId
 * @param {string} skillNodeId
 * @returns {Promise<{
 *   skillNodeId: string,
 *   evidenceState: string,
 *   confidence: number,
 *   evidenceCount: number,
 *   sources: Array,
 *   explanation: string
 * }>}
 */
export async function computeSkillEvidenceState(userId, skillNodeId) {
  // 1. Get KnowledgeNodes mapped to this skill
  const knowledgeMappings = await prisma.knowledgeNodeSkillMapping.findMany({
    where: { skillNodeId },
    select: { knowledgeNodeId: true, evidenceWeight: true }
  });

  const nodeIds = knowledgeMappings.map(m => m.knowledgeNodeId);

  // 2. Get Phase 9 mastery records for those knowledge nodes
  let masteryEvidence = [];
  if (nodeIds.length > 0) {
    masteryEvidence = await prisma.learnerConceptMastery.findMany({
      where: { userId, nodeId: { in: nodeIds } },
      select: {
        nodeId: true,
        masteryState: true,
        masteryScore: true,
        masteryConfidence: true,
        evidenceCount: true,
        dataStatus: true
      }
    });
  }

  // 3. Get course skill mappings for quiz evidence
  const courseSkillMappings = await prisma.courseSkillMapping.findMany({
    where: { skillId: skillNodeId },
    select: { courseId: true }
  });
  const skillCourseIds = courseSkillMappings.map(m => m.courseId);

  // 4. Get quiz attempts in those courses (last 90 days to keep it recent)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  let quizAttempts = [];
  if (skillCourseIds.length > 0) {
    quizAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        courseId: { in: skillCourseIds },
        createdAt: { gte: ninetyDaysAgo }
      },
      select: { isCorrect: true, createdAt: true }
    });
  }

  // 5. Get practice sessions for linked knowledge nodes
  let practiceSessions = [];
  if (nodeIds.length > 0) {
    practiceSessions = await prisma.practiceSession.findMany({
      where: { userId, nodeId: { in: nodeIds } },
      select: { score: true, status: true, completedAt: true }
    });
  }

  // 6. Legacy: LearnerSkill record (if it exists — provides fallback mastery score)
  // We look up by matching skill names through the SkillNode
  const skillNode = await prisma.skillNode.findUnique({
    where: { id: skillNodeId },
    select: { name: true, code: true }
  });

  let legacySkill = null;
  if (skillNode) {
    legacySkill = await prisma.learnerSkill.findFirst({
      where: {
        userId,
        name: { contains: skillNode.name, mode: 'insensitive' }
      },
      include: { evidences: true }
    });
  }

  // ── Evidence Scoring ──────────────────────────────────────────────────────

  const sources = [];
  let weightedScore = 0;
  let totalWeight = 0;

  // Phase 9 Mastery Evidence
  masteryEvidence.forEach(m => {
    const mapping = knowledgeMappings.find(km => km.knowledgeNodeId === m.nodeId);
    const nodeWeight = mapping ? mapping.evidenceWeight : 1.0;
    const masteryWeight = SOURCE_WEIGHTS.KNOWLEDGE_MASTERY * nodeWeight;

    let masteryValue = 0;
    const s = m.masteryState;
    if (s === 'MASTERED') masteryValue = 1.0;
    else if (s === 'PROFICIENT') masteryValue = 0.85;
    else if (s === 'DEVELOPING') masteryValue = 0.65;
    else if (s === 'LEARNING') masteryValue = 0.45;
    else if (s === 'EXPOSED') masteryValue = 0.25;

    weightedScore += masteryValue * masteryWeight;
    totalWeight += masteryWeight;

    if (m.dataStatus !== 'INSUFFICIENT_DATA') {
      sources.push({
        sourceType: 'KNOWLEDGE_MASTERY',
        state: m.masteryState,
        score: m.masteryScore,
        confidence: m.masteryConfidence
      });
    }
  });

  // Quiz Attempts
  if (quizAttempts.length > 0) {
    const correctCount = quizAttempts.filter(q => q.isCorrect).length;
    const quizScore = correctCount / quizAttempts.length;
    weightedScore += quizScore * SOURCE_WEIGHTS.QUIZ_ATTEMPT;
    totalWeight += SOURCE_WEIGHTS.QUIZ_ATTEMPT;
    sources.push({
      sourceType: 'QUIZ_ATTEMPT',
      attemptsCount: quizAttempts.length,
      correctCount,
      score: Math.round(quizScore * 100)
    });
  }

  // Practice Sessions (completed only)
  const completedSessions = practiceSessions.filter(
    p => p.status === 'COMPLETED'
  );
  if (completedSessions.length > 0) {
    const avgScore =
      completedSessions.reduce((sum, p) => sum + (p.score || 0), 0) /
      completedSessions.length;
    weightedScore += avgScore * SOURCE_WEIGHTS.PRACTICE;
    totalWeight += SOURCE_WEIGHTS.PRACTICE;
    sources.push({
      sourceType: 'PRACTICE',
      sessionsCount: completedSessions.length,
      avgScore: Math.round(avgScore * 100)
    });
  }

  // Legacy Skill (if found with evidences)
  if (legacySkill && legacySkill.evidences.length > 0) {
    const legacyScore = legacySkill.masteryScore / 100;
    weightedScore += legacyScore * 0.8;
    totalWeight += 0.8;
    sources.push({
      sourceType: 'LEGACY_SKILL_RECORD',
      masteryScore: legacySkill.masteryScore,
      evidenceCount: legacySkill.evidences.length
    });
  }

  // ── State Computation ─────────────────────────────────────────────────────

  const evidenceCount = sources.length;

  // No evidence at all
  if (evidenceCount === 0 && quizAttempts.length === 0 && masteryEvidence.length === 0) {
    return {
      skillNodeId,
      skillName: skillNode?.name || skillNodeId,
      evidenceState: 'NOT_STARTED',
      confidence: 0,
      evidenceCount: 0,
      sources: [],
      explanation: 'No learning evidence found for this skill in EDOT.'
    };
  }

  // Compute normalized score (0–1)
  const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Map score to evidence state
  let evidenceState;
  let confidence;

  if (normalizedScore >= 0.80) {
    evidenceState = 'STRONG_EVIDENCE';
    confidence = 0.9;
  } else if (normalizedScore >= 0.65) {
    evidenceState = 'DEMONSTRATING';
    confidence = 0.75;
  } else if (normalizedScore >= 0.45) {
    evidenceState = 'DEVELOPING';
    confidence = 0.6;
  } else if (normalizedScore >= 0.15) {
    evidenceState = 'EXPLORING';
    confidence = 0.45;
  } else {
    evidenceState = 'EXPLORING';
    confidence = 0.3;
  }

  // Guard: if only lesson completion evidence, cap at EXPLORING
  const onlyLessonEvidence = sources.every(
    s => s.sourceType === 'LESSON_COMPLETION'
  );
  if (onlyLessonEvidence) {
    evidenceState = 'EXPLORING';
    confidence = Math.min(confidence, 0.4);
  }

  // Build explanation
  const explanationParts = [];
  if (masteryEvidence.length > 0) {
    const masteredCount = masteryEvidence.filter(m =>
      ['MASTERED', 'PROFICIENT'].includes(m.masteryState)
    ).length;
    explanationParts.push(
      `${masteryEvidence.length} related concept(s) assessed via mastery engine${masteredCount > 0 ? `, ${masteredCount} at proficient/mastered level` : ''}`
    );
  }
  if (quizAttempts.length > 0) {
    const correct = quizAttempts.filter(q => q.isCorrect).length;
    explanationParts.push(
      `${quizAttempts.length} quiz attempt(s) with ${correct} correct`
    );
  }
  if (completedSessions.length > 0) {
    explanationParts.push(
      `${completedSessions.length} completed practice session(s)`
    );
  }

  return {
    skillNodeId,
    skillName: skillNode?.name || skillNodeId,
    evidenceState,
    confidence: Math.round(confidence * 100) / 100,
    evidenceCount: sources.length,
    normalizedScore: Math.round(normalizedScore * 100),
    sources,
    explanation:
      explanationParts.length > 0
        ? `Based on your current learning evidence: ${explanationParts.join('; ')}.`
        : 'Based on your current learning activity in EDOT.'
  };
}

/**
 * Records a skill evidence event in the LearnerSkill ledger (legacy model).
 * Called by event handlers when quiz/assignment/practice events fire.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.skillName
 * @param {string} params.evidenceType  — QUIZ | ASSIGNMENT | PRACTICE | KNOWLEDGE_MASTERY | COURSE_COMPLETION
 * @param {string} params.sourceId
 * @param {number} params.score         — 0–100
 * @param {string} [params.profileId]   — LearnerProfile.id (optional)
 */
export async function recordSkillEvidence({
  userId,
  skillName,
  evidenceType,
  sourceId,
  score,
  profileId
}) {
  // Ensure LearnerProfile exists
  let resolvedProfileId = profileId;
  if (!resolvedProfileId) {
    const profile = await prisma.learnerProfile.findUnique({
      where: { userId },
      select: { id: true }
    });
    resolvedProfileId = profile?.id;
  }

  if (!resolvedProfileId) return; // no profile yet — skip silently

  // Upsert LearnerSkill
  const learnerSkill = await prisma.learnerSkill.upsert({
    where: { profileId_name: { profileId: resolvedProfileId, name: skillName } },
    create: {
      userId,
      profileId: resolvedProfileId,
      name: skillName,
      masteryScore: score,
      evidenceCount: 1
    },
    update: {
      evidenceCount: { increment: 1 },
      // Running average update
      masteryScore: { set: score } // simplified; a real running avg is computed in skillProfileService
    }
  });

  // Add evidence record
  await prisma.skillEvidence.create({
    data: {
      skillId: learnerSkill.id,
      userId,
      evidenceType,
      title: `${evidenceType} evidence for ${skillName}`,
      sourceId,
      score,
      verificationLevel: score >= 70 ? 'VERIFIED' : 'PARTIAL',
      metadata: { recordedAt: new Date().toISOString() }
    }
  });

  return learnerSkill;
}
