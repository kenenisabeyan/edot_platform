/**
 * EDOT Intelligence — Phase 12
 * Career Authorization Service
 *
 * All career data access is authorized server-side.
 * This service enforces ownership and relationship checks before any data
 * is returned.  Frontend IDs, AI-generated IDs, and URL parameters are
 * NEVER trusted on their own.
 */

import { prisma } from '../../../lib/prisma.js';
import { ForbiddenError, ValidationError } from '../shared/errors.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that an id looks like a real UUID (rejects AI-hallucinated ids).
 * @param {string} id
 * @param {string} label
 */
export function assertValidUUID(id, label = 'id') {
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id.trim())) {
    throw new ValidationError(`Invalid ${label}: "${id}" is not a valid UUID.`);
  }
}

// ── Student ownership ─────────────────────────────────────────────────────────

/**
 * Asserts that the requesting user is accessing their own career data.
 * Admins may access any student's data.
 *
 * @param {string} requestingUserId
 * @param {string} targetUserId
 * @param {string} [requestingUserRole]
 */
export function assertStudentOwnsCareerData(
  requestingUserId,
  targetUserId,
  requestingUserRole = 'student'
) {
  assertValidUUID(requestingUserId, 'requestingUserId');
  assertValidUUID(targetUserId, 'targetUserId');

  if (requestingUserRole === 'admin') return; // admins have full access

  if (requestingUserId !== targetUserId) {
    throw new ForbiddenError(
      'Access denied: you may only view your own career intelligence data.'
    );
  }
}

// ── Instructor access ─────────────────────────────────────────────────────────

/**
 * Verifies that an instructor teaches a specific course.
 * Used to authorize aggregate skill insights for course-level views.
 *
 * @param {string} instructorId
 * @param {string} courseId
 */
export async function assertInstructorCourseAccess(instructorId, courseId) {
  assertValidUUID(instructorId, 'instructorId');
  assertValidUUID(courseId, 'courseId');

  const course = await prisma.course.findFirst({
    where: { id: courseId, instructorId },
    select: { id: true }
  });

  if (!course) {
    throw new ForbiddenError(
      'Access denied: you do not teach this course or it does not exist.'
    );
  }
}

// ── Guardian access ───────────────────────────────────────────────────────────

/**
 * Verifies that a guardian has an active, authorized link to a student.
 *
 * @param {string} guardianId
 * @param {string} studentId
 */
export async function assertGuardianStudentLink(guardianId, studentId) {
  assertValidUUID(guardianId, 'guardianId');
  assertValidUUID(studentId, 'studentId');

  const link = await prisma.guardianStudent.findFirst({
    where: {
      guardianId,
      studentId,
      status: 'ACTIVE'
    },
    select: { id: true }
  });

  if (!link) {
    throw new ForbiddenError(
      'Access denied: no active guardian relationship found for this student.'
    );
  }
}

// ── Career path access ────────────────────────────────────────────────────────

/**
 * Resolves and validates a CareerPath ID.  Returns the career path or throws.
 *
 * @param {string} careerPathId
 * @returns {Promise<import('@prisma/client').CareerPath>}
 */
export async function resolveCareerPath(careerPathId) {
  assertValidUUID(careerPathId, 'careerPathId');

  const path = await prisma.careerPath.findUnique({
    where: { id: careerPathId },
    include: { skillRequirements: true }
  });

  if (!path || path.status === 'ARCHIVED') {
    throw new ForbiddenError(
      `Career path [${careerPathId}] not found or is no longer active.`
    );
  }

  return path;
}
