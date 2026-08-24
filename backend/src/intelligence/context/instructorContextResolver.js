/**
 * EDOT Intelligence Domain - Instructor Context Resolver
 * 
 * Provides server-side authorization and context resolution for instructors.
 * Enforces strict course ownership and student access boundaries:
 * An instructor can ONLY access intelligence for courses assigned to them and students enrolled in those courses.
 */

import { prisma } from '../../../lib/prisma.js';

export class ForbiddenError extends Error {
  constructor(message = 'Access forbidden: You are not authorized to view this resource.') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * Resolves the full authorized context for an authenticated instructor.
 * 
 * @param {string} instructorId 
 */
export async function resolveInstructorContext(instructorId) {
  if (!instructorId) {
    throw new ForbiddenError('Authentication required to access instructor intelligence.');
  }

  const user = await prisma.user.findUnique({
    where: { id: instructorId },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
    throw new ForbiddenError('User is not authorized as an instructor.');
  }

  // Query courses assigned to instructor (for admin role, if no assigned courses, fetch active courses)
  const coursesWhere = user.role === 'admin' ? {} : { instructorId };
  const assignedCourses = await prisma.course.findMany({
    where: coursesWhere,
    select: {
      id: true,
      title: true,
      mainCategory: true,
      subCategory: true,
      status: true,
      totalStudents: true,
      createdAt: true
    }
  });

  const assignedCourseIds = assignedCourses.map(c => c.id);

  // Query sections assigned to instructor
  const sectionsWhere = user.role === 'admin' ? {} : { instructorId };
  const assignedSections = await prisma.section.findMany({
    where: sectionsWhere,
    select: { id: true, courseId: true, name: true }
  });

  const assignedSectionIds = assignedSections.map(s => s.id);

  // Query enrollments for assigned courses
  const enrollments = assignedCourseIds.length > 0
    ? await prisma.enrollment.findMany({
        where: {
          courseId: { in: assignedCourseIds },
          status: 'approved'
        },
        select: { studentId: true, courseId: true }
      })
    : [];

  const enrolledStudentIds = [...new Set(enrollments.map(e => e.studentId))];

  return {
    instructorId: user.id,
    instructorName: user.name,
    role: user.role,
    assignedCourseIds,
    assignedSectionIds,
    enrolledStudentIds,
    activeCoursesCount: assignedCourses.length,
    activeStudentsCount: enrolledStudentIds.length,
    courses: assignedCourses
  };
}

/**
 * Verifies that the instructor has authorized access to a specific course.
 * 
 * @param {string} instructorId 
 * @param {string} courseId 
 * @returns {Promise<boolean>}
 */
export async function verifyInstructorCourseAccess(instructorId, courseId) {
  if (!instructorId || !courseId) {
    throw new ForbiddenError('Missing instructor or course parameter.');
  }

  const context = await resolveInstructorContext(instructorId);

  if (context.role === 'admin') return true;

  const hasAccess = context.assignedCourseIds.includes(String(courseId));
  if (!hasAccess) {
    throw new ForbiddenError(`Unauthorized: You are not assigned as the instructor for course ID "${courseId}".`);
  }

  return true;
}

/**
 * Verifies that the instructor has authorized access to a specific student in an assigned course.
 * 
 * @param {string} instructorId 
 * @param {string} studentId 
 * @param {string} [courseId] 
 * @returns {Promise<boolean>}
 */
export async function verifyInstructorStudentAccess(instructorId, studentId, courseId = null) {
  if (!instructorId || !studentId) {
    throw new ForbiddenError('Missing instructor or student parameter.');
  }

  const context = await resolveInstructorContext(instructorId);

  if (context.role === 'admin') return true;

  if (courseId) {
    await verifyInstructorCourseAccess(instructorId, courseId);
  }

  const isEnrolled = context.enrolledStudentIds.includes(String(studentId));
  if (!isEnrolled) {
    throw new ForbiddenError(`Unauthorized: Student ID "${studentId}" is not enrolled in any of your assigned courses.`);
  }

  return true;
}
