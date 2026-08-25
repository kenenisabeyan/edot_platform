/**
 * EDOT Intelligence Domain - Global Opportunity & Ecosystem Intelligence Master Orchestrator
 * Coordinates source ingestion, explainable matching, requirement gap analysis, preparation plans,
 * application tracking, partner authorization, student consent, and role-based insights (instructor, admin, guardian).
 */

import { prisma } from '../../../lib/prisma.js';
import {
  assertValidUUID,
  assertStudentApplicationOwner,
  assertStudentConsent,
  sanitizeGuardianOpportunityView
} from './opportunityAuthorizationService.js';
import { ingestOpportunityFromSource, normalizeOpportunityData } from './opportunitySourceService.js';
import { getRecommendedOpportunities } from './opportunityMatchingEngine.js';
import { analyzeRequirementGaps, getOpportunityPreparationPlan } from './opportunityPreparationService.js';
import { saveOpportunity, updateApplicationStatus, getStudentApplications } from './applicationTrackingService.js';
import { createPartnerOrganization, updatePartnerStatus, updateStudentConsent, getStudentConsents } from './partnerEcosystemService.js';

export {
  assertValidUUID,
  assertStudentApplicationOwner,
  assertStudentConsent,
  sanitizeGuardianOpportunityView,
  ingestOpportunityFromSource,
  normalizeOpportunityData,
  getRecommendedOpportunities,
  analyzeRequirementGaps,
  getOpportunityPreparationPlan,
  saveOpportunity,
  updateApplicationStatus,
  getStudentApplications,
  createPartnerOrganization,
  updatePartnerStatus,
  updateStudentConsent,
  getStudentConsents
};

/**
 * Records recommendation feedback loop interactions (INTERESTED, NOT_INTERESTED, SAVED, PREPARING, APPLIED, DISMISSED).
 */
export async function recordOpportunityInteraction(userId, opportunityId, interactionType) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(opportunityId, 'opportunityId');

  return prisma.opportunityInteraction.create({
    data: {
      userId,
      opportunityId,
      interactionType
    }
  });
}

/**
 * Instructor aggregate opportunity insights (Phase 4 extension).
 */
export async function getInstructorOpportunityInsights(instructorId) {
  assertValidUUID(instructorId, 'instructorId');

  const applications = await prisma.opportunityApplication.findMany({
    take: 50,
    orderBy: { updatedAt: 'desc' },
    include: { opportunity: { select: { title: true, organization: true, opportunityType: true } } }
  });

  return {
    instructorId,
    totalTrackedApplications: applications.length,
    activePreparationCount: applications.filter(a => ['PREPARING', 'READY'].includes(a.status)).length,
    recentApplications: applications.slice(0, 10).map(a => ({
      opportunityTitle: a.opportunity.title,
      organization: a.opportunity.organization,
      status: a.status,
      updatedAt: a.updatedAt
    }))
  };
}

/**
 * Admin institutional opportunity intelligence (Phase 5 extension).
 */
export async function getAdminOpportunityIntelligence() {
  const totalOpportunities = await prisma.opportunity.count();
  const activeOpportunities = await prisma.opportunity.count({ where: { status: 'ACTIVE' } });
  const totalPartners = await prisma.partnerOrganization.count();
  const activePartners = await prisma.partnerOrganization.count({ where: { status: 'ACTIVE' } });
  const totalApplications = await prisma.opportunityApplication.count();

  return {
    totalOpportunities,
    activeOpportunities,
    totalPartners,
    activePartners,
    totalApplications,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Privacy-safe opportunity overview for guardians (Phase 6 extension).
 */
export async function getGuardianOpportunitySummary(guardianId, studentId) {
  assertValidUUID(guardianId, 'guardianId');
  assertValidUUID(studentId, 'studentId');

  const applications = await prisma.opportunityApplication.findMany({
    where: { userId: studentId },
    include: { opportunity: true },
    orderBy: { updatedAt: 'desc' }
  });

  return {
    studentId,
    totalApplications: applications.length,
    activeApplications: applications.filter(a => ['PREPARING', 'READY', 'APPLIED', 'INTERVIEW'].includes(a.status)).length,
    applications: sanitizeGuardianOpportunityView(applications)
  };
}
