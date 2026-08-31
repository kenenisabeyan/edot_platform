/**
 * studentStatusIntelligenceService.js
 * 
 * EDOT Universal Student Status Engine
 * 
 * Resolves relationship-authorized student statuses for any authorized viewer:
 *   - 🟢 ON_TRACK
 *   - 🟡 MAKING_PROGRESS
 *   - 🟠 NEEDS_ATTENTION
 *   - 🔴 SUPPORT_RECOMMENDED
 *   - 🔵 RETURNING
 *   - 🟣 ACHIEVEMENT_MILESTONE
 *   - ⚪ NOT_ENOUGH_ACTIVITY_YET
 * 
 * Translates raw DB signals (progress, events, quiz attempts, weaknesses) into
 * human-friendly, supportive status DTOs.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveIntelligenceVisibility } from '../privacy/intelligenceVisibilityResolver.js';
import { translateProgressForRole } from '../translation/progressIntelligenceTranslator.js';

export async function getStudentIntelligenceStatus({ studentId, viewerId, viewerRole }) {
  // 1. Authorize viewer relationship & privacy boundaries
  const visibility = await resolveIntelligenceVisibility({ viewerId, viewerRole, studentId });

  // 2. Fetch student telemetry
  const [
    student,
    learnerProfile,
    userProgresses,
    recentEvents,
    weaknesses,
    achievements
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, avatar: true, department: true }
    }),
    prisma.learnerProfile.findUnique({ where: { userId: studentId } }).catch(() => null),
    prisma.userCourseProgress.findMany({
      where: { userId: studentId },
      include: { course: { select: { id: true, title: true } } }
    }).catch(() => []),
    prisma.learningEvent.findMany({
      where: { userId: studentId, timestamp: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
      orderBy: { timestamp: 'desc' }
    }).catch(() => []),
    prisma.learnerWeakness.findMany({
      where: { userId: studentId, isResolved: false }
    }).catch(() => []),
    prisma.achievement.findMany({
      where: { userId: studentId }
    }).catch(() => [])
  ]);

  if (!student) {
    throw new Error('Student account not found.');
  }

  // 3. Compute status indicator code
  const totalCourses = userProgresses.length;
  const totalProgress = userProgresses.reduce((acc, p) => acc + (p.progress || 0), 0);
  const avgProgress = totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0;

  const now = Date.now();
  const lastEventTime = recentEvents[0] ? new Date(recentEvents[0].timestamp).getTime() : 0;
  const daysInactive = lastEventTime ? Math.floor((now - lastEventTime) / (24 * 60 * 60 * 1000)) : 14;

  let statusCode = 'MAKING_PROGRESS';

  if (totalCourses === 0 || recentEvents.length === 0) {
    statusCode = 'NOT_ENOUGH_ACTIVITY_YET';
  } else if (achievements.length > 0 && achievements.some(a => (now - new Date(a.createdAt).getTime()) < 3 * 24 * 60 * 60 * 1000)) {
    statusCode = 'ACHIEVEMENT_MILESTONE';
  } else if (daysInactive >= 2 && daysInactive <= 5 && recentEvents.length > 0) {
    statusCode = 'RETURNING';
  } else if (weaknesses.length >= 3 || daysInactive >= 7) {
    statusCode = 'SUPPORT_RECOMMENDED';
  } else if (daysInactive >= 4 || avgProgress < 30) {
    statusCode = 'NEEDS_ATTENTION';
  } else if (avgProgress >= 70) {
    statusCode = 'ON_TRACK';
  } else {
    statusCode = 'MAKING_PROGRESS';
  }

  // 4. Translate progress into role-specific human-friendly narrative
  const translated = translateProgressForRole({
    statusCode,
    avgProgress,
    daysInactive,
    weaknessCount: weaknesses.length,
    viewerRole,
    studentName: student.name
  });

  return {
    studentId: student.id,
    studentName: student.name,
    avatar: student.avatar,
    statusCode,
    statusLabel: translated.statusLabel,
    humanSummary: translated.humanSummary,
    recommendedAction: translated.recommendedAction,
    metrics: {
      enrolledCourses: totalCourses,
      avgProgress: `${avgProgress}%`,
      lastActiveDaysAgo: daysInactive,
      activeWeaknessCount: weaknesses.length
    },
    privacyScope: visibility.allowedAggregationLevel,
    evaluatedAt: new Date()
  };
}
