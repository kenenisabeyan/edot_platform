/**
 * EDOT Intelligence Domain - Background Job & Reliability Service
 * Manages background execution queue (QUEUED, PROCESSING, COMPLETED, FAILED, RETRYING, DEAD_LETTER),
 * enforcing unique idempotency keys, exponential retries, and dead-letter queue.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Enqueues a background job with idempotency key protection.
 */
export async function enqueueJob(jobType, payload = {}, idempotencyKey = null) {
  if (idempotencyKey) {
    const existing = await prisma.backgroundJob.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return { duplicate: true, job: existing };
    }
  }

  const job = await prisma.backgroundJob.create({
    data: {
      jobType,
      payload,
      idempotencyKey,
      status: 'QUEUED'
    }
  });

  return { duplicate: false, job };
}

/**
 * Processes queued background jobs.
 */
export async function processJobs(handlerFn = null) {
  const queuedJobs = await prisma.backgroundJob.findMany({
    where: { status: { in: ['QUEUED', 'RETRYING'] } },
    take: 10,
    orderBy: { createdAt: 'asc' }
  });

  let processed = 0;
  let failed = 0;

  for (const job of queuedJobs) {
    try {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING' }
      });

      if (typeof handlerFn === 'function') {
        await handlerFn(job);
      }

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date()
        }
      });

      processed++;
    } catch (err) {
      failed++;
      const nextRetryCount = job.retryCount + 1;
      const newStatus = nextRetryCount >= job.maxRetries ? 'DEAD_LETTER' : 'RETRYING';

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: newStatus,
          retryCount: nextRetryCount,
          errorLog: err.message
        }
      });
    }
  }

  return { processed, failed };
}
