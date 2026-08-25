/**
 * EDOT Intelligence Domain - Opportunity Source Abstraction & Normalization Service
 * Provider-agnostic opportunity ingestion, schema normalization, non-destructive duplicate detection,
 * and source confidence tracking (VERIFIED, PARTNER, UNVERIFIED).
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Normalizes raw opportunity data into EDOT standardized schema.
 */
export function normalizeOpportunityData(rawData) {
  return {
    title: String(rawData.title || 'Untitled Opportunity').trim(),
    organization: String(rawData.organization || 'Independent Organization').trim(),
    opportunityType: String(rawData.opportunityType || rawData.type || 'OTHER').toUpperCase(),
    locationType: String(rawData.locationType || 'REMOTE').toUpperCase(),
    location: rawData.location ? String(rawData.location).trim() : null,
    description: String(rawData.description || 'No detailed description provided.').trim(),
    applicationUrl: rawData.applicationUrl || rawData.applyUrl || null,
    deadline: rawData.deadline ? new Date(rawData.deadline) : null,
    skillRequirements: Array.isArray(rawData.skillRequirements) ? rawData.skillRequirements : [],
    requirements: Array.isArray(rawData.requirements) ? rawData.requirements : []
  };
}

/**
 * Detects potential duplicate opportunity records by title & organization.
 */
export async function detectDuplicateOpportunity(title, organization) {
  const existing = await prisma.opportunity.findFirst({
    where: {
      title: { equals: title, mode: 'insensitive' },
      organization: { equals: organization, mode: 'insensitive' },
      status: { not: 'REMOVED' }
    }
  });

  return existing;
}

/**
 * Ingests an opportunity from any source provider (EDOT_CREATED, PARTNER_PROVIDED, EXTERNAL_PROVIDER, MANUAL_IMPORT, USER_SUBMITTED).
 */
export async function ingestOpportunityFromSource(sourceType, rawData, { partnerId = null, confidenceStatus = 'UNVERIFIED' } = {}) {
  const normalized = normalizeOpportunityData(rawData);

  // Check duplicate
  const duplicate = await detectDuplicateOpportunity(normalized.title, normalized.organization);
  if (duplicate) {
    return {
      isDuplicate: true,
      existingOpportunityId: duplicate.id,
      opportunity: duplicate
    };
  }

  // Create Source record
  const sourceRecord = await prisma.opportunitySource.create({
    data: {
      name: `${sourceType} Ingestion - ${normalized.organization}`,
      sourceType,
      partnerId,
      confidenceStatus,
      metadata: { rawDataKeys: Object.keys(rawData) }
    }
  });

  // Create Opportunity record
  const opportunity = await prisma.opportunity.create({
    data: {
      title: normalized.title,
      organization: normalized.organization,
      opportunityType: normalized.opportunityType,
      type: normalized.opportunityType,
      locationType: normalized.locationType,
      location: normalized.location,
      description: normalized.description,
      applicationUrl: normalized.applicationUrl,
      applyUrl: normalized.applicationUrl,
      deadline: normalized.deadline,
      sourceId: sourceRecord.id,
      partnerId,
      skillRequirements: normalized.skillRequirements,
      requirements: Array.isArray(normalized.requirements) && normalized.requirements.length > 0
        ? { create: normalized.requirements.map(r => ({ name: String(r), requirementType: 'SKILL' })) }
        : undefined,
      status: 'ACTIVE',
      isVerified: confidenceStatus === 'VERIFIED' || confidenceStatus === 'PARTNER'
    }
  });

  return {
    isDuplicate: false,
    opportunity
  };
}
