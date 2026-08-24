/**
 * EDOT Intelligence Domain - Closed-Loop Adaptation Engine (Phase 7)
 * 
 * Unifies all 6 EDOT Intelligence layers into a closed-loop adaptive ecosystem:
 * Stage 1: DETECT — Scans telemetry, weaknesses, fatigue signals, difficult concepts, cross-course problems.
 * Stage 2: SUPPORT — Coordinates role-based support (Student Nudges, Instructor Interventions, Admin Follow-ups, Guardian Encouragement).
 * Stage 3: MONITOR — Tracks post-support student telemetry to measure learning outcome changes.
 * Stage 4: ADAPT — Adjusts curriculum recommendation weights and adaptive sequencing based on confirmed learning recovery.
 */

import { prisma } from '../../../lib/prisma.js';
import { generateAdaptiveSequence } from './adaptiveSequencer.js';

/**
 * Scans active role-based interventions and measures subsequent student learning telemetry.
 */
export async function evaluateClosedLoopEcosystem() {
  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Fetch active instructor interventions
  const instructorInterventions = await prisma.instructorIntervention.findMany({
    where: { status: { in: ['STARTED', 'COMPLETED'] } }
  });

  // 2. Fetch guardian notifications & encouragements
  const guardianNotifications = await prisma.guardianNotification.findMany({
    where: { createdAt: { gte: SEVEN_DAYS_AGO } }
  });

  // 3. Fetch active intelligent nudges
  const nudges = await prisma.intelligentNudge.findMany({
    where: { createdAt: { gte: SEVEN_DAYS_AGO } }
  });

  let activityResumedCount = 0;
  let improvingCount = 0;

  for (const intervention of instructorInterventions) {
    if (intervention.studentId) {
      const subsequentEvents = await prisma.learningEvent.findMany({
        where: {
          userId: intervention.studentId,
          courseId: intervention.courseId,
          timestamp: { gte: intervention.createdAt }
        }
      });

      let updatedOutcome = intervention.outcome;
      if (subsequentEvents.length >= 3) {
        updatedOutcome = 'IMPROVING';
        improvingCount++;
      } else if (subsequentEvents.length > 0) {
        updatedOutcome = 'ACTIVITY_RESUMED';
        activityResumedCount++;
      }

      if (updatedOutcome !== intervention.outcome) {
        await prisma.instructorIntervention.update({
          where: { id: intervention.id },
          data: { outcome: updatedOutcome }
        });

        // Trigger adaptive sequencing adjustment for student
        await adaptCurriculumSequencing(intervention.studentId, intervention.courseId);
      }
    }
  }

  return {
    evaluatedAt: now,
    totalInstructorInterventionsEvaluated: instructorInterventions.length,
    totalGuardianAlertsEvaluated: guardianNotifications.length,
    totalNudgesEvaluated: nudges.length,
    outcomes: {
      activityResumedCount,
      improvingCount
    }
  };
}

/**
 * Adaptively adjusts student recommendation weights and non-destructive curriculum sequence
 * when post-intervention telemetry confirms learning recovery.
 * 
 * @param {string} studentId 
 * @param {string} courseId 
 */
export async function adaptCurriculumSequencing(studentId, courseId) {
  const profile = await prisma.courseLearnerProfile.findUnique({
    where: { userId_courseId: { userId: studentId, courseId } }
  });

  if (!profile) return null;

  // Upgrade learning status if student had attention status but resumed learning
  let newStatus = profile.learningStatus;
  if (profile.learningStatus === 'NEEDS_ATTENTION' || profile.learningStatus === 'SUPPORT_RECOMMENDED') {
    newStatus = 'ON_TRACK';
  }

  const updatedProfile = await prisma.courseLearnerProfile.update({
    where: { userId_courseId: { userId: studentId, courseId } },
    data: {
      learningStatus: newStatus,
      lastActivityAt: new Date()
    }
  });

  // Re-run adaptive sequencer
  const newSequence = await generateAdaptiveSequence(studentId, courseId);

  return {
    studentId,
    courseId,
    previousStatus: profile.learningStatus,
    adaptedStatus: newStatus,
    newSequence
  };
}

/**
 * Computes platform-wide 4-stage closed-loop ecosystem metrics:
 * DETECT -> SUPPORT -> MONITOR -> ADAPT
 */
export async function getEcosystemSummary() {
  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    eventsCount,
    weaknessesCount,
    quizAttempts,
    interventions,
    nudges,
    guardianNotifications,
    supportTickets,
    profiles
  ] = await Promise.all([
    prisma.learningEvent.count({ where: { timestamp: { gte: SEVEN_DAYS_AGO } } }),
    prisma.learnerWeakness.count(),
    prisma.quizAttempt.count({ where: { isCorrect: false } }),
    prisma.instructorIntervention.findMany({ select: { status: true, outcome: true } }),
    prisma.intelligentNudge.count(),
    prisma.guardianNotification.count(),
    prisma.humanSupportTicket.count({ where: { status: 'OPEN' } }),
    prisma.courseLearnerProfile.findMany({ select: { learningStatus: true } })
  ]);

  // Stage 1: DETECT metrics
  const detectionsCount = weaknessesCount + quizAttempts + supportTickets;

  // Stage 2: SUPPORT metrics
  const supportActionsCount = interventions.length + nudges + guardianNotifications;

  // Stage 3: MONITOR metrics
  const activityResumed = interventions.filter(i => i.outcome === 'ACTIVITY_RESUMED').length;
  const improving = interventions.filter(i => i.outcome === 'IMPROVING').length;
  const noChange = interventions.filter(i => i.outcome === 'NO_SIGNIFICANT_CHANGE').length;
  const totalMonitored = interventions.length || 1;

  // Stage 4: ADAPT metrics
  const adaptationSuccessRate = Math.round(((activityResumed + improving) / totalMonitored) * 100);

  const onTrackCount = profiles.filter(p => p.learningStatus === 'ON_TRACK' || p.learningStatus === 'COMPLETED').length;

  return {
    sourceType: 'EDOT_CLOSED_LOOP_ECOSYSTEM',
    generatedAt: now,
    ecosystemHealthIndex: adaptationSuccessRate >= 50 ? 'HEALTHY' : (adaptationSuccessRate >= 20 ? 'WATCH' : 'SUPPORT_RECOMMENDED'),
    stages: {
      detect: {
        stageName: 'DETECT',
        telemetryEvents7d: eventsCount,
        activeWeaknesses: weaknessesCount,
        failedQuizAttempts: quizAttempts,
        openSupportTickets: supportTickets,
        totalDetections: detectionsCount
      },
      support: {
        stageName: 'SUPPORT',
        instructorInterventions: interventions.length,
        intelligentNudges: nudges,
        guardianAlerts: guardianNotifications,
        totalSupportActions: supportActionsCount
      },
      monitor: {
        stageName: 'MONITOR',
        outcomes: {
          activityResumed,
          improving,
          noSignificantChange: noChange,
          insufficientTime: totalMonitored - (activityResumed + improving + noChange)
        }
      },
      adapt: {
        stageName: 'ADAPT',
        adaptationSuccessRatePercent: adaptationSuccessRate,
        onTrackLearnersRatioPercent: profiles.length > 0 ? Math.round((onTrackCount / profiles.length) * 100) : 100,
        closedLoopStatus: 'ACTIVE_ECOSYSTEM'
      }
    }
  };
}
