/**
 * EDOT Intelligence Domain - Project & Portfolio Authorization Service
 * Enforces server-side student data isolation, strict UUID validation,
 * instructor course/project relationship verification, and guardian privacy policy.
 */

import { prisma } from '../../../lib/prisma.js';
import { ForbiddenError, ValidationError, NotFoundError } from '../shared/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Asserts parameter is a valid UUID format. Rejects AI-hallucinated or malformed strings.
 */
export function assertValidUUID(id, paramName = 'ID') {
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id.trim())) {
    throw new ValidationError(`Invalid ${paramName} format: must be a valid UUID`);
  }
  return id.trim();
}

/**
 * Enforces student data isolation. Only the student themselves or an admin can access private student project data.
 */
export function assertStudentOwnsProjectData(requestingUserId, targetStudentId, requestingUserRole = 'student') {
  assertValidUUID(requestingUserId, 'requestingUserId');
  assertValidUUID(targetStudentId, 'targetStudentId');

  if (requestingUserRole === 'admin') {
    return true;
  }

  if (requestingUserId !== targetStudentId) {
    throw new ForbiddenError("Forbidden: You do not have permission to access another student's project data");
  }

  return true;
}

/**
 * Verifies an instructor has authorization to review or access a student's course project submission.
 */
export async function assertInstructorProjectAccess(instructorId, submissionId, requestingUserRole = 'instructor') {
  assertValidUUID(instructorId, 'instructorId');
  assertValidUUID(submissionId, 'submissionId');

  if (requestingUserRole === 'admin') {
    return true;
  }

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: {
      project: true,
      user: true
    }
  });

  if (!submission) {
    throw new NotFoundError('Project submission not found');
  }

  // If project is linked to a course, verify instructor teaches that course
  if (submission.project.courseId) {
    const course = await prisma.course.findFirst({
      where: {
        id: submission.project.courseId,
        instructorId
      }
    });
    if (course) return true;
  }

  // Check if instructor is assigned directly to the student
  const student = await prisma.user.findFirst({
    where: {
      id: submission.userId,
      assignedInstructorId: instructorId
    }
  });

  if (student) return true;

  // Check if project creator is the instructor
  if (submission.project.creatorId === instructorId) return true;

  throw new ForbiddenError('Forbidden: Instructor is not authorized to review this student submission');
}

/**
 * Verifies active link between guardian and student.
 */
export async function assertGuardianStudentLink(guardianId, studentId) {
  assertValidUUID(guardianId, 'guardianId');
  assertValidUUID(studentId, 'studentId');

  const link = await prisma.guardianStudent.findFirst({
    where: {
      guardianId,
      studentId,
      status: 'ACTIVE'
    }
  });

  if (!link) {
    throw new ForbiddenError('Forbidden: Active guardian-student relationship required');
  }

  return link;
}

/**
 * Sanitizes project data for guardian view, removing private reflections, private feedback, and instructor notes.
 */
export function sanitizeGuardianProjectView(projects) {
  if (!Array.isArray(projects)) return [];

  return projects.map(p => ({
    projectId: p.projectId || p.id,
    title: p.title || p.project?.title,
    category: p.category || p.project?.category,
    status: p.status,
    completedMilestoneCount: p.completedMilestoneCount || 0,
    totalMilestoneCount: p.totalMilestoneCount || 0,
    verifiedStatus: p.isVerified ? 'VERIFIED' : 'IN_PROGRESS',
    demonstratedSkills: p.demonstratedSkills || p.project?.requiredSkills || [],
    updatedAt: p.updatedAt
  }));
}
