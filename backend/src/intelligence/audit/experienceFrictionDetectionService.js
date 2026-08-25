/**
 * EDOT Intelligence Domain - Experience Friction Signal Detection Service
 * Identifies product friction patterns (POSSIBLE_FRICTION, POSSIBLE_CONFUSION, REPEATED_ABANDONMENT)
 * without student surveillance, negative labeling, or psychological diagnosis.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

/**
 * Evaluates friction signals for a student session.
 */
export async function detectFrictionSignals(userId) {
  assertValidUUID(userId, 'userId');

  const recentEvents = await prisma.productExperienceEvent.findMany({
    where: { userId },
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  const dismissals = recentEvents.filter(e => e.eventType === 'DISMISSED');
  const abandonments = recentEvents.filter(e => e.eventType === 'ABANDONED');

  const frictionSignals = [];

  if (dismissals.length >= 3) {
    frictionSignals.push({
      signalType: 'POSSIBLE_CONFUSION',
      message: 'Student has dismissed multiple suggestions in a single session.',
      suggestedProductAction: 'Review suggestion clarity and relevance.'
    });
  }

  if (abandonments.length >= 2) {
    frictionSignals.push({
      signalType: 'REPEATED_ABANDONMENT',
      message: 'Student has exited early from multiple multi-step flows.',
      suggestedProductAction: 'Simplify step count or improve progressive disclosure.'
    });
  }

  return frictionSignals;
}
