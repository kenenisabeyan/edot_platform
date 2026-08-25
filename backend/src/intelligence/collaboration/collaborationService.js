/**
 * EDOT Intelligence Domain - Human, Mentorship & Collaborative Intelligence Master Orchestrator
 * Coordinates mentor matching, mentorship workflows, peer learning, team health, community intelligence,
 * safety blocking/reporting, and instructor/admin/guardian integrations.
 */

import { prisma } from '../../../lib/prisma.js';
import {
  assertValidUUID,
  assertUserRelationshipAccess,
  assertBlockedStatus,
  assertGuardianStudentLink,
  sanitizeGuardianCollaborationView
} from './collaborationAuthorizationService.js';
import { createOrUpdateMentorProfile, updateMentorVerificationStatus, getRecommendedMentors } from './mentorMatchingService.js';
import { requestRelationship, respondToRelationshipRequest, createMentorshipGoal, scheduleMentorshipSession } from './mentorshipWorkflowService.js';
import { updatePeerDiscoverability, getRecommendedPeers } from './peerLearningService.js';
import { getTeamHealthAnalysis } from './teamHealthService.js';
import { createCommunity, joinCommunity, getRecommendedCommunities } from './communityIntelligenceService.js';

export {
  assertValidUUID,
  assertUserRelationshipAccess,
  assertBlockedStatus,
  sanitizeGuardianCollaborationView,
  createOrUpdateMentorProfile,
  updateMentorVerificationStatus,
  getRecommendedMentors,
  requestRelationship,
  respondToRelationshipRequest,
  createMentorshipGoal,
  scheduleMentorshipSession,
  updatePeerDiscoverability,
  getRecommendedPeers,
  getTeamHealthAnalysis,
  createCommunity,
  joinCommunity,
  getRecommendedCommunities
};

/**
 * Blocks a user for safety and excludes them from matching and recommendations.
 */
export async function blockUser(reporterId, targetId, reason = null) {
  assertValidUUID(reporterId, 'reporterId');
  assertValidUUID(targetId, 'targetId');

  const blockRecord = await prisma.userBlockReport.upsert({
    where: {
      reporterId_targetId_type: {
        reporterId,
        targetId,
        type: 'BLOCK'
      }
    },
    update: { status: 'ACTIVE', reason },
    create: {
      reporterId,
      targetId,
      type: 'BLOCK',
      reason,
      status: 'ACTIVE'
    }
  });

  return blockRecord;
}

/**
 * Reports a user for moderation review.
 */
export async function reportUser(reporterId, targetId, reason) {
  assertValidUUID(reporterId, 'reporterId');
  assertValidUUID(targetId, 'targetId');

  const report = await prisma.userBlockReport.create({
    data: {
      reporterId,
      targetId,
      type: 'REPORT',
      reason,
      status: 'ACTIVE'
    }
  });

  return report;
}

/**
 * Instructor aggregate collaboration & mentorship insights (Phase 4 extension).
 */
export async function getInstructorCollaborationInsights(instructorId) {
  assertValidUUID(instructorId, 'instructorId');

  const relationships = await prisma.userRelationship.findMany({
    take: 50,
    orderBy: { updatedAt: 'desc' },
    include: {
      requester: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } }
    }
  });

  return {
    instructorId,
    totalRelationships: relationships.length,
    activeMentorships: relationships.filter(r => r.relationshipType === 'MENTOR' && r.status === 'ACTIVE').length,
    recentConnections: relationships.slice(0, 10).map(r => ({
      relationshipId: r.id,
      requesterName: r.requester.name,
      targetName: r.target.name,
      relationshipType: r.relationshipType,
      status: r.status,
      createdAt: r.createdAt
    }))
  };
}

/**
 * Admin institutional collaboration intelligence (Phase 5 extension).
 */
export async function getAdminCollaborationIntelligence() {
  const totalMentors = await prisma.mentorProfile.count();
  const verifiedMentors = await prisma.mentorProfile.count({ where: { verificationStatus: 'VERIFIED' } });
  const totalRelationships = await prisma.userRelationship.count();
  const activeRelationships = await prisma.userRelationship.count({ where: { status: 'ACTIVE' } });
  const totalCommunities = await prisma.community.count();

  return {
    totalMentors,
    verifiedMentors,
    totalRelationships,
    activeRelationships,
    totalCommunities,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Privacy-safe collaboration overview for guardians (Phase 6 extension).
 */
export async function getGuardianCollaborationSummary(guardianId, studentId) {
  await assertGuardianStudentLink(guardianId, studentId);

  const relationships = await prisma.userRelationship.findMany({
    where: {
      OR: [{ requesterId: studentId }, { targetId: studentId }]
    },
    orderBy: { updatedAt: 'desc' }
  });

  return {
    studentId,
    totalRelationships: relationships.length,
    activeRelationships: relationships.filter(r => r.status === 'ACTIVE').length,
    relationships: sanitizeGuardianCollaborationView(relationships)
  };
}
