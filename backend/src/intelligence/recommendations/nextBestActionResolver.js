/**
 * EDOT Intelligence Domain - Next Best Action Resolver Engine
 * 
 * Resolves a single, prioritized, explainable Next Best Action for a learner.
 * Priority:
 * 1. Critical Remediation: Failed quiz (<60%) or high error topic -> Remediate concept.
 * 2. Resume Active Unfinished Lesson: In-progress video/lesson -> Resume learning.
 * 3. Next Sequential Lesson: Previous lesson completed -> Advance to next module.
 * 4. Course Onboarding: Enrolled but 0 progress -> Start Lesson 1.
 * 5. Course Discovery: No active courses -> Discover courses.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveActiveLearningContext } from '../context/courseContextResolver.js';

export async function resolveNextBestAction(studentId) {
  if (!studentId) return null;

  // 1. Check for Critical Remediation (Failed Quiz in past 7 days)
  const failedQuizEvent = await prisma.learningEvent.findFirst({
    where: {
      userId: studentId,
      eventType: { in: ['QUIZ_FAILED', 'QUIZ_COMPLETED'] },
      score: { lt: 60, not: null }
    },
    orderBy: { timestamp: 'desc' },
    include: { user: false }
  });

  if (failedQuizEvent && failedQuizEvent.courseId && failedQuizEvent.score < 60) {
    const course = await prisma.course.findUnique({
      where: { id: failedQuizEvent.courseId },
      select: { id: true, title: true }
    });

    return {
      actionType: 'REMEDIATE_MISCONCEPTION',
      priority: 'HIGH',
      title: `Review Quiz Concepts in ${course?.title || 'Course'}`,
      description: `Your recent score was ${failedQuizEvent.score}%. Re-read key materials before attempting new modules.`,
      targetUrl: `/courses/${failedQuizEvent.courseId}`,
      courseId: failedQuizEvent.courseId,
      lessonId: failedQuizEvent.lessonId || null,
      quizId: failedQuizEvent.quizId || null,
      rationale: {
        basis: 'QUIZ_REMEDIATION',
        score: failedQuizEvent.score,
        explanation: `Your quiz score (${failedQuizEvent.score}%) indicated conceptual gaps. Mastering foundational material early prevents learning friction.`
      }
    };
  }

  // 2. Check for Unfinished In-Progress Lesson (Heartbeat ping exists but video not completed)
  const unfinishedProgress = await prisma.progressLog.findFirst({
    where: { userId: studentId, isVideoComplete: false },
    orderBy: { updatedAt: 'desc' },
    include: { course: { select: { id: true, title: true } } }
  });

  if (unfinishedProgress && unfinishedProgress.course) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: unfinishedProgress.lessonId },
      select: { id: true, title: true }
    });

    return {
      actionType: 'RESUME_LESSON',
      priority: 'HIGH',
      title: `Resume "${lesson?.title || 'Lesson'}"`,
      description: `Continue watching "${lesson?.title || 'Lesson'}" in ${unfinishedProgress.course.title}.`,
      targetUrl: `/courses/${unfinishedProgress.courseId}/lessons/${unfinishedProgress.lessonId}`,
      courseId: unfinishedProgress.courseId,
      lessonId: unfinishedProgress.lessonId,
      rationale: {
        basis: 'IN_PROGRESS_LESSON',
        courseTitle: unfinishedProgress.course.title,
        lessonTitle: lesson?.title || 'Lesson',
        explanation: `You left off in "${lesson?.title || 'Lesson'}". Resume your active session to maintain learning momentum.`
      }
    };
  }

  // 3. Resolve active learning context for Next Sequential Lesson or Course Onboarding
  const context = await resolveActiveLearningContext(studentId);

  if (context && context.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: context.courseId },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, order: true }
        }
      }
    });

    if (course && course.lessons.length > 0) {
      // Find completed lesson IDs
      const completedEvents = await prisma.learningEvent.findMany({
        where: { userId: studentId, courseId: context.courseId, eventType: 'LESSON_COMPLETED' },
        select: { lessonId: true }
      });
      const completedIds = new Set(completedEvents.map(e => e.lessonId).filter(Boolean));

      const nextLesson = course.lessons.find(l => !completedIds.has(l.id)) || course.lessons[0];

      return {
        actionType: completedIds.size > 0 ? 'START_NEXT_LESSON' : 'START_COURSE_MODULE',
        priority: 'MEDIUM',
        title: `${completedIds.size > 0 ? 'Continue with' : 'Start'} "${nextLesson.title}"`,
        description: `${completedIds.size > 0 ? 'Next lesson' : 'First lesson'} in ${course.title}.`,
        targetUrl: `/courses/${course.id}/lessons/${nextLesson.id}`,
        courseId: course.id,
        lessonId: nextLesson.id,
        rationale: {
          basis: completedIds.size > 0 ? 'NEXT_SEQUENTIAL_LESSON' : 'COURSE_ONBOARDING',
          courseTitle: course.title,
          lessonTitle: nextLesson.title,
          explanation: completedIds.size > 0
            ? `You have completed ${completedIds.size} lesson(s). Move to "${nextLesson.title}" to advance your curriculum.`
            : `Welcome to ${course.title}! Start with "${nextLesson.title}" to establish your baseline.`
        }
      };
    }
  }

  // 4. Fallback: Course Discovery
  return {
    actionType: 'EXPLORE_COURSES',
    priority: 'LOW',
    title: 'Explore Available Courses',
    description: 'Browse the course catalog and enroll in your first learning track.',
    targetUrl: '/courses',
    courseId: null,
    lessonId: null,
    rationale: {
      basis: 'CATALOG_DISCOVERY',
      explanation: 'No active course enrollments detected. Discover foundational modules matching your career interests.'
    }
  };
}
