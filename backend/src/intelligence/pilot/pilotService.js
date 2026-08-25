/**
 * EDOT Intelligence Domain - Real-World Pilot Master Orchestrator
 * Coordinates pilot programs, dynamic cohorts, voluntary participant consent/withdrawal,
 * journey validation, contextual feedback, issue tracking, hypothesis testing, and Pilot Command Center analytics.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import {
  createPilotProgram,
  updatePilotStatus,
  createPilotCohort,
  joinPilotProgram,
  withdrawFromPilot,
  isUserActivePilotParticipant
} from './pilotProgramService.js';
import {
  trackPilotJourneyStart,
  trackPilotJourneyCompletion,
  trackPilotJourneyAbandonment
} from './pilotJourneyValidationService.js';
import {
  createPilotIssue,
  updateIssueStatus,
  createPilotHypothesis,
  evaluatePilotHypothesis,
  getPilotInsights
} from './pilotInsightService.js';
import { generatePilotValidationReport } from './pilotReportService.js';

export {
  createPilotProgram,
  updatePilotStatus,
  createPilotCohort,
  joinPilotProgram,
  withdrawFromPilot,
  isUserActivePilotParticipant,
  trackPilotJourneyStart,
  trackPilotJourneyCompletion,
  trackPilotJourneyAbandonment,
  createPilotIssue,
  updateIssueStatus,
  createPilotHypothesis,
  evaluatePilotHypothesis,
  getPilotInsights,
  generatePilotValidationReport
};

/**
 * Records contextual student feedback with daily frequency limit enforcement.
 */
export async function recordPilotFeedback(userId, pilotProgramId, { feedbackType, rating = 'HELPFUL', comment = null }) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const isActive = await isUserActivePilotParticipant(userId, pilotProgramId);
  if (!isActive) {
    throw new Error('User is not an active participant of this pilot program');
  }

  // Daily feedback frequency limit check (Max 3 submissions per student per day)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaysCount = await prisma.pilotFeedback.count({
    where: {
      userId,
      createdAt: { gte: startOfDay }
    }
  });

  if (todaysCount >= 3) {
    return {
      submitted: false,
      reason: 'Daily feedback limit reached. Thank you for your active participation!'
    };
  }

  const feedback = await prisma.pilotFeedback.create({
    data: {
      pilotProgramId,
      userId,
      feedbackType: String(feedbackType || 'GENERAL').toUpperCase(),
      rating: rating ? String(rating).toUpperCase() : 'HELPFUL',
      comment
    }
  });

  return {
    submitted: true,
    feedback
  };
}

/**
 * Pilot Command Center overview analytics (ADMIN view).
 */
export async function getPilotCommandCenterOverview() {
  const [totalPrograms, activePrograms, totalParticipants, totalIssues, totalHypotheses] = await Promise.all([
    prisma.pilotProgram.count(),
    prisma.pilotProgram.count({ where: { status: 'ACTIVE' } }),
    prisma.pilotParticipant.count({ where: { status: 'ACTIVE' } }),
    prisma.pilotIssue.count({ where: { status: 'OPEN' } }),
    prisma.pilotHypothesis.count()
  ]);

  return {
    totalPrograms,
    activePrograms,
    totalActiveParticipants: totalParticipants,
    openIssuesCount: totalIssues,
    hypothesesCount: totalHypotheses,
    generatedAt: new Date().toISOString()
  };
}
