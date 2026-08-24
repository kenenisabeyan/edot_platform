/**
 * EDOT Intelligence Domain - Content Processing Pipeline
 * 
 * Asynchronous, non-blocking content processing pipeline. Handles content chunking,
 * versioning, and stale status management. Failures in intelligence processing
 * cannot crash course creation, lesson updates, or student progress.
 */

import { prisma } from '../../../lib/prisma.js';
import { chunkEducationalContent } from './contentChunker.js';
import { extractConceptsFromCourse, extractConceptsFromLesson } from './conceptExtractionService.js';

/**
 * Asynchronously processes course content, creates chunks, and extracts concepts.
 * Non-blocking: Errors are caught and logged without throwing.
 * 
 * @param {string} courseId 
 */
export async function processCourseContent(courseId) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: true }
    });

    if (!course) return { success: false, reason: 'Course not found' };

    // 1. Mark existing chunks for this course as STALE if content updated
    await prisma.knowledgeChunk.updateMany({
      where: { courseId, processingStatus: 'COMPLETED' },
      data: { processingStatus: 'STALE' }
    });

    // 2. Extract concepts
    await extractConceptsFromCourse(courseId);

    // 3. Process & chunk each lesson
    for (const lesson of course.lessons) {
      await processLessonContent(courseId, lesson.id);
    }

    return { success: true, courseId, status: 'COMPLETED' };
  } catch (error) {
    console.error(`[ContentProcessingPipeline] Error processing course "${courseId}":`, error);
    return { success: false, courseId, status: 'FAILED', error: error.message };
  }
}

/**
 * Asynchronously processes a single lesson's content.
 * 
 * @param {string} courseId 
 * @param {string} lessonId 
 */
export async function processLessonContent(courseId, lessonId) {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) return { success: false, reason: 'Lesson not found' };

    // Mark previous chunks as STALE
    await prisma.knowledgeChunk.updateMany({
      where: { lessonId, processingStatus: 'COMPLETED' },
      data: { processingStatus: 'STALE' }
    });

    // Extract concepts for this lesson
    await extractConceptsFromLesson(lessonId);

    // Combine lesson text
    const fullText = `${lesson.title}\n\n${lesson.description || ''}\n\n${lesson.readingMaterials || ''}`;
    const rawChunks = chunkEducationalContent(fullText);

    // Store KnowledgeChunks
    for (const raw of rawChunks) {
      await prisma.knowledgeChunk.create({
        data: {
          courseId,
          lessonId,
          contentVersion: 1,
          chunkIndex: raw.chunkIndex,
          text: raw.text,
          metadata: { lessonTitle: lesson.title, order: lesson.order },
          processingStatus: 'COMPLETED',
          authorizationScope: 'ENROLLED_STUDENTS'
        }
      });
    }

    return { success: true, lessonId, chunkCount: rawChunks.length, status: 'COMPLETED' };
  } catch (error) {
    console.error(`[ContentProcessingPipeline] Error processing lesson "${lessonId}":`, error);
    return { success: false, lessonId, status: 'FAILED', error: error.message };
  }
}

/**
 * Handles lesson content updates: Marks existing chunks as STALE and queues re-processing.
 * 
 * @param {string} courseId 
 * @param {string} lessonId 
 */
export async function markContentStaleAndReprocess(courseId, lessonId) {
  await prisma.knowledgeChunk.updateMany({
    where: { lessonId },
    data: { processingStatus: 'STALE' }
  });

  // Non-blocking re-processing queue
  setImmediate(() => {
    processLessonContent(courseId, lessonId).catch(err => {
      console.error(`[ContentProcessingPipeline] Background reprocessing failed for lesson "${lessonId}":`, err);
    });
  });

  return { success: true, message: 'Content marked STALE and queued for background re-processing.' };
}
