/**
 * EDOT Intelligence Domain - Pilot Program & Participant Management Service
 * Manages pilot programs (DRAFT, READY, ACTIVE, PAUSED, COMPLETED, ARCHIVED), dynamic cohorts,
 * voluntary student opt-in with explicit consent, and voluntary withdrawal.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

/**
 * Creates a new PilotProgram (ADMIN controlled).
 */
export async function createPilotProgram({ name, description, targetAudience = null, goals = null, successCriteria = null, createdBy }) {
  assertValidUUID(createdBy, 'createdBy');

  return prisma.pilotProgram.create({
    data: {
      name,
      description,
      targetAudience,
      goals,
      successCriteria,
      createdBy,
      status: 'DRAFT'
    }
  });
}

/**
 * Updates pilot program status (DRAFT, READY, ACTIVE, PAUSED, COMPLETED, ARCHIVED).
 */
export async function updatePilotStatus(pilotId, status) {
  assertValidUUID(pilotId, 'pilotId');

  const validStatuses = ['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid pilot status: ${status}`);
  }

  return prisma.pilotProgram.update({
    where: { id: pilotId },
    data: { status }
  });
}

/**
 * Creates a dynamic cohort within a pilot program.
 */
export async function createPilotCohort(pilotProgramId, { name, description = null }) {
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  return prisma.pilotCohort.create({
    data: {
      pilotProgramId,
      name,
      description
    }
  });
}

/**
 * Allows a student to voluntarily join a pilot program with explicit consent.
 */
export async function joinPilotProgram(userId, pilotProgramId, { cohortId = null, consentVersion = 'v1.0' } = {}) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const pilot = await prisma.pilotProgram.findUnique({ where: { id: pilotProgramId } });
  if (!pilot || pilot.status !== 'ACTIVE') {
    throw new Error('Pilot program is not active or does not exist');
  }

  return prisma.pilotParticipant.upsert({
    where: { pilotProgramId_userId: { pilotProgramId, userId } },
    update: {
      status: 'ACTIVE',
      consentVersion,
      acceptedAt: new Date(),
      withdrawnAt: null
    },
    create: {
      pilotProgramId,
      cohortId,
      userId,
      consentVersion,
      status: 'ACTIVE',
      acceptedAt: new Date()
    }
  });
}

/**
 * Allows a student to voluntarily withdraw from a pilot program.
 * Immediately halts pilot tracking without affecting core learning or course access.
 */
export async function withdrawFromPilot(userId, pilotProgramId) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const existing = await prisma.pilotParticipant.findUnique({
    where: { pilotProgramId_userId: { pilotProgramId, userId } }
  });

  if (!existing) {
    throw new Error('Participant registration not found');
  }

  return prisma.pilotParticipant.update({
    where: { id: existing.id },
    data: {
      status: 'WITHDRAWN',
      withdrawnAt: new Date()
    }
  });
}

/**
 * Verifies if a user is an active, consented participant of a pilot.
 */
export async function isUserActivePilotParticipant(userId, pilotProgramId) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const participant = await prisma.pilotParticipant.findUnique({
    where: { pilotProgramId_userId: { pilotProgramId, userId } }
  });

  return Boolean(participant && participant.status === 'ACTIVE');
}
