/**
 * EDOT Intelligence Domain - Mentor Profile & Matching Engine
 * Manages mentor profiles, verification states (UNVERIFIED, PENDING_REVIEW, VERIFIED, SUSPENDED, REJECTED),
 * capacity limits, and explainable, advisory mentor matching.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './collaborationAuthorizationService.js';

/**
 * Creates or updates a MentorProfile.
 */
export async function createOrUpdateMentorProfile(userId, {
  headline = null,
  bio = null,
  expertiseAreas = [],
  skills = [],
  experienceSummary = null,
  languages = ['English'],
  availability = null,
  mentorshipPreferences = null,
  maxMenteeCapacity = 5,
  visibilityStatus = 'EDOT_USERS'
}) {
  assertValidUUID(userId, 'userId');

  let profile = await prisma.mentorProfile.findUnique({ where: { userId } });

  const data = {
    userId,
    headline,
    bio,
    expertiseAreas,
    skills,
    experienceSummary,
    languages,
    availability,
    mentorshipPreferences,
    maxMenteeCapacity,
    visibilityStatus
  };

  if (profile) {
    profile = await prisma.mentorProfile.update({
      where: { userId },
      data
    });
  } else {
    profile = await prisma.mentorProfile.create({
      data: {
        ...data,
        verificationStatus: 'UNVERIFIED'
      }
    });
  }

  return profile;
}

/**
 * Administrative verification of a mentor profile.
 */
export async function updateMentorVerificationStatus(userId, verificationStatus, reviewerNotes = null) {
  assertValidUUID(userId, 'userId');

  const validStatuses = ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'SUSPENDED', 'REJECTED'];
  if (!validStatuses.includes(verificationStatus)) {
    throw new Error(`Invalid verificationStatus: must be one of ${validStatuses.join(', ')}`);
  }

  const profile = await prisma.mentorProfile.update({
    where: { userId },
    data: { verificationStatus }
  });

  return profile;
}

/**
 * Recommends explainable, potentially relevant mentors for a student.
 * Filters out unverified/suspended mentors, full-capacity mentors, and blocked users.
 */
export async function getRecommendedMentors(studentId) {
  assertValidUUID(studentId, 'studentId');

  // Fetch student career goals and interests
  const [goals, interests, blockRecords] = await Promise.all([
    prisma.careerGoal.findMany({ where: { userId: studentId, status: 'ACTIVE' } }),
    prisma.learnerCareerInterest.findMany({ where: { userId: studentId, status: 'ACTIVE' } }),
    prisma.userBlockReport.findMany({
      where: {
        type: 'BLOCK',
        status: 'ACTIVE',
        OR: [{ reporterId: studentId }, { targetId: studentId }]
      }
    })
  ]);

  const blockedUserIds = new Set(
    blockRecords.map(b => (b.reporterId === studentId ? b.targetId : b.reporterId))
  );

  // Fetch all verified mentors with capacity
  const mentors = await prisma.mentorProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      visibilityStatus: { in: ['EDOT_USERS', 'PUBLIC'] },
      userId: { notIn: Array.from(blockedUserIds).concat(studentId) }
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, avatar: true }
      }
    }
  });

  // Calculate current active mentees per mentor
  const mentorUserIds = mentors.map(m => m.userId);
  const activeRelationships = await prisma.userRelationship.findMany({
    where: {
      targetId: { in: mentorUserIds },
      relationshipType: 'MENTOR',
      status: 'ACTIVE'
    }
  });

  const menteeCounts = {};
  for (const rel of activeRelationships) {
    menteeCounts[rel.targetId] = (menteeCounts[rel.targetId] || 0) + 1;
  }

  const studentTargetAreas = [
    ...goals.map(g => g.title),
    ...interests.map(i => i.interestText)
  ];

  const recommendations = [];

  for (const m of mentors) {
    const currentCount = menteeCounts[m.userId] || 0;
    if (currentCount >= m.maxMenteeCapacity) {
      continue; // Skip mentors at maximum capacity
    }

    const expertiseList = Array.isArray(m.expertiseAreas) ? m.expertiseAreas : [];
    const matchedArea = expertiseList.find(area =>
      studentTargetAreas.some(target => target.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(target.toLowerCase()))
    );

    recommendations.push({
      mentorId: m.userId,
      name: m.user.name,
      headline: m.headline || 'EDOT Mentor',
      bio: m.bio,
      expertiseAreas: m.expertiseAreas,
      languages: m.languages,
      currentCapacity: `${currentCount} / ${m.maxMenteeCapacity} mentees`,
      matchReason: matchedArea
        ? `Potentially relevant mentor based on your interest in ${matchedArea}`
        : 'Recommended based on overall technical and domain expertise',
      verificationStatus: m.verificationStatus
    });
  }

  return recommendations;
}
