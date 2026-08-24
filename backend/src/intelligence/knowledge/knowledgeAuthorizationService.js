/**
 * EDOT Intelligence Domain - Knowledge Authorization Service
 * 
 * Enforces server-side authorization for knowledge access, instructor mapping approvals,
 * and guardian privacy policies.
 */

import { prisma } from '../../../lib/prisma.js';
import { verifyGuardianStudentAccess } from '../context/guardianContextResolver.js';
import { ForbiddenError } from '../context/instructorContextResolver.js';

/**
 * Asserts that a user has access to retrieve knowledge for a target course.
 * 
 * @param {string} userId 
 * @param {string} courseId 
 */
export async function verifyCourseKnowledgeAccess(userId, courseId) {
  if (!userId || !courseId) {
    throw new ForbiddenError('User ID and Course ID are required.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!user) {
    throw new ForbiddenError('User account not found.');
  }

  if (user.role === 'admin') return true;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true, isPublished: true }
  });

  if (!course) {
    throw new ForbiddenError('Course not found.');
  }

  // Instructor ownership check
  if (user.role === 'instructor') {
    if (course.instructorId === user.id) return true;
    throw new ForbiddenError('Unauthorized: Instructors can only access knowledge for courses they own.');
  }

  // Student enrollment check
  if (user.role === 'student') {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: user.id, courseId, status: 'approved' }
    });

    if (enrollment) return true;
    throw new ForbiddenError(`Unauthorized: You are not enrolled in course ID "${courseId}".`);
  }

  // Guardian check
  if (user.role === 'parent' || user.role === 'guardian') {
    // Check if guardian has at least one active linked student enrolled in this course
    const linkedLinks = await prisma.guardianStudent.findMany({
      where: { guardianId: user.id, status: 'ACTIVE' },
      select: { studentId: true }
    });

    const studentIds = linkedLinks.map(l => l.studentId);
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: { in: studentIds }, courseId, status: 'approved' }
    });

    if (enrollment) return true;
    throw new ForbiddenError('Unauthorized: None of your linked students are enrolled in this course.');
  }

  throw new ForbiddenError('Unauthorized knowledge retrieval request.');
}

/**
 * Asserts that an instructor owns a course before modifying its knowledge map.
 * 
 * @param {string} instructorId 
 * @param {string} courseId 
 */
export async function verifyInstructorKnowledgeOwnership(instructorId, courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true }
  });

  if (!course || course.instructorId !== instructorId) {
    throw new ForbiddenError('Unauthorized: Only the course instructor can modify this knowledge map.');
  }

  return true;
}
