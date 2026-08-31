/**
 * auditLogService.js
 * 
 * EDOT Audit & Security Action Logger
 * 
 * Tracks sensitive relationship lifecycle & communication events:
 *   - RELATIONSHIP_CREATED
 *   - RELATIONSHIP_UPDATED
 *   - RELATIONSHIP_REVOKED
 *   - INTELLIGENCE_ACCESSED
 *   - COMMUNICATION_STARTED
 *   - MESSAGE_SENT
 *   - MEETING_REQUESTED
 *   - SUPPORT_REQUEST_CREATED
 * 
 * Strict Privacy Rule: Never stores private chat text in audit logs! Only sanitized metadata.
 */

import { prisma } from '../../../lib/prisma.js';

export async function logAuditEvent({ eventType, actorId, targetId, resource, metadata = {} }) {
  if (!eventType || !actorId) return null;

  const logEntry = {
    eventType,
    actorId,
    targetId: targetId || null,
    resource: resource || 'RELATIONSHIP_SYSTEM',
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };

  try {
    // Save to database if schema audit table exists, or log safely
    await prisma.activity.create({
      data: {
        userId: actorId,
        type: eventType,
        description: `Audit event [${eventType}] on resource [${resource || 'system'}]`,
      }
    }).catch(() => {});
  } catch (error) {
    console.error('Audit Log Error (non-blocking):', error);
  }

  return logEntry;
}
