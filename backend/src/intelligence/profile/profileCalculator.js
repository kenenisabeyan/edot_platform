/**
 * EDOT Intelligence Domain - Deterministic Learner Profile Calculator
 * Computes engagement, consistency, momentum, risk level, and next best action
 * with full explainability reasons. Zero LLM dependencies for core metrics.
 */

/**
 * Calculates dynamic profile metrics from raw database records and learning events.
 * 
 * @param {object} params 
 * @param {Array} params.events - Historical LearningEvents
 * @param {Array} params.quizAttempts - Historical QuizAttempts
 * @param {Array} params.progressLogs - User course progress logs
 * @param {Array} params.skills - LearnerSkills
 * @param {Array} params.weaknesses - LearnerWeaknesses
 * @returns {object} Calculated metrics, explainable reasons, and recommended action
 */
export function calculateLearnerMetrics({
  events = [],
  quizAttempts = [],
  progressLogs = [],
  skills = [],
  weaknesses = []
}) {
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Filter events by timeframe
  const events7d = events.filter(e => (now - new Date(e.timestamp)) <= 7 * ONE_DAY_MS);
  const events14d = events.filter(e => (now - new Date(e.timestamp)) <= 14 * ONE_DAY_MS);
  const events30d = events.filter(e => (now - new Date(e.timestamp)) <= 30 * ONE_DAY_MS);

  // 1. Calculate Active Days & Inactivity
  const activeDays30d = new Set(events30d.map(e => new Date(e.timestamp).toISOString().split('T')[0])).size;
  const lastEventDate = events.length > 0
    ? new Date(Math.max(...events.map(e => new Date(e.timestamp).getTime())))
    : null;

  const daysInactive = lastEventDate
    ? Math.floor((now - lastEventDate) / ONE_DAY_MS)
    : 30;

  // 2. Engagement Score (0 - 100)
  // Weightings: Active days in month (40%), Total events (30%), Completed lessons (30%)
  const activeDaysComponent = Math.min(100, (activeDays30d / 20) * 100);
  const eventsVolumeComponent = Math.min(100, (events30d.length / 50) * 100);
  const completedLessonsCount = progressLogs.reduce((acc, p) => acc + (p.completedLessons?.length || 0), 0);
  const completionComponent = Math.min(100, (completedLessonsCount / 15) * 100);

  const engagementScore = Math.round(
    (activeDaysComponent * 0.4) + (eventsVolumeComponent * 0.3) + (completionComponent * 0.3)
  );

  // 3. Consistency Score (0 - 100)
  // Based on regular distribution across 4 weeks in the 30-day window
  const activeDays7d = new Set(events7d.map(e => new Date(e.timestamp).toISOString().split('T')[0])).size;
  const consistencyScore = Math.round(Math.min(100, (activeDays7d / 5) * 100));

  // 4. Learning Momentum (0 - 100)
  // Ratio of 7-day activity vs prior 21-day average
  const eventsPrior21d = events30d.length - events7d.length;
  const expected7dVolume = eventsPrior21d / 3;
  let momentumRatio = expected7dVolume > 0 ? (events7d.length / expected7dVolume) : (events7d.length > 0 ? 1.5 : 0);
  const learningMomentum = Math.round(Math.min(100, Math.max(0, momentumRatio * 50)));

  const momentumReasons = [];
  if (events7d.length >= 10) {
    momentumReasons.push(`High recent study volume: ${events7d.length} learning events recorded in the last 7 days.`);
  } else if (events7d.length > 0) {
    momentumReasons.push(`Moderate learning activity: ${events7d.length} events logged this week.`);
  } else {
    momentumReasons.push('Zero study activity detected over the past 7 days.');
  }

  if (activeDays7d >= 4) {
    momentumReasons.push(`Consistent routine: Learner studied on ${activeDays7d} separate days this week.`);
  }

  // 5. Quiz Performance & Failed Attempts
  const recentQuizAttempts = [...quizAttempts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recent3Quizzes = recentQuizAttempts.slice(0, 3);
  const consecutiveFailures = recent3Quizzes.filter(q => q.isCorrect === false).length;

  const totalQuizCount = quizAttempts.length;
  const correctQuizCount = quizAttempts.filter(q => q.isCorrect === true).length;
  const quizAccuracy = totalQuizCount > 0 ? Math.round((correctQuizCount / totalQuizCount) * 100) : 75;

  // 6. Confidence Score (0 - 100)
  const totalSkillMastery = skills.length > 0
    ? skills.reduce((acc, s) => acc + (s.masteryScore || 0), 0) / skills.length
    : 60;
  const confidenceScore = Math.round((quizAccuracy * 0.5) + (totalSkillMastery * 0.5));

  // 7. Risk Level & Risk Reasons (LOW, MEDIUM, HIGH, CRITICAL)
  const riskReasons = [];
  let riskPoints = 0;

  if (daysInactive >= 14) {
    riskPoints += 40;
    riskReasons.push(`Inactivity: No study events logged for ${daysInactive} consecutive days.`);
  } else if (daysInactive >= 7) {
    riskPoints += 20;
    riskReasons.push(`Inactivity warning: No study activity for ${daysInactive} days.`);
  }

  if (consecutiveFailures >= 3) {
    riskPoints += 35;
    riskReasons.push(`Repeated assessment failures: Failed the last ${consecutiveFailures} quiz attempts.`);
  } else if (consecutiveFailures === 2) {
    riskPoints += 15;
    riskReasons.push('Assessment struggle: Failed 2 of the last 3 quiz questions.');
  }

  const averageProgress = progressLogs.length > 0
    ? progressLogs.reduce((acc, p) => acc + (p.progress || 0), 0) / progressLogs.length
    : 0;

  if (progressLogs.length > 0 && averageProgress < 35 && daysInactive >= 5) {
    riskPoints += 25;
    riskReasons.push(`Stagnant course progress: Average enrollment completion is stalled at ${Math.round(averageProgress)}%.`);
  }

  let riskLevel = 'LOW';
  if (riskPoints >= 60) riskLevel = 'CRITICAL';
  else if (riskPoints >= 40) riskLevel = 'HIGH';
  else if (riskPoints >= 20) riskLevel = 'MEDIUM';

  if (riskReasons.length === 0) {
    riskReasons.push('Learner is maintaining steady study frequency and acceptable quiz accuracy.');
  }

  // 8. Next Action & Recommendation Rationale
  let recommendedNextAction = 'Continue current module lessons';
  const recommendationRationale = {
    trigger: 'routine',
    evidence: []
  };

  if (weaknesses.length > 0) {
    const topWeakness = weaknesses[0];
    recommendedNextAction = `Practice concept remediation: ${topWeakness.topic}`;
    recommendationRationale.trigger = 'weakness_remediation';
    recommendationRationale.evidence.push(`Identified high-impact weakness in topic "${topWeakness.topic}".`);
  } else if (daysInactive >= 5) {
    recommendedNextAction = 'Resume stalled course module';
    recommendationRationale.trigger = 'reengagement';
    recommendationRationale.evidence.push(`Learner has been inactive for ${daysInactive} days.`);
  } else if (recentQuizAttempts.length > 0 && !recentQuizAttempts[0].isCorrect) {
    recommendedNextAction = `Retry quiz question on ${recentQuizAttempts[0].topic || 'recent topic'}`;
    recommendationRationale.trigger = 'failed_attempt';
    recommendationRationale.evidence.push('Most recent quiz attempt was incorrect.');
  } else {
    recommendationRationale.evidence.push('Learner progress is on track with current syllabus goals.');
  }

  return {
    engagementScore,
    consistencyScore,
    learningMomentum,
    confidenceScore,
    riskLevel,
    riskReasons,
    momentumReasons,
    recommendedNextAction,
    recommendationRationale,
    activeDays30d,
    daysInactive,
    quizAccuracy,
    completedLessonsCount
  };
}
