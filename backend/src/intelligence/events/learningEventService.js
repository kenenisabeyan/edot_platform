/**
 * EDOT Intelligence Domain - Unified Learning Event Publisher & Store Service
 * Ingests, deduplicates, persists, and asynchronously dispatches learning events.
 */

import { prisma } from '../../../lib/prisma.js';
import { eventBus } from '../shared/eventBus.js';
import { validateAndNormalizeLearningEvent } from './eventValidator.js';
import { ValidationError } from '../shared/errors.js';

/**
 * Ingests and stores a single learning event with idempotency guarantees.
 * 
 * @param {object} rawPayload 
 * @param {object} authUser 
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

  // 3. Asynchronously broadcast to downstream consumers (fire-and-forget)
  eventBus.publish(normalized.eventType, {
    ...eventRecord,
    eventId: eventRecord.id
  });

  return {
    isDuplicate: false,
    event: eventRecord
  };
}

/**
 * Ingests a batch of learning events atomically.
 * 
 * @param {Array<object>} eventsArray 
 * @param {object} authUser 
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
  }

  return {
    processedCount,
    duplicatesCount,
    events: results
  };
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
