/**
 * EDOT Intelligence Domain - Partner Ecosystem & Consent Management Service
 * Manages partner organization authorization (PENDING, ACTIVE, PAUSED, SUSPENDED)
 * and explicit, revocable student privacy consent controls.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './opportunityAuthorizationService.js';

/**
 * Creates a PartnerOrganization record.
 */
export async function createPartnerOrganization({ name, description = null, websiteUrl = null, contactEmail = null }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${Date.now()}`;

  return prisma.partnerOrganization.create({
    data: {
      name,
      slug,
      description,
      websiteUrl,
      contactEmail,
      status: 'PENDING'
    }
  });
}

/**
 * Updates partner organization authorization status (ADMIN controlled).
 */
export async function updatePartnerStatus(partnerId, status) {
  assertValidUUID(partnerId, 'partnerId');

  const validStatuses = ['PENDING', 'ACTIVE', 'PAUSED', 'SUSPENDED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid partner status: ${status}`);
  }

  return prisma.partnerOrganization.update({
    where: { id: partnerId },
    data: {
      status,
      verifiedAt: status === 'ACTIVE' ? new Date() : undefined
    }
  });
}

/**
 * Updates explicit student consent settings (PORTFOLIO_SHARING, PROJECT_SHARING, PROFILE_SHARING, APPLICATION_PREPARATION, PARTNER_DISCOVERY).
 */
export async function updateStudentConsent(userId, consentType, granted = true) {
  assertValidUUID(userId, 'userId');

  const validConsentTypes = [
    'PORTFOLIO_SHARING',
    'PROJECT_SHARING',
    'PROFILE_SHARING',
    'APPLICATION_PREPARATION',
    'PARTNER_DISCOVERY'
  ];

  if (!validConsentTypes.includes(consentType)) {
    throw new Error(`Invalid consentType: ${consentType}`);
  }

  return prisma.studentConsent.upsert({
    where: { userId_consentType: { userId, consentType } },
    update: {
      granted,
      grantedAt: granted ? new Date() : undefined,
      revokedAt: !granted ? new Date() : undefined
    },
    create: {
      userId,
      consentType,
      granted,
      grantedAt: granted ? new Date() : undefined,
      revokedAt: !granted ? new Date() : undefined
    }
  });
}

/**
 * Retrieves student consent status for all consent types.
 */
export async function getStudentConsents(userId) {
  assertValidUUID(userId, 'userId');

  const consents = await prisma.studentConsent.findMany({ where: { userId } });

  const consentMap = {};
  for (const c of consents) {
    consentMap[c.consentType] = c.granted;
  }

  return {
    userId,
    consents: consentMap
  };
}
