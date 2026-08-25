/**
 * EDOT Intelligence Domain - AI Incident & Alerting Service
 * Tracks AI safety, privacy, prompt injection, and quality incidents (AIIncident)
 * with deduplication and alert management.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

/**
 * Creates an AIIncident with deduplication for repeated signals.
 */
export async function createAIIncident({ category, severity = 'MEDIUM', summary, details = null, createdBy }) {
  assertValidUUID(createdBy, 'createdBy');

  const validCategories = [
    'SAFETY_VIOLATION', 'PRIVACY_RISK', 'UNAUTHORIZED_DATA_ATTEMPT',
    'PROMPT_INJECTION_ATTEMPT', 'HALLUCINATION_RISK', 'SYSTEMIC_QUALITY_DEGRADATION',
    'MODEL_FAILURE', 'BIAS_RISK'
  ];

  if (!validCategories.includes(category)) {
    throw new Error(`Invalid incident category: ${category}`);
  }

  // Deduplication check: check if an OPEN incident with same category & summary exists within 10 minutes
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const existing = await prisma.aIIncident.findFirst({
    where: {
      category,
      summary,
      status: { in: ['OPEN', 'INVESTIGATING'] },
      createdAt: { gte: tenMinsAgo }
    }
  });

  if (existing) {
    return { deduplicated: true, incident: existing };
  }

  const incident = await prisma.aIIncident.create({
    data: {
      category,
      severity,
      summary,
      details,
      createdBy,
      status: 'OPEN'
    }
  });

  return { deduplicated: false, incident };
}

/**
 * Updates an AIIncident status.
 */
export async function updateIncidentStatus(incidentId, status) {
  assertValidUUID(incidentId, 'incidentId');

  const validStatuses = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'DISMISSED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  return prisma.aIIncident.update({
    where: { id: incidentId },
    data: { status }
  });
}
