/**
 * EDOT Intelligence Domain - Goal Intelligence & Dynamic Learning Roadmap Calculator
 * Maps target goals to skill requirements, evaluates student skill gaps, constructs milestones,
 * and builds adaptable learning roadmaps with non-guarantee disclaimers.
 */

/**
 * Constructs a dynamic learning roadmap DTO based on goal and current student state.
 * 
 * @param {string} goalText 
 * @param {Array} userSkills 
 */
export function calculateDynamicRoadmap(goalText = 'Become a Frontend Developer', userSkills = []) {
  const goalLower = goalText.toLowerCase();

  let requiredSkills = ['HTML', 'CSS', 'JavaScript', 'React', 'Git'];
  let currentPosition = 'Beginner / Intermediate Frontend Learner';

  if (goalLower.includes('full-stack') || goalLower.includes('fullstack')) {
    requiredSkills = ['HTML', 'CSS', 'JavaScript', 'Node.js', 'Express', 'PostgreSQL', 'React', 'Docker'];
    currentPosition = 'Aspiring Full-Stack Software Engineer';
  } else if (goalLower.includes('math') || goalLower.includes('mathematics')) {
    requiredSkills = ['Algebra', 'Calculus', 'Linear Algebra', 'Statistics', 'Probability'];
    currentPosition = 'Academic Mathematics Scholar';
  } else if (goalLower.includes('portfolio')) {
    requiredSkills = ['UI Layouts', 'REST APIs', 'Frontend Frameworks', 'Testing', 'Deployment'];
    currentPosition = 'Portfolio & Project Builder';
  }

  const currentStrengths = [];
  const skillGaps = [];

  const userSkillMap = {};
  userSkills.forEach(s => {
    userSkillMap[s.name.toLowerCase()] = s.masteryScore || 0;
  });

  requiredSkills.forEach(reqSkill => {
    const score = userSkillMap[reqSkill.toLowerCase()] || (reqSkill === 'HTML' ? 85 : reqSkill === 'CSS' ? 75 : 45);
    if (score >= 70) {
      currentStrengths.push({ skill: reqSkill, masteryScore: score, status: 'VERIFIED_STRENGTH' });
    } else {
      skillGaps.push({ skill: reqSkill, currentMastery: score, targetMastery: 75, gapStatus: 'ACQUISITION_NEEDED' });
    }
  });

  const recommendedPath = [
    { step: 1, action: 'Complete core fundamentals module', focus: skillGaps[0]?.skill || 'JavaScript' },
    { step: 2, action: 'Build interactive practice project', focus: 'Application & Component Design' },
    { step: 3, action: 'Pass comprehensive assessment', focus: 'Mastery Verification' }
  ];

  const milestones = [
    { id: 'm-1', title: 'Fundamentals Mastery', completed: currentStrengths.length >= 2, targetDate: 'Week 2' },
    { id: 'm-2', title: 'Applied Project Portfolio', completed: false, targetDate: 'Week 4' },
    { id: 'm-3', title: 'Verifiable Skill Passport Hash Generation', completed: false, targetDate: 'Week 6' }
  ];

  const evidenceRequired = [
    'Pass 2 core module quizzes with score >= 75%',
    'Submit 1 reviewed project artifact',
    'Generate public Skill Passport hash proof'
  ];

  const disclaimer = 'Roadmap estimated based on current progress. Timelines and career outcomes are non-guaranteed.';

  return {
    currentPosition,
    goal: goalText,
    requiredSkills,
    currentStrengths,
    skillGaps,
    recommendedPath,
    milestones,
    evidenceRequired,
    disclaimer
  };
}
