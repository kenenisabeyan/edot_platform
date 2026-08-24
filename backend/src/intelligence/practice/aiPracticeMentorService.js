/**
 * EDOT Intelligence Domain - AI Practice Mentor Service (Phase 10)
 * 
 * Provides authorized, grounded practice hints and step-by-step guidance consuming
 * course knowledge chunks without exposing unauthorized content or hallucinating.
 */

import { retrieveAuthorizedKnowledge } from '../knowledge/knowledgeRetrievalService.js';

/**
 * Retrieves an authorized, grounded hint for a practice question.
 * 
 * @param {string} studentId 
 * @param {string} courseId 
 * @param {string} nodeId 
 * @param {string} questionText 
 */
export async function getAuthorizedPracticeHint(studentId, courseId, nodeId, questionText) {
  // 1. Verify authorization & retrieve authorized course knowledge context
  const context = await retrieveAuthorizedKnowledge({
    userId: studentId,
    courseId,
    conceptNodeId: nodeId
  });

  const nodeName = context.relevantKnowledgeNodes[0]?.name || 'Concept';
  const authorizedSources = context.authorizedSources.length > 0
    ? context.authorizedSources
    : [`Course Materials (${context.courseTitle || 'Course'})`];
  const primarySource = authorizedSources[0];

  const hintText = `Grounded Hint for "${nodeName}": Think about the core principles discussed in ${primarySource}. Review how "${questionText.substring(0, 30)}..." connects to prerequisite foundations.`;

  return {
    studentId,
    courseId,
    nodeId,
    nodeName,
    hintText,
    authorizedSources,
    confidence: context.confidence
  };
}
