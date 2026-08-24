/**
 * EDOT Intelligence Domain - Assessment Intelligence Service (Phase 9)
 * 
 * Determines concept coverage measured by assessments (quizzes) without claiming
 * full mastery for unassessed concepts.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Evaluates concept coverage and quality health for a target quiz/assessment.
 * 
 * @param {string} courseId 
 * @param {string} quizId 
 */
export async function evaluateAssessmentConceptCoverage(courseId, quizId) {
  // 1. Fetch course knowledge mappings
  const courseMappings = await prisma.knowledgeContentMapping.findMany({
    where: { courseId, reviewStatus: { in: ['APPROVED', 'AUTO_DETECTED'] } },
    include: { node: true }
  });

  const totalCourseNodes = courseMappings.length;

  // 2. Fetch quiz attempt data for this quiz
  const attempts = await prisma.quizAttempt.findMany({
    where: { courseId, quizId }
  });

  // 3. Resolve questions mapped to nodes
  const quizMappings = courseMappings.filter(m => m.quizId === quizId || m.contentType === 'QUIZ');
  const assessedNodeIds = new Set(quizMappings.map(m => m.nodeId));

  let coverageStatus = 'UNASSESSED';
  if (assessedNodeIds.size === totalCourseNodes && totalCourseNodes > 0) {
    coverageStatus = 'FULL_CONCEPT_COVERAGE';
  } else if (assessedNodeIds.size > 0) {
    coverageStatus = 'PARTIAL_CONCEPT_COVERAGE';
  }

  let healthStatus = 'INSUFFICIENT_DATA';
  if (attempts.length >= 5) {
    const passCount = attempts.filter(a => a.isCorrect).length;
    const passRate = passCount / attempts.length;

    if (passRate < 0.2 || passRate > 0.95) {
      healthStatus = 'REVIEW_RECOMMENDED';
    } else {
      healthStatus = 'HEALTHY';
    }
  }

  return {
    courseId,
    quizId,
    totalCourseNodes,
    assessedNodesCount: assessedNodeIds.size,
    coverageStatus,
    healthStatus,
    totalAttemptsEvaluated: attempts.length,
    assessedNodes: Array.from(assessedNodeIds)
  };
}
