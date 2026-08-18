/**
 * EDOT Intelligence Domain - Learning Events Service
 * Ingests, persists, and publishes normalized learning events.
 */

import { prisma } from '../../../lib/prisma.js';
import { eventBus } from '../shared/eventBus.js';
import { validateEventPayload } from '../shared/validation.js';

export async function recordLearningEvent(payload) {
  validateEventPayload(payload);

  const {
    userId,
    eventType,
    title,
    description,
    courseId,
    lessonId,
    score,
    durationMinutes = 0,
    metadata = {}
  } = payload;

  // Retrieve user's active profile if exists
  const profile = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: { id: true }
  });

  const eventRecord = await prisma.learningHistoryEvent.create({
    data: {
      userId,
      profileId: profile?.id || null,
      eventType,
      title: title || eventType,
      description: description || null,
      courseId: courseId || null,
      lessonId: lessonId || null,
      score: typeof score === 'number' ? score : null,
      durationMinutes: Math.round(durationMinutes),
      metadata: metadata || {}
    }
  });

  // Publish to asynchronous background intelligence pipeline
  eventBus.publish(eventType, {
    ...payload,
    eventId: eventRecord.id,
    profileId: profile?.id || null,
    occurredAt: eventRecord.occurredAt
  });

  return eventRecord;
}

export async function getLearningEvents(userId, limit = 50, eventType = null) {
  return prisma.learningHistoryEvent.findMany({
    where: {
      userId,
      ...(eventType ? { eventType } : {})
    },
    orderBy: { occurredAt: 'desc' },
    take: Math.min(Number(limit) || 50, 100)
  });
}
