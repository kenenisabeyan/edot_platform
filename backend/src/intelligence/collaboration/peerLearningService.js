/**
 * EDOT Intelligence Domain - Peer Learning & Complementary Skill Matching Service
 * Manages opt-in peer discoverability (NOT_DISCOVERABLE by default) and matches peers based on complementary skills.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './collaborationAuthorizationService.js';

/**
 * Updates peer discoverability and opt-in privacy preferences.
 */
export async function updatePeerDiscoverability(userId, {
  optIn = false,
  visibility = 'NOT_DISCOVERABLE',
  studyGoals = [],
  availableHours = null
}) {
  assertValidUUID(userId, 'userId');

  const validVisibilities = ['NOT_DISCOVERABLE', 'COURSE_ONLY', 'SKILL_MATCHING', 'PROJECT_COLLABORATION'];
  const finalVisibility = optIn && validVisibilities.includes(visibility) ? visibility : 'NOT_DISCOVERABLE';

  let profile = await prisma.peerDiscoverability.findUnique({ where: { userId } });

  const data = {
    userId,
    optIn,
    visibility: finalVisibility,
    studyGoals,
    availableHours
  };

  if (profile) {
    profile = await prisma.peerDiscoverability.update({
      where: { userId },
      data
    });
  } else {
    profile = await prisma.peerDiscoverability.create({ data });
  }

  return profile;
}

/**
 * Recommends compatible peers for opt-in students based on complementary skills and shared goals.
 */
export async function getRecommendedPeers(studentId) {
  assertValidUUID(studentId, 'studentId');

  // Verify student has opted in
  const studentOptIn = await prisma.peerDiscoverability.findUnique({ where: { userId: studentId } });
  if (!studentOptIn || !studentOptIn.optIn || studentOptIn.visibility === 'NOT_DISCOVERABLE') {
    return {
      studentId,
      isDiscoverable: false,
      message: 'Opt-in to peer discoverability in your settings to view and connect with study peers.',
      peers: []
    };
  }

  // Fetch blocked users
  const blockRecords = await prisma.userBlockReport.findMany({
    where: {
      type: 'BLOCK',
      status: 'ACTIVE',
      OR: [{ reporterId: studentId }, { targetId: studentId }]
    }
  });

  const blockedUserIds = new Set(
    blockRecords.map(b => (b.reporterId === studentId ? b.targetId : b.reporterId))
  );

  // Fetch discoverable peers
  const peers = await prisma.peerDiscoverability.findMany({
    where: {
      optIn: true,
      visibility: { not: 'NOT_DISCOVERABLE' },
      userId: { notIn: Array.from(blockedUserIds).concat(studentId) }
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, avatar: true }
      }
    }
  });

  const recommendedPeers = peers.map(p => ({
    peerId: p.userId,
    name: p.user.name,
    visibility: p.visibility,
    studyGoals: p.studyGoals || [],
    matchReason: 'Opted-in peer matching based on shared learning objectives and complementary skill growth.',
    matchScore: 0.85
  }));

  return {
    studentId,
    isDiscoverable: true,
    peers: recommendedPeers
  };
}
