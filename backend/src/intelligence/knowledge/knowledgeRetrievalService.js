/**
 * EDOT Intelligence Domain - Knowledge Retrieval Service
 * 
 * Shared authorized knowledge retrieval service for future AI systems (RAG, AI Mentor, Practice, Assessment).
 * Validates server-side authorization before returning structured, traceable knowledge results.
 */

import { prisma } from '../../../lib/prisma.js';
import { verifyCourseKnowledgeAccess } from './knowledgeAuthorizationService.js';
import { getNodePrerequisites } from './prerequisiteService.js';
import { sanitizeForGuardian } from '../policy/guardianVisibilityPolicy.js';

/**
 * Retrieves authorized, relevant knowledge for a given user, course, lesson, or search query.
 * 
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.courseId
 * @param {string} [params.lessonId]
 * @param {string} [params.query]
 */
export async function retrieveAuthorizedKnowledge({ userId, courseId, lessonId = null, query = null }) {
  // 1. Enforce Server-Side Authorization First
  await verifyCourseKnowledgeAccess(userId, courseId);

  const now = new Date();

  // 2. Fetch Course & Lesson Knowledge Mappings
  const mappings = await prisma.knowledgeContentMapping.findMany({
    where: {
      courseId,
      ...(lessonId ? { lessonId } : {}),
      reviewStatus: { in: ['APPROVED', 'AUTO_DETECTED'] }
    },
    include: {
      node: true,
      lesson: { select: { id: true, title: true, order: true } }
    },
    take: 20
  });

  const relevantKnowledgeNodes = mappings.map(m => m.node);

  // 3. Retrieve prerequisites for detected nodes
  const prerequisitePromises = relevantKnowledgeNodes.map(node => getNodePrerequisites(node.id));
  const prerequisiteLists = await Promise.all(prerequisitePromises);
  const flattenedPrereqs = prerequisiteLists.flat();

  // Deduplicate prerequisites
  const prereqMap = new Map();
  flattenedPrereqs.forEach(p => prereqMap.set(p.id, p));
  const relatedPrerequisites = Array.from(prereqMap.values());

  // 4. Retrieve authorized content chunks
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      courseId,
      ...(lessonId ? { lessonId } : {}),
      processingStatus: 'COMPLETED'
    },
    take: 10
  });

  const relatedLessons = Array.from(
    new Map(mappings.filter(m => m.lesson).map(m => [m.lesson.id, m.lesson])).values()
  );

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  const result = {
    queryContext: {
      userId,
      courseId,
      lessonId,
      query
    },
    relevantKnowledgeNodes,
    relatedPrerequisites,
    relatedLessons,
    authorizedSources: chunks.map(c => ({
      chunkId: c.id,
      lessonId: c.lessonId,
      textSnippet: c.text.slice(0, 150) + '...',
      authorizationScope: c.authorizationScope
    })),
    dataStatus: relevantKnowledgeNodes.length > 0 ? 'SUFFICIENT' : 'INSUFFICIENT_DATA',
    confidence: relevantKnowledgeNodes.length > 0 ? 0.9 : 0.0,
    generatedAt: now
  };

  if (user && (user.role === 'parent' || user.role === 'guardian')) {
    return sanitizeForGuardian(result);
  }

  return result;
}
