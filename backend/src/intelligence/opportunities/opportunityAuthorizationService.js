/**
 * EDOT Intelligence Domain - Opportunity Authorization & Safety Service
 * Server-side authorization, UUID validation, student consent verification, and guardian privacy boundaries.
 */

import { prisma } from '../../../lib/prisma.js';
import { ForbiddenError, ValidationError, NotFoundError } from '../shared/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Asserts parameter is a valid UUID format. Rejects AI-hallucinated or malformed strings.
 */
export function assertValidUUID(id, paramName = 'ID') {
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id.trim())) {
    throw new ValidationError(`Invalid ${paramName} format: must be a valid UUID`);
  }
  return id.trim();
}

/**
 * Enforces student data isolation for application records.
 */
export function assertStudentApplicationOwner(requestingUserId, applicationUserId, requestingUserRole = 'student') {
  assertValidUUID(requestingUserId, 'requestingUserId');
  assertValidUUID(applicationUserId, 'applicationUserId');

  if (requestingUserRole === 'admin') {
    return true;
  }

  if (requestingUserId !== applicationUserId) {
    throw new ForbiddenError('Forbidden: You do not have permission to access another student application');
  }

  return true;
}

/**
 * Verifies explicit student consent before exposing profile, project, or portfolio data to partner ecosystem.
 */
export async function assertStudentConsent(userId, consentType) {
  assertValidUUID(userId, 'userId');

  const validConsentTypes = [
    'PORTFOLIO_SHARING',
    'PROJECT_SHARING',
    'PROFILE_SHARING',
    'APPLICATION_PREPARATION',
    'PARTNER_DISCOVERY'
  ];

  if (!validConsentTypes.includes(consentType)) {
    throw new ValidationError(`Invalid consentType: ${consentType}`);
  }

  const consentRecord = await prisma.studentConsent.findUnique({
    where: { userId_consentType: { userId, consentType } }
  });

  if (!consentRecord || !consentRecord.granted) {
    throw new ForbiddenError(`Forbidden: Student has not granted explicit consent for ${consentType}`);
  }

  return true;
}

/**
 * Sanitizes opportunity and application data for guardian view.
 * Strips private notes, reflections, and private chats.
 */
export function sanitizeGuardianOpportunityView(applications) {
  if (!Array.isArray(applications)) return [];

  return applications.map(app => ({
    applicationId: app.id,
    opportunityTitle: app.opportunity?.title || 'Opportunity',
    organization: app.opportunity?.organization || 'Organization',
    status: app.status,
    appliedAt: app.appliedAt,
    updatedAt: app.updatedAt
  }));
}
