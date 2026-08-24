/**
 * EDOT Intelligence Domain - Guardian Intelligence Service
 * 
 * Provides guardian dashboard overview, course progress tracking, important changes,
 * supportive non-judgmental recommendations, deduplicated notifications, and support request workflows.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveGuardianContext, verifyGuardianStudentAccess } from '../context/guardianContextResolver.js';
import { sanitizeForGuardian } from '../policy/guardianVisibilityPolicy.js';
import { evaluateLearnerFatigue } from '../monitoring/learningPulseEngine.js';

/**
 * Retrieves the list of authorized active linked students for a guardian.
 * 
 * @param {string} guardianId 
 */
export async function getGuardianLinkedStudents(guardianId) {
  const context = await resolveGuardianContext(guardianId);
  return context.linkedStudents;
}

/**
 * Computes a supportive, explainable intelligence overview for a target linked student.
 * 
 * @param {string} guardianId 
 * @param {string} studentId 
 */
export async function getGuardianStudentOverview(guardianId, studentId) {
  await verifyGuardianStudentAccess(guardianId, studentId);

  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    student,
    learnerProfile,
    courseProfiles,
    userProgresses,
    recentEvents
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, avatar: true, batch: true, department: true }
    }),
    prisma.learnerProfile.findUnique({ where: { userId: studentId } }),
    prisma.courseLearnerProfile.findMany({
      where: { userId: studentId },
      include: { course: { select: { id: true, title: true } } }
    }),
    prisma.userCourseProgress.findMany({
      where: { userId: studentId },
      include: { course: { select: { id: true, title: true } } }
    }),
    prisma.learningEvent.findMany({
      where: { userId: studentId, timestamp: { gte: SEVEN_DAYS_AGO } },
      orderBy: { timestamp: 'desc' }
    })
  ]);

  if (!student) {
    throw new Error('Student account not found.');
  }

  // Determine overall status based on LearnerProfile & CourseLearnerProfiles
  let overallStatus = learnerProfile?.overallLearningStatus || 'ON_TRACK';
  const hasAttentionNeeded = courseProfiles.some(p => p.learningStatus === 'NEEDS_ATTENTION');
  const hasSupportRecommended = courseProfiles.some(p => p.learningStatus === 'SUPPORT_RECOMMENDED');

  if (hasSupportRecommended) overallStatus = 'SUPPORT_RECOMMENDED';
  else if (hasAttentionNeeded) overallStatus = 'NEEDS_ATTENTION';

  // Activity summary
  const lastEvent = recentEvents[0];
  const daysInactive = lastEvent ? Math.floor((now.getTime() - new Date(lastEvent.timestamp).getTime()) / (24 * 60 * 60 * 1000)) : 7;

  let recentActivitySummary = 'Student has maintained regular learning activity this week.';
  if (recentEvents.length === 0 || daysInactive >= 5) {
    recentActivitySummary = `Learning activity has slowed down recently (no course activity detected in ${daysInactive} days).`;
  } else if (recentEvents.length >= 10) {
    recentActivitySummary = 'High learning momentum: Student is actively working through course modules.';
  }

  // Course progress list
  const courseProgressList = userProgresses.map(up => ({
    courseId: up.courseId,
    courseTitle: up.course?.title || 'Course',
    progress: up.progress || 0,
    completed: up.completed || false,
    status: up.progress >= 100 ? 'COMPLETED' : (daysInactive >= 5 ? 'NEEDS_ATTENTION' : 'ON_TRACK')
  }));

  // Supportive explanation & recommendation
  let statusExplanation = 'Student is making steady progress across enrolled courses.';
  let recommendedGuardianAction = {
    type: 'CELEBRATE_PROGRESS',
    title: 'Acknowledge Momentum',
    suggestedMessage: `Great job on staying consistent with your learning in ${courseProgressList[0]?.courseTitle || 'your courses'}!`
  };

  if (overallStatus === 'NEEDS_ATTENTION' || daysInactive >= 5) {
    statusExplanation = 'Learning activity has decreased recently and some enrolled coursework remains incomplete.';
    recommendedGuardianAction = {
      type: 'ENCOURAGE_LEARNING',
      title: 'Encourage Course Resumption',
      suggestedMessage: 'A gentle reminder or supportive conversation can help your student get back on track with their study schedule.'
    };
  } else if (overallStatus === 'SUPPORT_RECOMMENDED') {
    statusExplanation = 'Recent assessment results suggest your student may benefit from additional review or support.';
    recommendedGuardianAction = {
      type: 'REVIEW_SUPPORT',
      title: 'Discuss Learning Support',
      suggestedMessage: 'Consider asking whether your student would like additional practice materials or a 1-on-1 check-in with their instructor.'
    };
  }

  const overviewData = {
    studentId: student.id,
    studentName: student.name,
    studentAvatar: student.avatar || 'default-avatar.png',
    overallStatus,
    statusExplanation,
    recentActivitySummary,
    daysInactive,
    activeEventsCount7d: recentEvents.length,
    courseProgressList,
    recommendedGuardianAction,
    dataStatus: userProgresses.length > 0 ? 'SUFFICIENT' : 'INSUFFICIENT_DATA',
    evaluatedAt: now
  };

  return sanitizeForGuardian(overviewData);
}

/**
 * Retrieves authorized per-course progress details for a linked student.
 * 
 * @param {string} guardianId 
 * @param {string} studentId 
 */
export async function getGuardianCourseProgress(guardianId, studentId) {
  await verifyGuardianStudentAccess(guardianId, studentId);

  const userProgresses = await prisma.userCourseProgress.findMany({
    where: { userId: studentId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          mainCategory: true,
          thumbnail: true,
          instructor: { select: { name: true } }
        }
      }
    }
  });

  const progressDetails = userProgresses.map(up => ({
    courseId: up.courseId,
    courseTitle: up.course?.title || 'Course',
    instructorName: up.course?.instructor?.name || 'Faculty',
    category: up.course?.mainCategory || 'General',
    progress: up.progress || 0,
    completed: up.completed || false,
    updatedAt: up.updatedAt
  }));

  return sanitizeForGuardian({ studentId, courses: progressDetails });
}

/**
 * Detects important changes for a linked student (milestones, activity resumptions, drop-offs).
 * 
 * @param {string} guardianId 
 * @param {string} studentId 
 */
export async function getGuardianImportantChanges(guardianId, studentId) {
  await verifyGuardianStudentAccess(guardianId, studentId);

  const changes = [];
  const now = new Date();

  const userProgresses = await prisma.userCourseProgress.findMany({
    where: { userId: studentId },
    include: { course: { select: { title: true } } }
  });

  userProgresses.forEach(up => {
    if (up.progress >= 100 || up.completed) {
      changes.push({
        id: `change-completed-${up.courseId}`,
        type: 'COURSE_COMPLETED',
        studentId,
        courseId: up.courseId,
        title: `Completed ${up.course?.title || 'Course'}`,
        reason: 'Student successfully achieved 100% course completion milestone.',
        priority: 'HIGH',
        generatedAt: up.updatedAt
      });
    } else if (up.progress >= 50 && up.progress < 60) {
      changes.push({
        id: `change-milestone-${up.courseId}`,
        type: 'MAJOR_PROGRESS_MILESTONE',
        studentId,
        courseId: up.courseId,
        title: `Halfway Milestone in ${up.course?.title || 'Course'}`,
        reason: 'Student completed 50% of the course curriculum.',
        priority: 'MEDIUM',
        generatedAt: up.updatedAt
      });
    }
  });

  return sanitizeForGuardian({ studentId, changes });
}

/**
 * Returns supportive guardian action recommendations with non-judgmental messaging.
 * 
 * @param {string} guardianId 
 * @param {string} studentId 
 */
export async function getGuardianRecommendations(guardianId, studentId) {
  await verifyGuardianStudentAccess(guardianId, studentId);

  const overview = await getGuardianStudentOverview(guardianId, studentId);
  const recommendations = [overview.recommendedGuardianAction];

  return sanitizeForGuardian({ studentId, recommendations });
}

/**
 * Retrieves deduplicated guardian notifications.
 * 
 * @param {string} guardianId 
 * @param {object} [options] 
 * @param {string} [options.studentId] 
 * @param {number} [options.limit=20] 
 */
export async function getGuardianNotifications(guardianId, { studentId = null, limit = 20 } = {}) {
  const context = await resolveGuardianContext(guardianId);

  let targetStudentIds = context.linkedStudentIds;
  if (studentId) {
    await verifyGuardianStudentAccess(guardianId, studentId);
    targetStudentIds = [String(studentId)];
  }

  if (targetStudentIds.length === 0) return [];

  const notifications = await prisma.guardianNotification.findMany({
    where: {
      guardianId,
      studentId: { in: targetStudentIds }
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 20, 50)
  });

  return sanitizeForGuardian(notifications);
}

/**
 * Records a supportive guardian encouragement check-in message for a student.
 * 
 * @param {string} guardianId 
 * @param {string} studentId 
 * @param {string} message 
 */
export async function sendEncouragement(guardianId, studentId, message) {
  await verifyGuardianStudentAccess(guardianId, studentId);

  const context = await resolveGuardianContext(guardianId);

  // Send in-app notification to student
  await prisma.notification.create({
    data: {
      userId: studentId,
      title: `Message from ${context.guardianName}`,
      message: message || 'Your guardian sent you a word of encouragement! Keep up the great work!',
      type: 'GUARDIAN_ENCOURAGEMENT',
      isRead: false
    }
  });

  // Record guardian notification log
  await prisma.guardianNotification.create({
    data: {
      guardianId,
      studentId,
      type: 'ACTIVITY_RESUMED',
      priority: 'LOW',
      title: 'Encouragement Sent',
      message: `You sent an encouragement message to your student.`,
      status: 'READ',
      readAt: new Date()
    }
  });

  return { success: true, message: 'Encouragement sent successfully to student.' };
}

/**
 * Submits a support request from guardian to course instructor.
 * 
 * @param {string} guardianId 
 * @param {object} params 
 * @param {string} params.studentId 
 * @param {string} [params.courseId] 
 * @param {string} params.reason 
 */
export async function requestSupport(guardianId, { studentId, courseId = null, reason }) {
  await verifyGuardianStudentAccess(guardianId, studentId);

  const context = await resolveGuardianContext(guardianId);

  let targetInstructorId = null;
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true }
    });
    if (course) targetInstructorId = course.instructorId;
  }

  // Create HumanSupportTicket for escalation
  const ticket = await prisma.humanSupportTicket.create({
    data: {
      userId: studentId,
      courseId,
      triggerReason: `Guardian Request: ${reason || 'Guardian requested learning support check-in'}`,
      confidenceScore: 1.0,
      userConsentGiven: true,
      sharedContextSummary: { guardianId, guardianName: context.guardianName, reason },
      status: 'OPEN',
      assignedInstructorId: targetInstructorId
    }
  });

  return { success: true, ticketId: ticket.id, message: 'Support request submitted to faculty.' };
}
