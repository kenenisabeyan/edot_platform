/**
 * EDOT Intelligence Domain - Adaptive Learning Engine Calculator
 * Analyzes learner goals, quiz attempts, skill mastery, and weak topics
 * to construct non-destructive, explainable adaptive paths.
 */

/**
 * Calculates an adaptive learning plan, recommendations, and milestones.
 * 
 * @param {object} inputs 
 * @param {Array} inputs.goals
 * @param {Array} inputs.progressRecords
 * @param {Array} inputs.quizAttempts
 * @param {Array} inputs.skills
 * @param {Array} inputs.weaknesses
 * @param {object} inputs.profile
 * @returns {object} Calculated Adaptive Plan DTO
 */
export function calculateAdaptivePath({
  goals = [],
  progressRecords = [],
  quizAttempts = [],
  skills = [],
  weaknesses = [],
  profile = {}
}) {
  const totalQuizzes = quizAttempts.length;
  const correctQuizzes = quizAttempts.filter(q => q.isCorrect).length;
  const accuracyPercent = totalQuizzes > 0 ? Math.round((correctQuizzes / totalQuizzes) * 100) : 75;

  const weakTopicsList = weaknesses.map(w => w.topic);
  const strongSkillsList = skills.filter(s => s.proficiencyLevel === 'EXPERT' || s.proficiencyLevel === 'ADVANCED').map(s => s.name);

  // 1. Determine Plan Type & Pace Mode
  let planType = 'BALANCED';
  let paceMode = 'STANDARD';

  if (accuracyPercent >= 85 && weakTopicsList.length === 0) {
    planType = 'ACCELERATED';
    paceMode = 'ACCELERATED';
  } else if (accuracyPercent < 60 || weakTopicsList.length >= 2) {
    planType = 'REMEDIATION';
    paceMode = 'SLOW_PACED';
  }

  // 2. Build Explainable Summary
  let summaryExplanation = `Your adaptive plan is currently set to ${planType} mode based on an overall quiz accuracy of ${accuracyPercent}%.`;
  if (planType === 'ACCELERATED') {
    summaryExplanation = `High assessment performance (${accuracyPercent}%) detected! Recommending accelerated progression with optional advanced challenge modules.`;
  } else if (planType === 'REMEDIATION') {
    summaryExplanation = `Identified ${weakTopicsList.length} core focus topic(s) needing review. Recommending targeted revision exercises alongside your main course progression.`;
  }

  // 3. Generate Non-Destructive Adaptive Recommendations
  const recommendations = [];

  // A. Revision recommendations for weak topics (e.g. Student A: Weak in CSS)
  if (weakTopicsList.length > 0) {
    weakTopicsList.forEach(topic => {
      recommendations.push({
        category: 'REVISION',
        title: `Targeted Concept Review: ${topic}`,
        description: `Review fundamental concepts and attempt 5 practice questions on ${topic}.`,
        reason: `Your recent quiz score on "${topic}" indicated missed parameters or concept gaps.`,
        evidence: { topic, quizAccuracyPercent: accuracyPercent }
      });
      recommendations.push({
        category: 'PRACTICE',
        title: `Interactive Practice Exercise: ${topic}`,
        description: `Hands-on practice exercises to reinforce ${topic} mastery.`,
        reason: `Targeted practice builds lasting confidence before advancing to the next module.`,
        evidence: { topic }
      });
    });
  }

  // B. Advanced content recommendations for high performers (e.g. Student B: Strong HTML & CSS)
  if (planType === 'ACCELERATED' || strongSkillsList.length > 0) {
    const topSkill = strongSkillsList[0] || 'Core Module';
    recommendations.push({
      category: 'ADVANCED_CONTENT',
      title: `Advanced Masterclass Challenge: ${topSkill}`,
      description: `Unlock optional real-world portfolio project and advanced optimization techniques in ${topSkill}.`,
      reason: `Demonstrated strong proficiency in ${topSkill}. Accelerate your learning path with real-world application.`,
      evidence: { topSkill, accuracyPercent }
    });
  }

  // C. Suggested Lesson Sequence Recommendation (Non-Destructive)
  const activeCourse = progressRecords[0]?.course?.title || 'General Curriculum';
  recommendations.push({
    category: 'LESSON_SEQUENCE',
    title: `Optimal Learning Path: ${activeCourse}`,
    description: `Maintain current core sequence in ${activeCourse} while addressing recommended revision pills.`,
    reason: `Preserves mandatory curriculum integrity without skipping required educational content.`,
    evidence: { courseTitle: activeCourse }
  });

  // 4. Build Personalized Milestones
  const milestones = [
    {
      milestoneTitle: `Master ${weakTopicsList[0] || 'Current Core Module'}`,
      description: `Achieve 80%+ accuracy on ${weakTopicsList[0] || 'next module quiz'}`,
      progress: Math.min(100, Math.max(20, accuracyPercent))
    },
    {
      milestoneTitle: `Complete Active Enrollment Unit`,
      description: `Finish all video lessons and assignments in ${activeCourse}`,
      progress: Math.round(progressRecords[0]?.progress || 45)
    }
  ];

  const suggestedSequence = [
    { type: 'remediation', title: weakTopicsList[0] ? `Revision: ${weakTopicsList[0]}` : 'Core Review' },
    { type: 'core_lesson', title: `Resume ${activeCourse}` },
    { type: 'advanced_optional', title: 'Advanced Portfolio Challenge' }
  ];

  return {
    planType,
    paceMode,
    suggestedSequence,
    summaryExplanation,
    recommendations,
    milestones
  };
}
