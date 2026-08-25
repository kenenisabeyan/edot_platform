/**
 * EDOT Intelligence Domain - Pilot Insight, Issue & Hypothesis Service
 * Generates aggregated pilot insights, tracks usability/accessibility issue lifecycles (PilotIssue),
 * and evaluates product hypotheses (PilotHypothesis) with evidence-backed status.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

/**
 * Creates a PilotIssue logged by administrators or pilot participants.
 */
export async function createPilotIssue({ pilotProgramId, category, severity = 'MEDIUM', summary, description = null, createdBy }) {
  assertValidUUID(pilotProgramId, 'pilotProgramId');
  assertValidUUID(createdBy, 'createdBy');

  const validCategories = [
    'USABILITY', 'CONFUSION', 'PERFORMANCE', 'MOBILE',
    'AI_QUALITY', 'RECOMMENDATION', 'CONTENT', 'ACCESSIBILITY',
    'PRIVACY', 'AUTHORIZATION', 'DATA'
  ];

  if (!validCategories.includes(category)) {
    throw new Error(`Invalid issue category: ${category}`);
  }

  return prisma.pilotIssue.create({
    data: {
      pilotProgramId,
      category,
      severity,
      summary,
      description,
      createdBy,
      status: 'OPEN'
    }
  });
}

/**
 * Updates a PilotIssue status.
 */
export async function updateIssueStatus(issueId, status) {
  assertValidUUID(issueId, 'issueId');

  const validStatuses = ['OPEN', 'INVESTIGATING', 'PLANNED', 'FIXED', 'VERIFIED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid issue status: ${status}`);
  }

  return prisma.pilotIssue.update({
    where: { id: issueId },
    data: { status }
  });
}

/**
 * Creates a product hypothesis for pilot testing.
 */
export async function createPilotHypothesis(pilotProgramId, statement) {
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  return prisma.pilotHypothesis.create({
    data: {
      pilotProgramId,
      statement,
      status: 'INCONCLUSIVE'
    }
  });
}

/**
 * Evaluates a product hypothesis based on accumulated evidence.
 */
export async function evaluatePilotHypothesis(hypothesisId, status, evidenceSummary) {
  assertValidUUID(hypothesisId, 'hypothesisId');

  const validStatuses = ['SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid hypothesis status: ${status}`);
  }

  return prisma.pilotHypothesis.update({
    where: { id: hypothesisId },
    data: {
      status,
      evidenceSummary
    }
  });
}

/**
 * Generates aggregated insights for a pilot program.
 */
export async function getPilotInsights(pilotProgramId) {
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const [program, participants, issues, hypotheses, feedbacks] = await Promise.all([
    prisma.pilotProgram.findUnique({ where: { id: pilotProgramId } }),
    prisma.pilotParticipant.findMany({ where: { pilotProgramId } }),
    prisma.pilotIssue.findMany({ where: { pilotProgramId } }),
    prisma.pilotHypothesis.findMany({ where: { pilotProgramId } }),
    prisma.pilotFeedback.findMany({ where: { pilotProgramId } })
  ]);

  if (!program) {
    throw new Error('Pilot program not found');
  }

  const activeParticipantsCount = participants.filter(p => p.status === 'ACTIVE').length;
  const withdrawnParticipantsCount = participants.filter(p => p.status === 'WITHDRAWN').length;
  const openIssuesCount = issues.filter(i => i.status === 'OPEN' || i.status === 'INVESTIGATING').length;

  const insights = [];
  if (activeParticipantsCount > 0) {
    insights.push(`Active participant engagement is steady with ${activeParticipantsCount} participant(s).`);
  }
  if (withdrawnParticipantsCount > 0) {
    insights.push(`Voluntary withdrawal rate is ${Math.round((withdrawnParticipantsCount / participants.length) * 100)}%.`);
  }
  if (openIssuesCount > 0) {
    insights.push(`There are ${openIssuesCount} open issue(s) requiring technical/product review.`);
  }

  return {
    pilotProgramId,
    programName: program.name,
    status: program.status,
    totalParticipants: participants.length,
    activeParticipants: activeParticipantsCount,
    withdrawnParticipants: withdrawnParticipantsCount,
    totalFeedbacks: feedbacks.length,
    openIssuesCount,
    hypothesesCount: hypotheses.length,
    insights,
    generatedAt: new Date().toISOString()
  };
}
