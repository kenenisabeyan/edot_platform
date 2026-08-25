/**
 * EDOT Intelligence Domain - Telemetry Event Batching Service
 * Asynchronous event batch queue for telemetry writes (ProductExperienceEvent, LearningEvent)
 * to eliminate database bottlenecks during peak student load.
 */

import { prisma } from '../../../lib/prisma.js';

const eventQueue = [];
const BATCH_SIZE = 50;

/**
 * Enqueues a telemetry event for asynchronous batch write.
 */
export function enqueueTelemetryEvent(eventData) {
  eventQueue.push({
    ...eventData,
    enqueuedAt: new Date()
  });

  if (eventQueue.length >= BATCH_SIZE) {
    flushEventQueue().catch(() => {});
  }
}

/**
 * Flushes all pending telemetry events in the queue to the database.
 */
export async function flushEventQueue() {
  if (eventQueue.length === 0) return { flushed: 0 };

  const eventsToFlush = eventQueue.splice(0, eventQueue.length);

  try {
    const formattedEvents = eventsToFlush.map(e => ({
      userId: e.userId,
      eventType: e.eventType || 'USED',
      featureKey: String(e.featureKey || 'GENERAL').toUpperCase(),
      journeyKey: e.journeyKey ? String(e.journeyKey).toUpperCase() : null,
      metadata: e.metadata || {}
    }));

    await prisma.productExperienceEvent.createMany({
      data: formattedEvents
    });

    return { flushed: formattedEvents.length };
  } catch (error) {
    // Failure isolation: return failed count without throwing
    return { flushed: 0, error: error.message };
  }
}

/**
 * Returns event queue metrics (current pending size, max batch size).
 */
export function getEventQueueMetrics() {
  return {
    pendingQueueSize: eventQueue.length,
    batchSizeThreshold: BATCH_SIZE,
    queueLagMs: eventQueue.length > 0 ? Date.now() - eventQueue[0].enqueuedAt.getTime() : 0
  };
}
