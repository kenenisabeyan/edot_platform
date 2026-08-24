/**
 * EDOT Intelligence Domain - Guardian Context Resolver
 * 
 * Provides server-side authorization and relationship validation for guardians/parents.
 * Ensures guardians can ONLY access intelligence for students with an ACTIVE relationship or parent link.
 */

import { prisma } from '../../../lib/prisma.js';
import { ForbiddenError } from './instructorContextResolver.js';

/**
 * Resolves the authorized context and linked students for an authenticated guardian.
 * 
 * @param {string} guardianId 
 */
export async function resolveGuardianContext(guardianId) {
  if (!guardianId) {
    throw new ForbiddenError('Authentication required to access guardian intelligence.');
  }

  const user = await prisma.user.findUnique({
    where: { id: guardianId },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user) {
    throw new ForbiddenError('Guardian account not found.');
  }

  // Admin bypass
  if (user.role === 'admin') {
    const allStudents = await prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, name: true, email: true, avatar: true }
    });
    return {
      guardianId: user.id,
      guardianName: user.name,
      role: user.role,
      linkedStudentIds: allStudents.map(s => s.id),
      linkedStudents: allStudents.map(s => ({
        studentId: s.id,
        name: s.name,
        email: s.email,
        avatar: s.avatar,
        relationshipType: 'ADMIN'
      }))
    };
  }

  // 1. Fetch active GuardianStudent explicit relationships
  const explicitLinks = await prisma.guardianStudent.findMany({
    where: { guardianId, status: 'ACTIVE' },
    include: {
      student: { select: { id: true, name: true, email: true, avatar: true } }
    }
  });

  // 2. Fetch legacy User.parentId children
  const directChildren = await prisma.user.findMany({
    where: { parentId: guardianId },
    select: { id: true, name: true, email: true, avatar: true }
  });

  const studentMap = new Map();

  explicitLinks.forEach(link => {
    studentMap.set(link.studentId, {
      studentId: link.studentId,
      name: link.student?.name || 'Student',
      email: link.student?.email,
      avatar: link.student?.avatar || 'default-avatar.png',
      relationshipType: link.relationshipType
    });
  });

  directChildren.forEach(child => {
    if (!studentMap.has(child.id)) {
      studentMap.set(child.id, {
        studentId: child.id,
        name: child.name,
        email: child.email,
        avatar: child.avatar || 'default-avatar.png',
        relationshipType: 'PARENT'
      });
    }
  });

  const linkedStudents = Array.from(studentMap.values());
  const linkedStudentIds = Array.from(studentMap.keys());

  return {
    guardianId: user.id,
    guardianName: user.name,
    role: user.role,
    linkedStudentIds,
    linkedStudents
  };
}

/**
 * Asserts that the authenticated guardian has an authorized ACTIVE relationship with the student.
 * 
 * @param {string} guardianId 
 * @param {string} studentId 
 */
export async function verifyGuardianStudentAccess(guardianId, studentId) {
  if (!guardianId || !studentId) {
    throw new ForbiddenError('Missing guardian or student parameter.');
  }

  const context = await resolveGuardianContext(guardianId);

  if (context.role === 'admin') return true;

  const isAuthorized = context.linkedStudentIds.includes(String(studentId));
  if (!isAuthorized) {
    throw new ForbiddenError(`Unauthorized: You are not authorized to access intelligence for student ID "${studentId}".`);
  }

  return true;
}
