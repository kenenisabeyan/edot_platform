/**
 * EDOT Intelligence Domain - Unified Learning Event Publisher & Store Service
 * Ingests, deduplicates, persists, and asynchronously dispatches learning events.
 * 
 * Reusable event publishing helpers allow all present and future EDOT modules
 * to publish learning events using the same clean interface without manual DB manipulation.
 */

import { prisma } from '../../../lib/prisma.js';
import { eventBus } from '../shared/eventBus.js';
import { validateAndNormalizeLearningEvent } from './eventValidator.js';
import { ValidationError } from '../shared/errors.js';
import { onLearningActivityOccurred, onStudentCreated, onEnrollmentCreated } from '../profile/dynamicLearnerIntelligenceEngine.js';

/**
 * Ingests and stores a single learning event with idempotency guarantees.
 * 
 * @param {object} rawPayload 
 * @param {object} [authUser] 
 * @returns {Promise<{ isDuplicate: boolean, event: object }>}
 */
export async function publishLearningEvent(rawPayload, authUser = null) {
  const normalized = validateAndNormalizeLearningEvent(rawPayload, authUser);

  // 1. Idempotency verification
  if (normalized.idempotencyKey) {
    const existing = await prisma.learningEvent.findUnique({
      where: { idempotencyKey: normalized.idempotencyKey }
    });

    if (existing) {
      return {
        isDuplicate: true,
        event: existing
      };
    }
  }

  // 2. Persist to PostgreSQL Event Store
  let eventRecord;
  try {
    eventRecord = await prisma.learningEvent.create({
      data: normalized
    });
  } catch (error) {
    // Gracefully catch unique constraint race conditions on idempotencyKey
    if (error.code === 'P2002' && normalized.idempotencyKey) {
      const existing = await prisma.learningEvent.findUnique({
        where: { idempotencyKey: normalized.idempotencyKey }
      });
      if (existing) {
        return { isDuplicate: true, event: existing };
      }
    }
    throw error;
  }

  // 3. Asynchronously broadcast to downstream consumers & targeted learner intelligence
  eventBus.publish(normalized.eventType, {
    ...eventRecord,
    eventId: eventRecord.id
  });

  // Non-blocking targeted incremental Learner Intelligence Update
  onLearningActivityOccurred(eventRecord).catch(err => console.error('[LearnerIntelligence] Non-blocking event update failed:', err.message));

  return {
    isDuplicate: false,
    event: eventRecord
  };
}

/**
 * Ingests a batch of learning events atomically.
 * 
 * @param {Array<object>} eventsArray 
 * @param {object} [authUser] 
 * @returns {Promise<{ processedCount: number, duplicatesCount: number, events: Array<object> }>}
 */
export async function publishLearningEventsBatch(eventsArray, authUser = null) {
  if (!Array.isArray(eventsArray) || eventsArray.length === 0) {
    throw new ValidationError('events array must be a non-empty array of event objects');
  }

  if (eventsArray.length > 100) {
    throw new ValidationError('Batch ingestion size cannot exceed 100 events per request');
  }

  const normalizedList = eventsArray.map(item => validateAndNormalizeLearningEvent(item, authUser));

  const results = [];
  let processedCount = 0;
  let duplicatesCount = 0;

  // Process sequentially or via transactional loop to uphold idempotency
  for (const eventData of normalizedList) {
    if (eventData.idempotencyKey) {
      const existing = await prisma.learningEvent.findUnique({
        where: { idempotencyKey: eventData.idempotencyKey }
      });
      if (existing) {
        duplicatesCount++;
        results.push({ isDuplicate: true, event: existing });
        continue;
      }
    }

    const created = await prisma.learningEvent.create({ data: eventData });
    processedCount++;
    results.push({ isDuplicate: false, event: created });

    // Asynchronously publish
    eventBus.publish(created.eventType, {
      ...created,
      eventId: created.id
    });

    onLearningActivityOccurred(created).catch(err => console.error('[LearnerIntelligence] Batch incremental update error:', err.message));
  }

  return {
    processedCount,
    duplicatesCount,
    events: results
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Helper Publishers for All EDOT Modules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: Publish STUDENT_CREATED event and initialize baseline intelligence
 */
export async function publishStudentCreatedEvent(userId, data = {}, authUser = null) {
  onStudentCreated(userId, data).catch(err => console.error('[LearnerIntelligence] onStudentCreated failed:', err.message));
  return publishLearningEvent({
    userId,
    eventType: 'STUDENT_CREATED',
    metadata: data
  }, authUser);
}

/**
 * Helper: Publish ENROLLMENT_CREATED / COURSE_ENROLLED event and connect course intelligence
 */
export async function publishEnrollmentCreatedEvent(userId, courseId, data = {}, authUser = null) {
  onEnrollmentCreated(userId, courseId).catch(err => console.error('[LearnerIntelligence] onEnrollmentCreated failed:', err.message));
  return publishLearningEvent({
    userId,
    courseId,
    eventType: 'COURSE_ENROLLED',
    metadata: data
  }, authUser);
}

/**
 * Helper: Publish LESSON_STARTED event
 */
export async function publishLessonStartedEvent(userId, courseId, lessonId, data = {}, authUser = null) {
  return publishLearningEvent({
    userId,
    courseId,
    lessonId,
    eventType: 'LESSON_STARTED',
    metadata: data
  }, authUser);
}

/**
 * Helper: Publish LESSON_COMPLETED event
 */
export async function publishLessonCompletedEvent(userId, courseId, lessonId, data = {}, authUser = null) {
  return publishLearningEvent({
    userId,
    courseId,
    lessonId,
    eventType: 'LESSON_COMPLETED',
    metadata: data
  }, authUser);
}

/**
 * Helper: Publish VIDEO_PROGRESS event
 */
export async function publishVideoProgressEvent(userId, courseId, lessonId, duration, progress, data = {}, authUser = null) {
  return publishLearningEvent({
    userId,
    courseId,
    lessonId,
    eventType: 'VIDEO_PROGRESS',
    duration,
    progress,
    metadata: data
  }, authUser);
}

/**
 * Helper: Publish QUIZ_COMPLETED / QUIZ_PASSED / QUIZ_FAILED event
 */
export async function publishQuizCompletedEvent(userId, courseId, quizId, score, isPassed, data = {}, authUser = null) {
  const eventType = isPassed ? 'QUIZ_PASSED' : (score < 70 ? 'QUIZ_FAILED' : 'QUIZ_COMPLETED');
  return publishLearningEvent({
    userId,
    courseId,
    quizId,
    eventType,
    score,
    metadata: {
      isCorrect: isPassed,
      ...data
    }
  }, authUser);
}

/**
 * Helper: Publish ASSIGNMENT_SUBMITTED event
 */
export async function publishAssignmentSubmittedEvent(userId, courseId, assignmentId, data = {}, authUser = null) {
  return publishLearningEvent({
    userId,
    courseId,
    assignmentId,
    eventType: 'ASSIGNMENT_SUBMITTED',
    metadata: data
  }, authUser);
}

/**
 * Helper: Publish ASSESSMENT_COMPLETED event
 */
export async function publishAssessmentCompletedEvent(userId, courseId, assessmentId, score, data = {}, authUser = null) {
  return publishLearningEvent({
    userId,
    courseId,
    eventType: 'ASSESSMENT_COMPLETED',
    score,
    metadata: {
      assessmentId,
      ...data
    }
  }, authUser);
}

/**
 * Helper: Publish PROJECT_SUBMITTED event
 */
export async function publishProjectSubmittedEvent(userId, courseId, projectId, data = {}, authUser = null) {
  return publishLearningEvent({
    userId,
    courseId,
    eventType: 'PROJECT_SUBMITTED',
    metadata: {
      projectId,
      ...data
    }
  }, authUser);
}

/**
 * Queries the learning event store with high-performance indexed filtering.
 */
export async function queryLearningEvents(filters = {}) {
  const {
    userId,
    eventType,
    courseId,
    lessonId,
    quizId,
    assignmentId,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  } = filters;

  const where = {};

  if (userId) where.userId = String(userId);
  if (eventType) where.eventType = String(eventType).toUpperCase();
  if (courseId) where.courseId = String(courseId);
  if (lessonId) where.lessonId = String(lessonId);
  if (quizId) where.quizId = String(quizId);
  if (assignmentId) where.assignmentId = String(assignmentId);

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const [totalCount, events] = await Promise.all([
    prisma.learningEvent.count({ where }),
    prisma.learningEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
      skip: Number(offset) || 0
    })
  ]);

  return {
    totalCount,
    limit: Number(limit) || 50,
    offset: Number(offset) || 0,
    events
  };
}
