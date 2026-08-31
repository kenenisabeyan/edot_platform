/**
 * intelligenceVisibilityResolver.js
 * 
 * EDOT Universal Intelligence Privacy Engine
 * 
 * Enforces server-side privacy policies, authorization checks, and relationship-aware
 * data visibility matrix for all roles:
 *   - Student
 *   - Instructor
 *   - Admin
 *   - Parent / Guardian
 *   - Sponsor
 * 
 * ACCESS MATRIX:
 *   Data Type            Student      Instructor    Admin          Parent         Sponsor
 *   Own Progress         ✅ Own       —             Authorized     —              —
 *   Student Progress     Own only     Assigned      Authorized     Linked         Sponsored
 *   Private AI Chats     Own only     ❌ Forbidden  ❌ Forbidden   ❌ Forbidden   ❌ Forbidden
 *   Instructor Notes     ❌ Forbidden  Authorized    Limited        ❌ Forbidden   ❌ Forbidden
 *   Platform Analytics   ❌ Forbidden  Limited       ✅ Full        ❌ Forbidden   Aggregate only
 *   Sponsorship Data     ❌ Forbidden  ❌ Forbidden  Authorized     ❌ Forbidden   Authorized
 */

import { prisma } from '../../../lib/prisma.js';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden: Unauthorized intelligence access') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * Resolves whether a viewer is authorized to inspect a target student's intelligence.
 * 
 * @param {object} params
 * @param {string} params.viewerId
 * @param {string} params.viewerRole
 * @param {string} params.studentId
 * @returns {Promise<object>} Visibility permission DTO
 */
export async function resolveIntelligenceVisibility({ viewerId, viewerRole, studentId }) {
  if (!viewerId || !viewerRole) {
    throw new ForbiddenError('Authentication credentials missing');
  }

  const role = viewerRole.toLowerCase().trim();

  // 1. Own Student Data Access
  if (viewerId === studentId) {
    return {
      canViewProgress: true,
      canViewMastery: true,
      canViewSkills: true,
      canViewPrivateAIChats: true,
      canViewInstructorNotes: false,
      relationshipType: 'SELF',
      allowedAggregationLevel: 'DETAILED'
    };
  }

  // 2. Administrator Access
  if (role === 'admin' || role === 'administrator') {
    return {
      canViewProgress: true,
      canViewMastery: true,
      canViewSkills: true,
      canViewPrivateAIChats: false, // Privacy rule: Private AI mentor chats remain strictly student-only
      canViewInstructorNotes: true,
      relationshipType: 'ADMINISTRATOR',
      allowedAggregationLevel: 'DETAILED'
    };
  }

  // 3. Instructor Access (Assigned courses only)
  if (role === 'instructor' || role === 'teacher') {
    const isAssigned = await verifyInstructorStudentRelationship(viewerId, studentId);
    if (!isAssigned) {
      throw new ForbiddenError('Instructor is not authorized to access this unassigned student.');
    }
    return {
      canViewProgress: true,
      canViewMastery: true,
      canViewSkills: true,
      canViewPrivateAIChats: false, // Privacy rule: Private AI chats hidden from instructors
      canViewInstructorNotes: true,
      relationshipType: 'INSTRUCTOR',
      allowedAggregationLevel: 'DETAILED'
    };
  }

  // 4. Parent / Guardian Access (Linked child relationship only)
  if (role === 'parent' || role === 'guardian') {
    const isLinked = await verifyParentChildRelationship(viewerId, studentId);
    if (!isLinked) {
      throw new ForbiddenError('Parent/Guardian is not linked to this student account.');
    }
    return {
      canViewProgress: true,
      canViewMastery: true,
      canViewSkills: true,
      canViewPrivateAIChats: false, // Strict privacy: AI mentor chats remain private to student
      canViewInstructorNotes: false,
      relationshipType: 'GUARDIAN',
      allowedAggregationLevel: 'SUPPORTIVE_SUMMARY'
    };
  }

  // 5. Sponsor Access (Explicitly sponsored students only)
  if (role === 'sponsor') {
    const isSponsored = await verifySponsorStudentRelationship(viewerId, studentId);
    if (!isSponsored) {
      throw new ForbiddenError('Sponsor is not authorized to access this student.');
    }
    return {
      canViewProgress: true,
      canViewMastery: true,
      canViewSkills: true,
      canViewPrivateAIChats: false,
      canViewInstructorNotes: false,
      relationshipType: 'SPONSOR',
      allowedAggregationLevel: 'IMPACT_SUMMARY'
    };
  }

  throw new ForbiddenError('Unauthorized role access request');
}

/**
 * Asserts that a viewer has authorization to view a target student's data. Throws ForbiddenError if denied.
 */
export async function assertStudentAccessPermission(viewerId, viewerRole, studentId) {
  return await resolveIntelligenceVisibility({ viewerId, viewerRole, studentId });
}

/**
 * Asserts that private AI mentor conversations are only accessible by the owner student.
 */
export function assertPrivateAIChatAccess(viewerId, studentId) {
  if (viewerId !== studentId) {
    throw new ForbiddenError('Private AI mentor conversations are strictly private to the student.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP VERIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function verifyInstructorStudentRelationship(instructorId, studentId) {
  try {
    const instructorCourses = await prisma.course.findMany({
      where: { instructorId },
      select: { id: true }
    });
    const courseIds = instructorCourses.map(c => c.id);

    if (courseIds.length === 0) return false;

    const progress = await prisma.userCourseProgress.findFirst({
      where: { userId: studentId, courseId: { in: courseIds } }
    });
    return Boolean(progress);
  } catch {
    return false;
  }
}

async function verifyParentChildRelationship(parentId, studentId) {
  try {
    const child = await prisma.user.findFirst({
      where: { id: studentId, parentId }
    });
    return Boolean(child);
  } catch {
    return false;
  }
}

async function verifySponsorStudentRelationship(sponsorId, studentId) {
  try {
    const sponsorship = await prisma.sponsorship.findFirst({
      where: { sponsorId, studentId }
    });
    return Boolean(sponsorship);
  } catch {
    return false;
  }
}
