/**
 * EDOT Intelligence Domain - Learning Pulse & Fatigue Monitoring Engine
 * 
 * Provides real-time live telemetry feeds and evaluates learner study fatigue / cramming patterns.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Retrieves a real-time live telemetry activity stream across active learners.
 * 
 * @param {object} [options] 
 * @param {string} [options.courseId] 
 * @param {number} [options.limit=20] 
 */
export async function getLivePulseFeed({ courseId = null, limit = 20 } = {}) {
  const where = {};
  if (courseId) where.courseId = String(courseId);

  const events = await prisma.learningEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: Math.min(Number(limit) || 20, 50),
    include: {
      user: {
        select: { id: true, name: true, avatar: true }
      }
    }
  });

  const formattedFeed = events.map(e => {
    let actionTitle = 'studied a lesson';
    if (e.eventType === 'LESSON_COMPLETED') actionTitle = 'completed a lesson';
    else if (e.eventType === 'QUIZ_PASSED') actionTitle = `passed a quiz with score ${e.score || 80}%`;
    else if (e.eventType === 'QUIZ_COMPLETED') actionTitle = 'submitted a quiz attempt';
    else if (e.eventType === 'VIDEO_PROGRESS') actionTitle = 'watched course video material';
    else if (e.eventType === 'COURSE_ENROLLED') actionTitle = 'enrolled in a new course';
    else if (e.eventType === 'ASSIGNMENT_SUBMITTED') actionTitle = 'submitted an assignment';
    else if (e.eventType === 'ATTENDANCE_MARKED') actionTitle = 'attended a learning section';

    // Anonymous name formatting for public live pulse feeds
    const userName = e.user?.name ? `${e.user.name.split(' ')[0]} ${e.user.name.split(' ')[1]?.[0] || ''}.` : 'Student';

    return {
      eventId: e.id,
      studentName: userName,
      studentAvatar: e.user?.avatar || 'default-avatar.png',
      eventType: e.eventType,
      actionTitle: `${userName} ${actionTitle}`,
      courseId: e.courseId,
      timestamp: e.timestamp
    };
  });

  return {
    sourceType: 'EDOT_LEARNING_PULSE',
    generatedAt: new Date(),
    liveEventsCount: formattedFeed.length,
    feed: formattedFeed
  };
}

/**
 * Evaluates learner study session duration and late-night cramming patterns.
 * 
 * @param {string} studentId 
 */
export async function evaluateLearnerFatigue(studentId) {
  if (!studentId) return null;

  const now = new Date();
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const THREE_HOURS_AGO = new Date(now.getTime() - 3 * ONE_HOUR_MS);

  // Query events in past 3 hours
  const recentEvents = await prisma.learningEvent.findMany({
    where: {
      userId: studentId,
      timestamp: { gte: THREE_HOURS_AGO }
    },
    orderBy: { timestamp: 'asc' }
  });

  let continuousMinutes = 0;
  let isLateNightCramming = false;
  const fatigueReasons = [];

  if (recentEvents.length > 0) {
    const firstEvent = new Date(recentEvents[0].timestamp);
    const lastEvent = new Date(recentEvents[recentEvents.length - 1].timestamp);
    continuousMinutes = Math.round((lastEvent - firstEvent) / (60 * 1000));

    // Check for late-night activity (1 AM - 4 AM local time)
    isLateNightCramming = recentEvents.some(e => {
      const hour = new Date(e.timestamp).getHours();
      return hour >= 1 && hour <= 4;
    });
  }

  let fatigueScore = 0;

  if (continuousMinutes >= 90) {
    fatigueScore += 50;
    fatigueReasons.push(`Continuous study session detected: ${continuousMinutes} minutes of active learning without a rest break.`);
  } else if (continuousMinutes >= 60) {
    fatigueScore += 25;
    fatigueReasons.push(`Sustained study session: ${continuousMinutes} minutes logged.`);
  }

  if (isLateNightCramming) {
    fatigueScore += 40;
    fatigueReasons.push('Late-night study telemetry detected between 1:00 AM and 4:00 AM.');
  }

  const fatigueLevel = fatigueScore >= 60 ? 'HIGH_FATIGUE' : (fatigueScore >= 30 ? 'MODERATE' : 'NORMAL');
  const restRecommended = fatigueLevel === 'HIGH_FATIGUE' || continuousMinutes >= 90;

  return {
    studentId,
    fatigueScore: Math.min(100, fatigueScore),
    fatigueLevel,
    continuousStudyMinutes: continuousMinutes,
    isLateNightCramming,
    restRecommended,
    recommendationMessage: restRecommended
      ? "You've been studying hard for over 90 minutes. A 10-minute break will sharpen memory retention!"
      : "Study rhythm is healthy and balanced.",
    fatigueReasons,
    evaluatedAt: now
  };
}
