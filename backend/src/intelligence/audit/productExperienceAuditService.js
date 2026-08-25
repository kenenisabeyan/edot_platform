/**
 * EDOT Intelligence Domain - Product Experience Audit Service
 * Privacy-conscious product telemetry event logging and feature adoption measurement.
 *
 * ABSOLUTE PRIVACY CONTRACT:
 * NEVER store passwords, tokens, full private AI chat content, or internal reasoning traces.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

/**
 * Logs a privacy-conscious product experience telemetry event.
 */
export async function logExperienceEvent(userId, { eventType, featureKey, journeyKey = null, metadata = null }) {
  assertValidUUID(userId, 'userId');

  const validEventTypes = [
    'DISCOVERED', 'USED', 'ACTIONED', 'COMPLETED',
    'RETURNED_TO', 'DISMISSED', 'ABANDONED', 'FRICTION_SIGNAL'
  ];

  if (!validEventTypes.includes(eventType)) {
    throw new Error(`Invalid eventType: ${eventType}`);
  }

  // Filter out any sensitive keys from metadata
  const sanitizedMetadata = metadata ? { ...metadata } : {};
  delete sanitizedMetadata.password;
  delete sanitizedMetadata.token;
  delete sanitizedMetadata.prompt;
  delete sanitizedMetadata.chainOfThought;

  return prisma.productExperienceEvent.create({
    data: {
      userId,
      eventType,
      featureKey: String(featureKey || 'GENERAL').toUpperCase(),
      journeyKey: journeyKey ? String(journeyKey).toUpperCase() : null,
      metadata: sanitizedMetadata
    }
  });
}

/**
 * Computes feature adoption metrics across the platform (Admin aggregated view).
 */
export async function getFeatureAdoptionMetrics() {
  const events = await prisma.productExperienceEvent.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' }
  });

  const featureCounts = {};

  for (const ev of events) {
    if (!featureCounts[ev.featureKey]) {
      featureCounts[ev.featureKey] = { DISCOVERED: 0, USED: 0, ACTIONED: 0, COMPLETED: 0, DISMISSED: 0, ABANDONED: 0 };
    }
    if (featureCounts[ev.featureKey][ev.eventType] !== undefined) {
      featureCounts[ev.featureKey][ev.eventType]++;
    }
  }

  return {
    totalEventsLogged: events.length,
    featureAdoption: featureCounts,
    calculatedAt: new Date().toISOString()
  };
}
