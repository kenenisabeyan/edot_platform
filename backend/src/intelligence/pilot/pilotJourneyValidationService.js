/**
 * EDOT Intelligence Domain - Pilot Journey Validation Service
 * Tracks high-level student journey completion (Journeys A through E) for active pilot participants
 * without capturing private AI chat content, passwords, or hidden reasoning traces.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import { isUserActivePilotParticipant } from './pilotProgramService.js';

export const PILOT_JOURNEYS = {
  JOURNEY_A: 'New Student Onboarding & First Guidance',
  JOURNEY_B: 'Returning Student Next Best Action',
  JOURNEY_C: 'Student Struggle & Remediation',
  JOURNEY_D: 'Skill & Project Building',
  JOURNEY_E: 'Career Exploration & Opportunity Prep'
};

/**
 * Validates journey start for an active pilot participant.
 */
export async function trackPilotJourneyStart(userId, pilotProgramId, journeyKey) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const isActive = await isUserActivePilotParticipant(userId, pilotProgramId);
  if (!isActive) {
    return { tracked: false, reason: 'User is not an active pilot participant' };
  }

  const event = await prisma.productExperienceEvent.create({
    data: {
      userId,
      eventType: 'DISCOVERED',
      featureKey: 'PILOT_JOURNEY',
      journeyKey: String(journeyKey).toUpperCase(),
      metadata: { pilotProgramId, stage: 'STARTED' }
    }
  });

  return { tracked: true, eventId: event.id };
}

/**
 * Validates journey completion for an active pilot participant.
 */
export async function trackPilotJourneyCompletion(userId, pilotProgramId, journeyKey, metadata = {}) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const isActive = await isUserActivePilotParticipant(userId, pilotProgramId);
  if (!isActive) {
    return { tracked: false, reason: 'User is not an active pilot participant' };
  }

  // Filter privacy sensitive data
  const sanitized = { ...metadata };
  delete sanitized.password;
  delete sanitized.prompt;
  delete sanitized.chainOfThought;

  const event = await prisma.productExperienceEvent.create({
    data: {
      userId,
      eventType: 'COMPLETED',
      featureKey: 'PILOT_JOURNEY',
      journeyKey: String(journeyKey).toUpperCase(),
      metadata: { pilotProgramId, ...sanitized, stage: 'COMPLETED' }
    }
  });

  return { tracked: true, eventId: event.id };
}

/**
 * Validates journey abandonment for an active pilot participant.
 */
export async function trackPilotJourneyAbandonment(userId, pilotProgramId, journeyKey) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const isActive = await isUserActivePilotParticipant(userId, pilotProgramId);
  if (!isActive) {
    return { tracked: false, reason: 'User is not an active pilot participant' };
  }

  const event = await prisma.productExperienceEvent.create({
    data: {
      userId,
      eventType: 'ABANDONED',
      featureKey: 'PILOT_JOURNEY',
      journeyKey: String(journeyKey).toUpperCase(),
      metadata: { pilotProgramId, stage: 'ABANDONED' }
    }
  });

  return { tracked: true, eventId: event.id };
}
