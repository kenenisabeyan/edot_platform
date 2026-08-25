/**
 * EDOT Intelligence Domain - Pilot Validation Report Generation Service
 * Generates structured pilot validation reports, strictly distinguishing between
 * OBSERVED_DATA, INFERENCES, and INSUFFICIENT_DATA.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import { getPilotInsights } from './pilotInsightService.js';

/**
 * Generates a formal Pilot Validation Report.
 */
export async function generatePilotValidationReport(pilotProgramId) {
  assertValidUUID(pilotProgramId, 'pilotProgramId');

  const insights = await getPilotInsights(pilotProgramId);
  const [program, issues, hypotheses, feedbacks] = await Promise.all([
    prisma.pilotProgram.findUnique({ where: { id: pilotProgramId } }),
    prisma.pilotIssue.findMany({ where: { pilotProgramId } }),
    prisma.pilotHypothesis.findMany({ where: { pilotProgramId } }),
    prisma.pilotFeedback.findMany({ where: { pilotProgramId } })
  ]);

  const observedData = {
    totalEnrolledParticipants: insights.totalParticipants,
    activeParticipants: insights.activeParticipants,
    withdrawnParticipants: insights.withdrawnParticipants,
    totalFeedbackSubmissions: feedbacks.length,
    totalLoggedIssues: issues.length,
    openIssues: issues.filter(i => i.status === 'OPEN').length
  };

  const inferences = [];
  if (observedData.activeParticipants > 0 && observedData.openIssues === 0) {
    inferences.push('Observed telemetry suggests low product friction for core learning journeys.');
  } else if (observedData.openIssues > 0) {
    inferences.push('Product friction signals indicate areas needing UI or workflow simplification before launch.');
  }

  const insufficientData = [];
  if (observedData.totalFeedbackSubmissions < 5) {
    insufficientData.push('Feedback sample size is insufficient to draw statistical conclusions on long-term retention.');
  }

  let launchReadiness = 'NOT_READY';
  if (observedData.activeParticipants > 0 && observedData.openIssues === 0) {
    launchReadiness = 'READY_FOR_NEXT_PHASE';
  } else if (observedData.openIssues > 0) {
    launchReadiness = 'REQUIRES_REMEDIATION';
  }

  return {
    reportTitle: `Pilot Validation Report: ${program.name}`,
    pilotProgramId,
    status: program.status,
    goals: program.goals || 'Validate real-world student usefulness, usability, and learning progress.',
    successCriteria: program.successCriteria || 'High journey completion rate, zero critical security/privacy issues, and positive learner usefulness feedback.',
    observedData,
    inferences,
    insufficientData,
    issuesSummary: {
      total: issues.length,
      open: issues.filter(i => i.status === 'OPEN').length,
      fixed: issues.filter(i => i.status === 'FIXED' || i.status === 'VERIFIED').length
    },
    hypothesesSummary: hypotheses.map(h => ({ statement: h.statement, status: h.status, evidence: h.evidenceSummary })),
    launchReadiness,
    generatedAt: new Date().toISOString()
  };
}
