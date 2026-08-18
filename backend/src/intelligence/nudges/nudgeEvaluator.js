/**
 * EDOT Intelligence Domain - Intelligent Nudge Evaluator
 * Evaluates deterministic, evidence-based signals (stalled progress, milestone near, skill struggle,
 * upcoming deadline, streak achieved, ready for challenge) to generate calm, non-manipulative nudges.
 */

/**
 * Deterministically evaluates signals and returns candidates.
 * 
 * @param {Object} params 
 * @returns {Array} List of candidate nudge objects
 */
export function evaluateNudgeTriggers({
  inactiveDays = 0,
  moduleProgressPct = 0,
  strugglingTopics = [],
  streakDays = 0,
  skillMastery = 0,
  upcomingDeadlineHours = null
}) {
  const candidates = [];
  const now = new Date();
  const expiresThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const expiresSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Stalled Progression Signal
  if (inactiveDays >= 4) {
    candidates.push({
      triggerReason: 'STALLED_PROGRESSION',
      priority: 'HIGH',
      title: 'Resume Learning Momentum',
      message: `You haven't logged study progress in ${inactiveDays} days. A short 10-minute review session can help keep your momentum intact.`,
      recommendedAction: { label: 'Resume Lesson', targetUrl: '/lessons/active' },
      deliveryChannel: 'IN_APP',
      expiresAt: expiresThreeDays
    });
  }

  // 2. Milestone Near Signal
  if (moduleProgressPct >= 80 && moduleProgressPct < 100) {
    candidates.push({
      triggerReason: 'MILESTONE_NEAR',
      priority: 'MEDIUM',
      title: 'Almost Finished With Milestone!',
      message: `You are ${moduleProgressPct}% through your active module. Complete the remaining steps to earn your milestone proof.`,
      recommendedAction: { label: 'Complete Milestone', targetUrl: '/milestones/current' },
      deliveryChannel: 'IN_APP',
      expiresAt: expiresThreeDays
    });
  }

  // 3. Skill Struggle Signal
  if (strugglingTopics && strugglingTopics.length > 0) {
    const topic = strugglingTopics[0];
    candidates.push({
      triggerReason: 'SKILL_STRUGGLE',
      priority: 'HIGH',
      title: `Targeted Practice for ${topic}`,
      message: `Our analytics noticed repeated quiz friction in "${topic}". Would you like a targeted AI practice exercise to solidify this topic?`,
      recommendedAction: { label: 'Start Targeted Practice', targetUrl: `/practice?topic=${encodeURIComponent(topic)}` },
      deliveryChannel: 'IN_APP',
      expiresAt: expiresThreeDays
    });
  }

  // 4. Streak Achieved Signal
  if (streakDays >= 5) {
    candidates.push({
      triggerReason: 'STREAK_ACHIEVED',
      priority: 'LOW',
      title: `${streakDays}-Day Learning Streak Achieved! 🎉`,
      message: `Congratulations on maintaining consistency for ${streakDays} consecutive days!`,
      recommendedAction: { label: 'View Achievements', targetUrl: '/achievements' },
      deliveryChannel: 'IN_APP',
      expiresAt: expiresSevenDays
    });
  }

  // 5. Ready for Advanced Challenge Signal
  if (skillMastery >= 85) {
    candidates.push({
      triggerReason: 'READY_FOR_CHALLENGE',
      priority: 'MEDIUM',
      title: 'Ready for Advanced Project Challenge',
      message: 'Your demonstrated mastery exceeds 85%. You are ready to tackle a portfolio project challenge to showcase verified skill.',
      recommendedAction: { label: 'Explore Project Challenge', targetUrl: '/projects/recommended' },
      deliveryChannel: 'IN_APP',
      expiresAt: expiresSevenDays
    });
  }

  // 6. Upcoming Deadline Signal
  if (upcomingDeadlineHours !== null && upcomingDeadlineHours <= 48) {
    candidates.push({
      triggerReason: 'UPCOMING_DEADLINE',
      priority: 'HIGH',
      title: 'Assessment Deadline Approaching',
      message: `Your scheduled module assessment is due in ${upcomingDeadlineHours} hours.`,
      recommendedAction: { label: 'Open Assessment Workspace', targetUrl: '/assessments/active' },
      deliveryChannel: 'IN_APP',
      expiresAt: new Date(now.getTime() + upcomingDeadlineHours * 60 * 60 * 1000)
    });
  }

  return candidates;
}
