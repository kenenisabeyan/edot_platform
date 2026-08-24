/**
 * EDOT Intelligence Domain - Mastery Gap Resolver (Phase 9)
 * 
 * Identifies concept gaps (`NOVICE`, `DEVELOPING`, or high retention decay)
 * and generates evidence-based remediation recommendations for students, instructors, and guardians.
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateStudentConceptMastery, getStudentConceptMastery } from './masteryEvaluationEngine.js';

/**
 * Identifies concept gaps and generates remediation recommendations for a student.
 * 
 * @param {string} studentId 
 * @param {string} [courseId] 
 */
export async function identifyConceptGaps(studentId, courseId = null) {
  if (courseId) {
    await evaluateStudentConceptMastery(studentId, courseId);
  }

  const masteries = await getStudentConceptMastery(studentId, courseId);

  const gaps = masteries.filter(m =>
    m.masteryLevel === 'NOVICE' ||
    m.masteryLevel === 'DEVELOPING' ||
    m.decayFactor < 0.8 ||
    !m.prerequisiteMasteryMet
  );

  const recommendations = gaps.map(gap => {
    let reason = `Concept "${gap.node?.name || 'Topic'}" shows developing proficiency (${Math.round(gap.masteryScore * 100)}%).`;
    let suggestedAction = 'REVIEW_PRACTICE';
    let title = `Review ${gap.node?.name || 'Concept'}`;

    if (!gap.prerequisiteMasteryMet) {
      reason = `Mastery in "${gap.node?.name || 'Concept'}" is constrained by incomplete prerequisite foundations.`;
      suggestedAction = 'REVIEW_PREREQUISITES';
      title = `Strengthen Prerequisites for ${gap.node?.name || 'Concept'}`;
    } else if (gap.decayFactor < 0.8) {
      reason = `Retention for "${gap.node?.name || 'Concept'}" has naturally decayed over time due to lack of recent practice.`;
      suggestedAction = 'REFRESHER_QUIZ';
      title = `Take Refresher Practice in ${gap.node?.name || 'Concept'}`;
    }

    return {
      nodeId: gap.nodeId,
      nodeName: gap.node?.name || 'Concept',
      nodeType: gap.node?.type || 'CONCEPT',
      masteryLevel: gap.masteryLevel,
      masteryScore: gap.masteryScore,
      decayFactor: gap.decayFactor,
      prerequisiteMasteryMet: gap.prerequisiteMasteryMet,
      title,
      reason,
      suggestedAction,
      evidenceSummary: `Evaluated over ${gap.totalAttempts} practice attempts with ${gap.successfulAttempts} successes.`
    };
  });

  return {
    studentId,
    courseId,
    totalConceptsEvaluated: masteries.length,
    gapCount: gaps.length,
    gaps: recommendations
  };
}
