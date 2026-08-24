/**
 * EDOT Intelligence Domain - Content Intelligence Service
 * 
 * Maps EDOT educational content (Courses, Lessons, Resources, Quizzes, Assignments)
 * to KnowledgeNodes with confidence scores, relevance, and instructor review states.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Maps educational content to a KnowledgeNode.
 * 
 * @param {object} params
 * @param {string} params.nodeId
 * @param {string} params.courseId
 * @param {string} [params.sectionId]
 * @param {string} [params.lessonId]
 * @param {string} [params.contentType='LESSON']
 * @param {string} [params.contentId]
 * @param {number} [params.relevance=1.0]
 * @param {number} [params.confidence=1.0]
 * @param {string} [params.source='AI_EXTRACTED']
 * @param {string} [params.reviewStatus='AUTO_DETECTED']
 * @param {string} [params.createdBy]
 */
export async function mapContentToKnowledgeNode({
  nodeId,
  courseId,
  sectionId = null,
  lessonId = null,
  contentType = 'LESSON',
  contentId = null,
  relevance = 1.0,
  confidence = 1.0,
  source = 'AI_EXTRACTED',
  reviewStatus = 'AUTO_DETECTED',
  createdBy = null
}) {
  if (!nodeId || !courseId) {
    throw new Error('nodeId and courseId are required for content mapping.');
  }

  const existing = await prisma.knowledgeContentMapping.findFirst({
    where: {
      nodeId,
      courseId,
      lessonId,
      contentType,
      contentId
    }
  });

  if (existing) {
    return prisma.knowledgeContentMapping.update({
      where: { id: existing.id },
      data: { relevance, confidence, source, reviewStatus, createdBy, updatedAt: new Date() }
    });
  }

  return prisma.knowledgeContentMapping.create({
    data: {
      nodeId,
      courseId,
      sectionId,
      lessonId,
      contentType,
      contentId,
      relevance,
      confidence,
      source,
      reviewStatus,
      createdBy
    }
  });
}

/**
 * Approves a content mapping (Instructor Action).
 * 
 * @param {string} mappingId 
 * @param {string} instructorId 
 */
export async function approveContentMapping(mappingId, instructorId) {
  const mapping = await prisma.knowledgeContentMapping.findUnique({
    where: { id: mappingId },
    include: { course: { select: { instructorId: true } } }
  });

  if (!mapping) {
    throw new Error('Knowledge content mapping not found.');
  }

  if (mapping.course.instructorId !== instructorId) {
    throw new Error('Unauthorized: Only the course instructor can approve content mappings.');
  }

  return prisma.knowledgeContentMapping.update({
    where: { id: mappingId },
    data: { reviewStatus: 'APPROVED', createdBy: instructorId, updatedAt: new Date() }
  });
}

/**
 * Rejects a content mapping (Instructor Action).
 * 
 * @param {string} mappingId 
 * @param {string} instructorId 
 */
export async function rejectContentMapping(mappingId, instructorId) {
  const mapping = await prisma.knowledgeContentMapping.findUnique({
    where: { id: mappingId },
    include: { course: { select: { instructorId: true } } }
  });

  if (!mapping) {
    throw new Error('Knowledge content mapping not found.');
  }

  if (mapping.course.instructorId !== instructorId) {
    throw new Error('Unauthorized: Only the course instructor can reject content mappings.');
  }

  return prisma.knowledgeContentMapping.update({
    where: { id: mappingId },
    data: { reviewStatus: 'REJECTED', createdBy: instructorId, updatedAt: new Date() }
  });
}

/**
 * Gets knowledge map coverage analysis for a course.
 * 
 * @param {string} courseId 
 */
export async function getCourseKnowledgeMap(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { select: { id: true, title: true, order: true } },
      knowledgeContentMappings: {
        where: { reviewStatus: { in: ['APPROVED', 'AUTO_DETECTED'] } },
        include: { node: true, lesson: { select: { id: true, title: true } } }
      }
    }
  });

  if (!course) {
    throw new Error(`Course not found with ID "${courseId}".`);
  }

  const mappedLessonIds = new Set(course.knowledgeContentMappings.map(m => m.lessonId).filter(Boolean));
  const unmappedLessonsCount = course.lessons.filter(l => !mappedLessonIds.has(l.id)).length;

  return {
    courseId: course.id,
    courseTitle: course.title,
    totalLessons: course.lessons.length,
    mappedLessonsCount: mappedLessonIds.size,
    unmappedLessonsCount,
    totalKnowledgeNodes: course.knowledgeContentMappings.length,
    knowledgeMappings: course.knowledgeContentMappings,
    coverageStatus: (course.lessons.length === 0 || course.knowledgeContentMappings.length === 0)
      ? 'INSUFFICIENT_DATA'
      : (unmappedLessonsCount === 0 ? 'COMPLETE' : 'PARTIAL')
  };
}
