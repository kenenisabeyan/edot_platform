/**
 * EDOT Intelligence Domain - Mentorship Workflow & Action Intelligence Service
 * Handles relationship requests, status lifecycle, goal tracking, and session action items.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertUserRelationshipAccess, assertBlockedStatus } from './collaborationAuthorizationService.js';

/**
 * Initiates a mentorship or collaboration request.
 */
export async function requestRelationship(requesterId, targetId, {
  relationshipType = 'MENTOR',
  focusAreas = [],
  notes = null
}) {
  assertValidUUID(requesterId, 'requesterId');
  assertValidUUID(targetId, 'targetId');
  await assertBlockedStatus(requesterId, targetId);

  const existing = await prisma.userRelationship.findFirst({
    where: { requesterId, targetId, relationshipType }
  });

  if (existing) {
    if (existing.status === 'BLOCKED') {
      throw new Error('Relationship interaction is blocked');
    }
    return existing;
  }

  const relationship = await prisma.userRelationship.create({
    data: {
      requesterId,
      targetId,
      relationshipType,
      status: 'PENDING',
      focusAreas,
      notes
    }
  });

  // Trigger Notification
  try {
    await prisma.notification.create({
      data: {
        userId: targetId,
        type: 'support_request',
        title: 'New Connection Request',
        message: `You have received a new ${relationshipType.toLowerCase()} request.`,
        relatedEntityType: 'relationship',
        relatedEntityId: relationship.id,
        actionUrl: `/intelligence/collaboration/requests`
      }
    });
  } catch {
    // Non-critical notification failure
  }

  return relationship;
}

/**
 * Responds to a relationship request (ACCEPT, DECLINE, PAUSE, COMPLETE, REVOKE).
 */
export async function respondToRelationshipRequest(relationshipId, targetId, { action = 'ACCEPT', notes = null, requestingUserRole = 'student' }) {
  assertValidUUID(relationshipId, 'relationshipId');
  assertValidUUID(targetId, 'targetId');

  const relationship = await prisma.userRelationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) {
    throw new Error('Relationship not found');
  }

  assertUserRelationshipAccess(targetId, relationship.requesterId, relationship.targetId, requestingUserRole);

  let newStatus = 'PENDING';
  let acceptedAt = relationship.acceptedAt;
  let completedAt = relationship.completedAt;

  switch (action) {
    case 'ACCEPT':
      newStatus = 'ACTIVE';
      acceptedAt = new Date();
      break;
    case 'DECLINE':
      newStatus = 'DECLINED';
      break;
    case 'PAUSE':
      newStatus = 'PAUSED';
      break;
    case 'COMPLETE':
      newStatus = 'COMPLETED';
      completedAt = new Date();
      break;
    case 'REVOKE':
      newStatus = 'REVOKED';
      break;
    default:
      throw new Error(`Invalid relationship action: ${action}`);
  }

  const updated = await prisma.userRelationship.update({
    where: { id: relationshipId },
    data: {
      status: newStatus,
      notes: notes || relationship.notes,
      acceptedAt,
      completedAt
    }
  });

  return updated;
}

/**
 * Creates a MentorshipGoal for an active relationship.
 */
export async function createMentorshipGoal(relationshipId, userId, { title, category = 'GENERAL_GUIDANCE', targetDate = null }) {
  assertValidUUID(relationshipId, 'relationshipId');
  assertValidUUID(userId, 'userId');

  const relationship = await prisma.userRelationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) throw new Error('Relationship not found');

  assertUserRelationshipAccess(userId, relationship.requesterId, relationship.targetId);

  return prisma.mentorshipGoal.create({
    data: {
      relationshipId,
      title,
      category,
      status: 'ACTIVE',
      progress: 0.0,
      targetDate: targetDate ? new Date(targetDate) : null
    }
  });
}

/**
 * Schedules a MentorshipSession with action items.
 */
export async function scheduleMentorshipSession(relationshipId, userId, {
  scheduledAt,
  durationMinutes = 60,
  meetingLink = null,
  actionItems = []
}) {
  assertValidUUID(relationshipId, 'relationshipId');
  assertValidUUID(userId, 'userId');

  const relationship = await prisma.userRelationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) throw new Error('Relationship not found');

  assertUserRelationshipAccess(userId, relationship.requesterId, relationship.targetId);

  return prisma.mentorshipSession.create({
    data: {
      relationshipId,
      scheduledAt: new Date(scheduledAt),
      durationMinutes,
      status: 'SCHEDULED',
      meetingLink,
      actionItems
    }
  });
}
