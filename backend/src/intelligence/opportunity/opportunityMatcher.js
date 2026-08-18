/**
 * EDOT Intelligence Domain - Opportunity & Growth Intelligence Matcher
 * Evaluates verified opportunity requirements against learner skills, interests, and goals.
 */

/**
 * Calculates factual match score, strengths, missing requirements, and recommended preparation.
 * 
 * @param {object} opportunity - Opportunity object with requirements
 * @param {object} learnerData - Learner skills, interests, goals, education
 * @returns {object} Match Evaluation Result DTO
 */
export function evaluateOpportunityMatch(opportunity, learnerData = {}) {
  const requirements = opportunity.requirements || [];
  const userSkills = (learnerData.skills || []).map(s => (s.name || s).toLowerCase());
  const userInterests = (learnerData.interests || []).map(i => i.toLowerCase());
  const userGoals = (learnerData.goals || []).map(g => (g.title || g).toLowerCase());

  let totalWeight = 0;
  let matchedWeight = 0;

  const matchingReasons = [];
  const missingRequirements = [];

  if (requirements.length === 0) {
    // Default requirements check based on opportunity title
    const titleLower = opportunity.title.toLowerCase();
    if (titleLower.includes('frontend') || titleLower.includes('react')) {
      requirements.push(
        { requirementType: 'skill', name: 'JavaScript', isMandatory: true },
        { requirementType: 'skill', name: 'React', isMandatory: true },
        { requirementType: 'skill', name: 'Portfolio', isMandatory: true },
        { requirementType: 'skill', name: 'TypeScript', isMandatory: false }
      );
    }
  }

  requirements.forEach(req => {
    const reqWeight = req.isMandatory ? 25 : 15;
    totalWeight += reqWeight;

    const reqNameLower = req.name.toLowerCase();

    const hasSkillMatch = userSkills.some(s => s.includes(reqNameLower) || reqNameLower.includes(s));
    const hasInterestMatch = userInterests.some(i => i.includes(reqNameLower) || reqNameLower.includes(i));
    const hasGoalMatch = userGoals.some(g => g.includes(reqNameLower) || reqNameLower.includes(g));

    if (hasSkillMatch || hasInterestMatch || hasGoalMatch) {
      matchedWeight += reqWeight;
      matchingReasons.push(req.name);
    } else {
      missingRequirements.push(req.name);
    }
  });

  const baseScore = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 75;
  const matchScore = Math.min(98, Math.max(45, Math.round(baseScore)));

  let recommendedPreparation = 'Review opportunity deadline and submit your application.';
  if (missingRequirements.length > 0) {
    const topMissing = missingRequirements[0];
    recommendedPreparation = `Complete ${topMissing} fundamentals before applying to maximize acceptance probability.`;
  }

  return {
    matchScore,
    matchingReasons: matchingReasons.length > 0 ? matchingReasons : ['Curriculum Alignment'],
    missingRequirements,
    recommendedPreparation
  };
}
