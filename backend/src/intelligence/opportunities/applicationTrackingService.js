/**
 * EDOT Intelligence Domain - Application Tracking & Evidence Service
 * Manages student opportunity application lifecycle (SAVED, PREPARING, READY, APPLIED, INTERVIEW, OFFER, ACCEPTED, CLOSED)
 * and records preparation history.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertStudentApplicationOwner } from './opportunityAuthorizationService.js';

/**
 * Saves or bookmarks an opportunity for a student.
 */
export async function saveOpportunity(userId, opportunityId) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(opportunityId, 'opportunityId');

  const application = await prisma.opportunityApplication.upsert({
    where: { userId_opportunityId: { userId, opportunityId } },
    update: { updatedAt: new Date() },
    create: {
      userId,
      opportunityId,
      status: 'SAVED',
      preparationNotes: { events: [{ type: 'SAVED', timestamp: new Date().toISOString() }] }
    },
    include: { opportunity: true }
  });

  // Log interaction for feedback loop
  await prisma.opportunityInteraction.create({
    data: {
      userId,
      opportunityId,
      interactionType: 'SAVED'
    }
  });

  return application;
}

/**
 * Updates application status and appends preparation notes.
 */
export async function updateApplicationStatus(applicationId, userId, { status, notes = null, requestingUserRole = 'student' }) {
  assertValidUUID(applicationId, 'applicationId');
  assertValidUUID(userId, 'userId');

  const validStatuses = [
    'SAVED', 'PREPARING', 'READY', 'APPLIED', 'INTERVIEW',
    'ASSESSMENT', 'OFFER', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CLOSED'
  ];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid application status: ${status}`);
  }

  const existing = await prisma.opportunityApplication.findUnique({ where: { id: applicationId } });
  if (!existing) {
    throw new Error('Application record not found');
  }

  assertStudentApplicationOwner(userId, existing.userId, requestingUserRole);

  const prevNotes = Array.isArray(existing.preparationNotes?.events) ? existing.preparationNotes.events : [];
  const updatedEvents = [
    ...prevNotes,
    { type: status, notes, timestamp: new Date().toISOString() }
  ];

  const updated = await prisma.opportunityApplication.update({
    where: { id: applicationId },
    data: {
      status,
      appliedAt: status === 'APPLIED' ? new Date() : existing.appliedAt,
      preparationNotes: { events: updatedEvents }
    },
    include: { opportunity: true }
  });

  return updated;
}

/**
 * Retrieves all saved and active applications for a student.
 */
export async function getStudentApplications(userId) {
  assertValidUUID(userId, 'userId');

  return prisma.opportunityApplication.findMany({
    where: { userId },
    include: { opportunity: { include: { source: true, partner: true } } },
    orderBy: { updatedAt: 'desc' }
  });
}
