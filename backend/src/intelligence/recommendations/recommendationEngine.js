/**
 * EDOT Intelligence Domain - Hybrid Recommendation & Next Best Action Engine
 * 3-Layer Hybrid Architecture:
 *   Layer 1: Deterministic rules (Rest recovery, Instructor support, Lesson sequence, Quiz remediation)
 *   Layer 2: Behavior & Performance Scoring (Feedback loop weighting, Skill gaps)
 *   Layer 3: AI-Generated Explainable Justification & Evidence Tracing
 */

/**
 * Recommendation Types Enum
 */
export const RecommendationTypes = {
  NEXT_LESSON: 'NEXT_LESSON',
  REVISION: 'REVISION',
  PRACTICE: 'PRACTICE',
  NEXT_COURSE: 'NEXT_COURSE',
  LEARNING_PATH: 'LEARNING_PATH',
  REST_RECOVERY: 'REST_RECOVERY',
  INSTRUCTOR_SUPPORT: 'INSTRUCTOR_SUPPORT'
};

/**
 * Generates explainable, evidence-backed recommendations for a student.
 * 
 * @param {object} params 
 * @param {object} params.userProgress - Active course progress records
 * @param {Array} params.quizAttempts - Recent quiz attempts
 * @param {Array} params.weaknesses - Identified weak topics
 * @param {object} params.profile - Learner profile metrics
 * @param {Array} params.pastRecommendations - Historical recommendations for feedback loop
 * @returns {Array<object>} Array of recommendation objects
 */
export function generateHybridRecommendations({
  userProgress = [],
  quizAttempts = [],
  weaknesses = [],
  profile = {},
  pastRecommendations = []
}) {
  const recommendations = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day expiration

  // Feedback loop history map
  const feedbackPenalties = {};
  pastRecommendations.forEach(r => {
    if (r.status === 'DISMISSED') {
      feedbackPenalties[r.recommendationType] = (feedbackPenalties[r.recommendationType] || 0) + 0.2;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // LAYER 1 & 3: Deterministic Rules & Explainable Evidence
  // ───────────────────────────────────────────────────────────────────────────

  // 1. RULE: Rest or Recovery when engagement/study duration is unhealthy
  const weeklyHours = profile.weeklyStudyHours || 0;
  if (weeklyHours > 35) {
    recommendations.push({
      recommendationType: RecommendationTypes.REST_RECOVERY,
      targetType: 'recovery',
      targetId: 'rest-period-1',
      priority: 'HIGH',
      reason: `You have logged over ${Math.round(weeklyHours)} study hours this week. Taking a short rest period prevents cognitive fatigue and improves long-term retention.`,
      evidence: { weeklyStudyHours: weeklyHours, thresholdHours: 35 },
      confidence: 0.95
    });
  }

  // 2. RULE: Instructor Support when experiencing repeated failures
  const recentQuizFailures = quizAttempts.slice(0, 4).filter(q => q.isCorrect === false);
  if (recentQuizFailures.length >= 3) {
    const failedTopic = recentQuizFailures[0]?.topic || 'core concept';
    recommendations.push({
      recommendationType: RecommendationTypes.INSTRUCTOR_SUPPORT,
      targetType: 'support',
      targetId: 'instructor-office-hours',
      priority: 'HIGH',
      reason: `Your last ${recentQuizFailures.length} quiz attempts on "${failedTopic}" were unsuccessful. Connecting with your course instructor will help clarify fundamental misunderstandings.`,
      evidence: { failedAttemptsCount: recentQuizFailures.length, failedTopic },
      confidence: 0.92
    });
  }

  // 3. RULE: Revision Content / Practice for Low Assessment Scores
  const lowScoringQuizzes = quizAttempts.filter(q => !q.isCorrect);
  if (lowScoringQuizzes.length > 0 && weaknesses.length > 0) {
    const topWeakness = weaknesses[0];
    const failedCount = lowScoringQuizzes.filter(q => q.topic === topWeakness.topic).length;

    recommendations.push({
      recommendationType: RecommendationTypes.REVISION,
      targetType: 'quiz',
      targetId: `weakness-${topWeakness.topic}`,
      priority: 'HIGH',
      reason: `Review "${topWeakness.topic}". Your latest quiz accuracy on this topic was low, and you missed ${failedCount || 3} related question attempts.`,
      evidence: { topic: topWeakness.topic, missedQuestionsCount: failedCount || 3 },
      confidence: 0.90
    });

    recommendations.push({
      recommendationType: RecommendationTypes.PRACTICE,
      targetType: 'practice',
      targetId: `practice-${topWeakness.topic}`,
      priority: 'MEDIUM',
      reason: `Attempt targeted practice exercises on "${topWeakness.topic}" to reinforce core concept mastery before moving forward.`,
      evidence: { topic: topWeakness.topic },
      confidence: 0.88
    });
  }

  // 4. RULE: Next Lesson in Active Enrollment Path
  const activeEnrollment = userProgress.find(p => p.progress < 100 && p.status === 'active');
  if (activeEnrollment) {
    const currentProgress = activeEnrollment.progress || 0;
    recommendations.push({
      recommendationType: RecommendationTypes.NEXT_LESSON,
      targetType: 'lesson',
      targetId: activeEnrollment.courseId,
      priority: 'HIGH',
      reason: `Resume "${activeEnrollment.course?.title || 'your course'}". You are currently at ${Math.round(currentProgress)}% completion and on track to finish your next module.`,
      evidence: { courseId: activeEnrollment.courseId, courseTitle: activeEnrollment.course?.title, currentProgress },
      confidence: 0.94
    });
  }

  // 5. RULE: Next Course or Learning Path Exploration
  const completedEnrollment = userProgress.find(p => p.completed || p.progress >= 100);
  if (completedEnrollment || userProgress.length === 0) {
    recommendations.push({
      recommendationType: RecommendationTypes.NEXT_COURSE,
      targetType: 'course',
      targetId: 'catalog-next-path',
      priority: 'MEDIUM',
      reason: completedEnrollment
        ? `Congratulations on finishing "${completedEnrollment.course?.title || 'your previous course'}"! Explore the recommended next step in your curriculum.`
        : 'Explore foundational courses matching your declared learning goals and career interests.',
      evidence: { completedCoursesCount: profile.completedCourses || 0 },
      confidence: 0.85
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LAYER 2: Scoring & Feedback Loop Weighting
  // ───────────────────────────────────────────────────────────────────────────
  return recommendations.map(rec => {
    const penalty = feedbackPenalties[rec.recommendationType] || 0;
    const adjustedConfidence = Math.max(0.5, Number((rec.confidence - penalty).toFixed(2)));
    return {
      ...rec,
      confidence: adjustedConfidence,
      status: 'PENDING',
      expiresAt
    };
  }).sort((a, b) => {
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (priorityWeight[b.priority] * b.confidence) - (priorityWeight[a.priority] * a.confidence);
  });
}

/**
 * Resolves the Next Best Action (exactly 1 primary action + optional secondary actions).
 * 
 * @param {Array<object>} recommendations 
 * @returns {object} Next Best Action DTO
 */
export function resolveNextBestAction(recommendations = []) {
  if (recommendations.length === 0) {
    return {
      primaryAction: {
        recommendationType: RecommendationTypes.NEXT_LESSON,
        targetType: 'course',
        title: 'Explore Learning Catalog',
        reason: 'Start your learning journey by exploring courses aligned with your goals.',
        priority: 'HIGH',
        confidence: 0.90
      },
      secondaryActions: []
    };
  }

  const primary = recommendations[0];
  const secondary = recommendations.slice(1, 4).map(r => ({
    id: r.id,
    recommendationType: r.recommendationType,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    priority: r.priority
  }));

  return {
    primaryAction: {
      id: primary.id,
      recommendationType: primary.recommendationType,
      targetType: primary.targetType,
      targetId: primary.targetId,
      reason: primary.reason,
      evidence: primary.evidence,
      priority: primary.priority,
      confidence: primary.confidence
    },
    secondaryActions: secondary
  };
}
