/**
 * EDOT Intelligence Domain - Course Context Resolver
 * 
 * Dynamically resolves the student's active learning context without hardcoding:
 * Priority:
 * 1. Explicit active learning session (most recent event with lessonId/courseId)
 * 2. Most recently accessed unfinished lesson
 * 3. Most recently active enrolled course
 * 4. Highest priority incomplete course
 * 5. Fallback: No active course
 */

import { prisma } from '../../../lib/prisma.js';

export async function resolveActiveLearningContext(studentId) {
  if (!studentId) return null;

  // Priority 1: Most recent learning event
  const recentEvent = await prisma.learningEvent.findFirst({
    where: { userId: studentId, courseId: { not: null } },
    orderBy: { timestamp: 'desc' }
  });

  if (recentEvent && recentEvent.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: recentEvent.courseId },
      select: { id: true, mainCategory: true }
    });

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, courseId: recentEvent.courseId }
    });

    const courseProgress = await prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId: studentId, courseId: recentEvent.courseId } }
    });

    if (course) {
      return {
        studentId,
        enrollmentId: enrollment?.id || null,
        courseId: course.id,
        categoryId: course.mainCategory || null,
        sectionId: recentEvent.sectionId || null,
        lessonId: recentEvent.lessonId || null,
        currentProgress: courseProgress?.progress || 0,
        lastActivity: recentEvent.timestamp,
        resolutionBasis: 'RECENT_LEARNING_EVENT'
      };
    }
  }

  // Priority 2 & 3: Most recently active course progress / enrollment
  const activeCourseProgress = await prisma.userCourseProgress.findFirst({
    where: { userId: studentId, completed: false },
    orderBy: { enrolledAt: 'desc' },
    include: { course: { select: { id: true, mainCategory: true } } }
  });

  if (activeCourseProgress && activeCourseProgress.course) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, courseId: activeCourseProgress.courseId }
    });

    return {
      studentId,
      enrollmentId: enrollment?.id || null,
      courseId: activeCourseProgress.courseId,
      categoryId: activeCourseProgress.course.mainCategory || null,
      sectionId: null,
      lessonId: null,
      currentProgress: activeCourseProgress.progress || 0,
      lastActivity: activeCourseProgress.updatedAt,
      resolutionBasis: 'MOST_RECENT_UNFINISHED_COURSE'
    };
  }

  // Priority 4: Any active enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId },
    orderBy: { requestedAt: 'desc' },
    include: { course: { select: { id: true, mainCategory: true } } }
  });

  if (enrollment && enrollment.course) {
    return {
      studentId,
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      categoryId: enrollment.course.mainCategory || null,
      sectionId: null,
      lessonId: null,
      currentProgress: 0,
      lastActivity: enrollment.requestedAt,
      resolutionBasis: 'ENROLLED_COURSE_FALLBACK'
    };
  }

  // Priority 5: Fallback - No active course
  return {
    studentId,
    enrollmentId: null,
    courseId: null,
    categoryId: null,
    sectionId: null,
    lessonId: null,
    currentProgress: 0,
    lastActivity: null,
    resolutionBasis: 'NO_ACTIVE_COURSE'
  };
}
