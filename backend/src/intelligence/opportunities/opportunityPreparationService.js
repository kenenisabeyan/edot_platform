/**
 * EDOT Intelligence Domain - Requirement Gap Analysis & Preparation Engine
 * Compares opportunity requirements against student evidence, computes preparation gap status
 * (READY_TO_EXPLORE, DEVELOPING, EARLY_STAGE, INSUFFICIENT_EVIDENCE), and builds actionable preparation plans.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './opportunityAuthorizationService.js';

/**
 * Analyzes skill and evidence requirement gaps for a specific opportunity.
 */
export async function analyzeRequirementGaps(studentId, opportunityId) {
  assertValidUUID(studentId, 'studentId');
  assertValidUUID(opportunityId, 'opportunityId');

  const [opportunity, projectEvidences, portfolioItems] = await Promise.all([
    prisma.opportunity.findUnique({ where: { id: opportunityId } }),
    prisma.projectEvidence.findMany({ where: { studentId } }),
    prisma.portfolioItem.findMany({ where: { userId: studentId } })
  ]);

  if (!opportunity) {
    throw new Error('Opportunity not found');
  }

  const reqList = Array.isArray(opportunity.skillRequirements)
    ? opportunity.skillRequirements
    : Array.isArray(opportunity.requirements)
    ? opportunity.requirements.map(r => ({ skillName: String(r) }))
    : [];

  const verifiedSkills = new Set(projectEvidences.map(e => e.skillId).filter(Boolean));

  const missingSkills = reqList.filter(req => !verifiedSkills.has(req.skillName || req));

  let gapStatus = 'EARLY_STAGE';
  if (missingSkills.length === 0 && projectEvidences.length > 0) {
    gapStatus = 'READY_TO_EXPLORE';
  } else if (missingSkills.length < reqList.length) {
    gapStatus = 'DEVELOPING';
  } else if (projectEvidences.length === 0 && portfolioItems.length === 0) {
    gapStatus = 'INSUFFICIENT_EVIDENCE';
  }

  return {
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    organization: opportunity.organization,
    gapStatus,
    totalRequirements: reqList.length,
    missingRequirementsCount: missingSkills.length,
    missingSkills: missingSkills.map(s => s.skillName || s),
    disclaimer: 'Requirement gap analysis evaluates internal evidence sufficiency. It does not issue absolute qualification guarantees.'
  };
}

/**
 * Generates an actionable Opportunity Preparation Plan for a student.
 */
export async function getOpportunityPreparationPlan(studentId, opportunityId) {
  const gapAnalysis = await analyzeRequirementGaps(studentId, opportunityId);

  const preparationSteps = [];
  let nextBestAction = 'EXPLORE';

  if (gapAnalysis.gapStatus === 'READY_TO_EXPLORE') {
    nextBestAction = 'APPLY';
    preparationSteps.push({
      actionType: 'APPLY',
      title: 'Submit Application',
      description: 'Your capability evidence strongly aligns. Review application requirements and submit via official channel.'
    });
  } else if (gapAnalysis.gapStatus === 'DEVELOPING') {
    nextBestAction = 'BUILD_EVIDENCE';
    preparationSteps.push({
      actionType: 'BUILD_EVIDENCE',
      title: 'Complete Practical Project Challenge',
      description: `Demonstrate capability in missing skill areas: ${gapAnalysis.missingSkills.slice(0, 3).join(', ')}.`
    });
    preparationSteps.push({
      actionType: 'REQUEST_MENTOR_FEEDBACK',
      title: 'Seek Mentor Feedback',
      description: 'Connect with a verified EDOT mentor to review your project artifacts before applying.'
    });
  } else {
    nextBestAction = 'PREPARE';
    preparationSteps.push({
      actionType: 'PREPARE',
      title: 'Complete Prerequisites in Personal Learning Plan',
      description: 'Engage with core lessons and quizzes to build foundational knowledge.'
    });
    preparationSteps.push({
      actionType: 'IMPROVE_PORTFOLIO',
      title: 'Build Portfolio Evidence',
      description: 'Create and publish work samples in your student-controlled portfolio.'
    });
  }

  return {
    studentId,
    opportunityId,
    gapStatus: gapAnalysis.gapStatus,
    nextBestAction,
    preparationSteps
  };
}
