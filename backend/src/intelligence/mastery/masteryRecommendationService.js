/**
 * EDOT Intelligence Domain - Mastery Recommendation Engine (Phase 9)
 * 
 * Generates actionable, non-destructive mastery recommendations connecting unmastered
 * or decaying concepts to real EDOT learning actions.
 */

import { prisma } from '../../../lib/prisma.js';
import { identifyPrerequisiteGaps } from './prerequisiteGapService.js';

export const RECOMMENDATION_ACTIONS = [
  'REVIEW_PREREQUISITE',
  'REVIEW_LESSON',
  'PRACTICE_CONCEPT',
  'CONTINUE_LEARNING',
  'SEEK_INSTRUCTOR_SUPPORT'
];

/**
 * Generates mastery recommendations for a student in a course.
 * 
 * @param {string} studentId 
 * @param {string} [courseId] 
 */
export async function generateMasteryRecommendations(studentId, courseId = null) {
  const where = { userId: studentId };
  if (courseId) where.courseId = courseId;

  const masteries = await prisma.learnerConceptMastery.findMany({
    where,
    include: { node: true },
    orderBy: { updatedAt: 'desc' }
  });

  const recommendations = [];

  for (const record of masteries) {
    const state = record.masteryState;
    const nodeName = record.node?.name || 'Concept';

    if (state === 'NEEDS_REINFORCEMENT' || record.decayFactor < 0.8) {
      recommendations.push({
        nodeId: record.nodeId,
        nodeName,
        masteryState: state,
        action: 'PRACTICE_CONCEPT',
        title: `Reinforce ${nodeName}`,
        reason: `Retention for "${nodeName}" has decayed or shows recent performance difficulty.`,
        evidenceSummary: `Evaluated across ${record.evidenceCount} evidence signals.`
      });
    } else if (!record.prerequisiteMasteryMet || state === 'LEARNING') {
      const gapInfo = await identifyPrerequisiteGaps(studentId, record.nodeId);
      if (gapInfo.hasPrerequisiteGap) {
        recommendations.push({
          nodeId: record.nodeId,
          nodeName,
          masteryState: state,
          action: 'REVIEW_PREREQUISITE',
          title: `Review Prerequisites for ${nodeName}`,
          reason: gapInfo.evidenceSummary,
          evidenceSummary: gapInfo.evidenceSummary
        });
      } else {
        recommendations.push({
          nodeId: record.nodeId,
          nodeName,
          masteryState: state,
          action: 'REVIEW_LESSON',
          title: `Review Lesson Content for ${nodeName}`,
          reason: `Concept "${nodeName}" shows active engagement but requires further practice to reach proficiency.`,
          evidenceSummary: `Evaluated across ${record.evidenceCount} evidence signals.`
        });
      }
    } else if (state === 'DEVELOPING') {
      recommendations.push({
        nodeId: record.nodeId,
        nodeName,
        masteryState: state,
        action: 'PRACTICE_CONCEPT',
        title: `Practice ${nodeName}`,
        reason: `Evidence shows developing understanding for "${nodeName}". Additional practice recommended.`,
        evidenceSummary: `Evaluated across ${record.evidenceCount} evidence signals.`
      });
    }
  }

  return {
    studentId,
    courseId,
    totalConceptsEvaluated: masteries.length,
    recommendationCount: recommendations.length,
    recommendations
  };
}
