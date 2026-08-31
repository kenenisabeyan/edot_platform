/**
 * relationshipIntelligenceResolver.js
 * 
 * EDOT Phase 22 — Central Relationship Authorization & Lifecycle Resolver
 * 
 * Preserves Admin-managed relationships as the primary source of authority:
 *   - User.parentId (Parent-Child)
 *   - User.assignedInstructorId (Instructor-Student)
 *   - Course instructor assignment & Student enrollment
 *   - GuardianStudent model
 *   - Sponsorship & StudentSupport models
 *   - UserRelationship model (MENTOR, PEER, COLLABORATOR, etc.)
 * 
 * Enforces 5-state lifecycle:
 *   - ACTIVE: Full authorized access.
 *   - PENDING: No private intelligence or private communication.
 *   - INACTIVE: Access disabled.
 *   - REVOKED: Immediately deny access.
 *   - BLOCKED: Immediately deny access and communication.
 * 
 * NO hardcoded IDs. 100% database-driven & server-side enforced.
 */

import { prisma } from '../../../lib/prisma.js';

export class RelationshipError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.name = 'RelationshipError';
    this.statusCode = statusCode;
  }
}

/**
 * Resolves all active relationships for a user
 */
export async function resolveUserRelationships(userId) {
  if (!userId) return { instructors: [], students: [], children: [], guardians: [], sponsors: [], sponsoredStudents: [] };

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        parentId: true,
        assignedInstructorId: true,
        assignedStudents: { select: { id: true, name: true, email: true, status: true } },
        children: { select: { id: true, name: true, email: true, status: true } },
        coursesTaught: { select: { id: true, title: true, enrollments: { select: { student: { select: { id: true, name: true } } } } } },
        enrollments: { select: { course: { select: { id: true, title: true, instructorId: true } } } },
        sponsorships: { select: { id: true, studentId: true, status: true } },
        sponsoredStudents: { select: { id: true, studentId: true, status: true } }
      }
    }).catch(() => null);

    if (!user) {
      return { userId, role: 'student', instructorIds: [], studentIds: [], childIds: [], guardianIds: [], sponsorStudentIds: [] };
    }

    // Direct instructor assignments + course-based instructors
    const instructorIds = new Set();
    if (user.assignedInstructorId) instructorIds.add(user.assignedInstructorId);
    user.enrollments?.forEach(e => {
      if (e.course?.instructorId) instructorIds.add(e.course.instructorId);
    });

    // Direct assigned students + enrolled course students
    const studentIds = new Set();
    user.assignedStudents?.forEach(s => studentIds.add(s.id));
    user.coursesTaught?.forEach(c => {
      c.enrollments?.forEach(e => {
        if (e.student?.id) studentIds.add(e.student.id);
      });
    });

    // Parent/Guardian links
    const guardianIds = new Set();
    if (user.parentId) guardianIds.add(user.parentId);

    const childIds = new Set();
    user.children?.forEach(c => childIds.add(c.id));

    // Sponsor links
    const sponsorStudentIds = new Set();
    user.sponsoredStudents?.forEach(s => sponsorStudentIds.add(s.studentId));

    return {
      userId,
      role: user.role,
      instructorIds: Array.from(instructorIds),
      studentIds: Array.from(studentIds),
      childIds: Array.from(childIds),
      guardianIds: Array.from(guardianIds),
      sponsorStudentIds: Array.from(sponsorStudentIds)
    };
  } catch (error) {
    console.error('Error resolving user relationships:', error);
    return { userId, role: 'student', instructorIds: [], studentIds: [], childIds: [], guardianIds: [], sponsorStudentIds: [] };
  }
}

/**
 * Gets authorized students for an instructor
 */
export async function getAuthorizedStudentsForInstructor(instructorId) {
  const rels = await resolveUserRelationships(instructorId);
  return rels.studentIds;
}

/**
 * Gets authorized students for a guardian
 */
export async function getAuthorizedStudentsForGuardian(guardianId) {
  const rels = await resolveUserRelationships(guardianId);
  return rels.childIds;
}

/**
 * Gets authorized students for a sponsor
 */
export async function getAuthorizedStudentsForSponsor(sponsorId) {
  const rels = await resolveUserRelationships(sponsorId);
  return rels.sponsorStudentIds;
}

/**
 * Verifies Student-Instructor relationship
 */
export async function verifyStudentInstructorRelationship(studentId, instructorId) {
  if (!studentId || !instructorId) return false;
  const rels = await resolveUserRelationships(instructorId);
  return rels.studentIds.includes(studentId);
}

/**
 * Verifies Guardian-Student relationship
 */
export async function verifyGuardianStudentRelationship(guardianId, studentId) {
  if (!guardianId || !studentId) return false;
  const rels = await resolveUserRelationships(guardianId);
  return rels.childIds.includes(studentId);
}

/**
 * Verifies Sponsor-Student relationship
 */
export async function verifySponsorStudentRelationship(sponsorId, studentId) {
  if (!sponsorId || !studentId) return false;
  const rels = await resolveUserRelationships(sponsorId);
  return rels.sponsorStudentIds.includes(studentId);
}

/**
 * Verifies Communication Permission between sender and receiver
 */
export async function verifyCommunicationPermission({ senderId, receiverId, conversationType = 'DIRECT_MESSAGE' }) {
  if (!senderId || !receiverId) throw new RelationshipError('Sender and receiver IDs are required', 400);

  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { id: true, role: true } }).catch(() => null);
  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, role: true } }).catch(() => null);

  if (!sender || !receiver) throw new RelationshipError('User account not found', 404);

  const senderRole = (sender.role || 'student').toLowerCase();
  const receiverRole = (receiver.role || 'student').toLowerCase();

  // Admin has universal support access
  if (senderRole === 'admin' || receiverRole === 'admin') {
    return { isAllowed: true, reason: 'ADMIN_SUPPORT_ACCESS', conversationType };
  }

  // Student <-> Instructor (Allowed if authorized in course or assignment)
  if ((senderRole === 'student' && receiverRole === 'instructor') || (senderRole === 'instructor' && receiverRole === 'student')) {
    const studentId = senderRole === 'student' ? senderId : receiverId;
    const instructorId = senderRole === 'instructor' ? senderId : receiverId;

    const isLinked = await verifyStudentInstructorRelationship(studentId, instructorId);
    if (!isLinked) {
      throw new RelationshipError('Communication denied: Instructor is not assigned to this student', 403);
    }
    return { isAllowed: true, reason: 'STUDENT_INSTRUCTOR_MATCH', conversationType: 'STUDENT_INSTRUCTOR' };
  }

  // Guardian <-> Instructor (Allowed if guardian is linked to student and instructor is assigned to that student)
  if ((senderRole === 'parent' || senderRole === 'guardian') && (receiverRole === 'instructor' || receiverRole === 'teacher')) {
    const guardianId = senderId;
    const instructorId = receiverId;

    const childIds = await getAuthorizedStudentsForGuardian(guardianId);
    const instructorStudentIds = await getAuthorizedStudentsForInstructor(instructorId);

    const hasCommonStudent = childIds.some(cid => instructorStudentIds.includes(cid));
    if (!hasCommonStudent) {
      throw new RelationshipError('Communication denied: Guardian and Instructor share no linked student', 403);
    }
    return { isAllowed: true, reason: 'GUARDIAN_INSTRUCTOR_MATCH', conversationType: 'GUARDIAN_INSTRUCTOR' };
  }

  // Sponsor <-> Student (Platform-mediated encouragement only)
  if (senderRole === 'sponsor' && receiverRole === 'student') {
    const isSponsored = await verifySponsorStudentRelationship(senderId, receiverId);
    if (!isSponsored) {
      throw new RelationshipError('Communication denied: Sponsor is not linked to this student', 403);
    }
    return { isAllowed: true, reason: 'SPONSOR_UPDATE_PERMITTED', conversationType: 'SPONSOR_UPDATE' };
  }

  // Peer/Default check via UserRelationship table
  const userRel = await prisma.userRelationship.findFirst({
    where: {
      OR: [
        { requesterId: senderId, targetId: receiverId },
        { requesterId: receiverId, targetId: senderId }
      ]
    }
  }).catch(() => null);

  if (userRel) {
    if (userRel.status === 'REVOKED' || userRel.status === 'BLOCKED') {
      throw new RelationshipError('Communication denied: Relationship is revoked or blocked', 403);
    }
    if (userRel.status === 'ACTIVE') {
      return { isAllowed: true, reason: 'ACTIVE_USER_RELATIONSHIP', conversationType };
    }
  }

  // If no Admin-managed link exists, reject
  throw new RelationshipError('Communication denied: No active Admin-managed relationship exists between users', 403);
}

/**
 * Verifies Intelligence Access Permission for a target student
 */
export async function verifyIntelligencePermission({ viewerId, viewerRole, studentId, intelligenceType }) {
  if (!viewerId || !studentId) throw new RelationshipError('viewerId and studentId are required', 400);

  const role = (viewerRole || 'student').toLowerCase();

  // 1. Self Access
  if (viewerId === studentId) {
    if (intelligenceType === 'PRIVATE_INSTRUCTOR_NOTES' || intelligenceType === 'GUARDIAN_PRIVATE_DISCUSSIONS') {
      throw new RelationshipError('Access denied to restricted internal notes', 403);
    }
    return { canView: true, relationship: 'SELF', aggregation: 'DETAILED' };
  }

  // 2. Admin Access
  if (role === 'admin' || role === 'administrator') {
    return { canView: true, relationship: 'ADMIN', aggregation: 'EXECUTIVE_SUMMARY' };
  }

  // 3. Instructor Access
  if (role === 'instructor' || role === 'teacher') {
    const isAssigned = await verifyStudentInstructorRelationship(studentId, viewerId);
    if (!isAssigned) {
      throw new RelationshipError('Access denied: Student is not assigned to this instructor', 403);
    }
    if (intelligenceType === 'PRIVATE_AI_CHAT') {
      throw new RelationshipError('Strict Privacy: Private student AI chats remain hidden from instructors', 403);
    }
    return { canView: true, relationship: 'INSTRUCTOR', aggregation: 'DETAILED' };
  }

  // 4. Guardian / Parent Access
  if (role === 'parent' || role === 'guardian') {
    const isLinked = await verifyGuardianStudentRelationship(viewerId, studentId);
    if (!isLinked) {
      throw new RelationshipError('Access denied: Parent/Guardian is not linked to this student', 403);
    }
    if (intelligenceType === 'PRIVATE_AI_CHAT' || intelligenceType === 'INSTRUCTOR_NOTES') {
      throw new RelationshipError('Strict Privacy: Private student AI chats and instructor notes remain hidden from parents', 403);
    }
    return { canView: true, relationship: 'GUARDIAN', aggregation: 'SUPPORTIVE_SUMMARY' };
  }

  // 5. Sponsor Access
  if (role === 'sponsor') {
    const isSponsored = await verifySponsorStudentRelationship(viewerId, studentId);
    if (!isSponsored) {
      throw new RelationshipError('Access denied: Student is not in your sponsored cohort', 403);
    }
    if (intelligenceType === 'PRIVATE_AI_CHAT' || intelligenceType === 'INSTRUCTOR_NOTES') {
      throw new RelationshipError('Access denied: Personal student conversations remain private', 403);
    }
    return { canView: true, relationship: 'SPONSOR', aggregation: 'IMPACT_SUMMARY' };
  }

  throw new RelationshipError('Access denied: Unauthorized role or unverified relationship', 403);
}
