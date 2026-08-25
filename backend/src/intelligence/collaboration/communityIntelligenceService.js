/**
 * EDOT Intelligence Domain - Community Intelligence Service
 * Manages controlled study/skill/course/career communities, memberships, and explainable community recommendations.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './collaborationAuthorizationService.js';

/**
 * Creates a controlled study, skill, course, or career community.
 */
export async function createCommunity(creatorId, {
  name,
  description,
  type = 'SKILL_COMMUNITIES',
  accessType = 'OPEN',
  courseId = null
}) {
  assertValidUUID(creatorId, 'creatorId');

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${Date.now()}`;

  const community = await prisma.community.create({
    data: {
      name,
      slug,
      description,
      type,
      accessType,
      courseId,
      creatorId,
      status: 'ACTIVE'
    }
  });

  // Creator automatically joins as ADMIN member
  await prisma.communityMember.create({
    data: {
      communityId: community.id,
      userId: creatorId,
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  return community;
}

/**
 * Joins or requests membership in a community.
 */
export async function joinCommunity(userId, communityId) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(communityId, 'communityId');

  const community = await prisma.community.findUnique({ where: { id: communityId } });
  if (!community) throw new Error('Community not found');

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } }
  });

  if (existing) {
    if (existing.status === 'BLOCKED') throw new Error('Community membership blocked');
    return existing;
  }

  const initialStatus = community.accessType === 'OPEN' ? 'ACTIVE' : 'PENDING';

  return prisma.communityMember.create({
    data: {
      communityId,
      userId,
      role: 'MEMBER',
      status: initialStatus
    }
  });
}

/**
 * Recommends explainable communities for a student.
 */
export async function getRecommendedCommunities(userId) {
  assertValidUUID(userId, 'userId');

  const communities = await prisma.community.findMany({
    where: {
      status: 'ACTIVE',
      accessType: { in: ['OPEN', 'REQUEST_REQUIRED'] }
    },
    include: {
      _count: { select: { members: true } }
    }
  });

  return communities.map(c => ({
    communityId: c.id,
    name: c.name,
    description: c.description,
    type: c.type,
    accessType: c.accessType,
    memberCount: c._count.members,
    matchReason: `Recommended based on your interest in ${c.type.toLowerCase().replace('_', ' ')}`
  }));
}
