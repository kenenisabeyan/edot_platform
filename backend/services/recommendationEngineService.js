const COURSE_TAGS = {
  'HTML': ['Web Development', 'Frontend'],
  'CSS': ['Web Development', 'Frontend'],
  'JavaScript': ['Web Development', 'Frontend'],
  'React': ['Frontend', 'Modern UI'],
  'Backend Development': ['Backend', 'APIs'],
  'Full Stack Project': ['Portfolio', 'Full Stack'],
  'Node.js': ['Backend', 'APIs'],
  'Database Design': ['Backend', 'Data'],
  'UI/UX': ['Design', 'Frontend']
};

function scoreSkill(skillName, context) {
  const normalized = skillName.toLowerCase();
  const hasGoal = context.goals.some((goal) => goal.toLowerCase().includes(normalized));
  const hasInterest = context.interests.some((interest) => interest.toLowerCase().includes(normalized));
  const hasStrength = context.strengths.some((strength) => strength.toLowerCase().includes(normalized));
  const hasWeakness = context.weaknesses.some((weakness) => weakness.toLowerCase().includes(normalized));

  let score = 40;
  if (hasGoal) score += 25;
  if (hasInterest) score += 20;
  if (hasStrength) score += 10;
  if (hasWeakness) score += 20;

  score += Math.min(15, context.completedCourses * 3);
  score += Math.min(10, Math.round(context.quizAverage / 10));

  return score;
}

export function buildRecommendationBundle(context = {}) {
  const goals = context.goals || [];
  const interests = context.interests || [];
  const strengths = context.strengths || [];
  const weaknesses = context.weaknesses || [];
  const quizAverage = Number(context.quizAverage || 0);
  const completedCourses = Number(context.completedCourses || 0);
  const progressSignals = context.progressSignals || [];
  const feedback = context.feedback || [];

  const candidateSkills = [
    'React',
    'Backend Development',
    'Full Stack Project',
    'Node.js',
    'Database Design',
    'UI/UX'
  ];

  const skills = candidateSkills
    .map((name) => ({
      name,
      score: scoreSkill(name, { ...context, goals, interests, strengths, weaknesses, quizAverage, completedCourses }),
      reason: `${name} aligns with your current progress and interests.`,
      tags: COURSE_TAGS[name] || ['Learning']
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const projects = [
    {
      name: 'Full Stack Portfolio Project',
      description: 'Build a complete product using your strongest frontend and backend foundations.',
      score: 88,
      fit: 'High'
    },
    {
      name: 'React UI Challenge',
      description: 'Create a polished interface and deepen your component design practice.',
      score: 76,
      fit: 'Medium'
    }
  ];

  const learningPaths = [
    {
      title: 'Full Stack Developer Path',
      description: 'Move from frontend fundamentals to backend delivery and ship a portfolio-ready project.',
      steps: ['React', 'Node.js', 'Database Design', 'Full Stack Project'],
      score: 90
    },
    {
      title: 'Frontend Specialist Path',
      description: 'Deepen UI craft and component engineering with modern tools.',
      steps: ['React', 'UI/UX', 'Full Stack Project'],
      score: 72
    }
  ];

  const recommendations = {
    courses: skills.map((skill) => ({
      title: `${skill.name} Course`,
      reason: skill.reason,
      tags: skill.tags,
      score: skill.score
    })),
    lessons: skills.map((skill) => ({
      title: `${skill.name} lesson sequence`,
      reason: `Practice ${skill.name} through focused lessons.`,
      score: skill.score - 3
    })),
    skills,
    projects,
    learningPaths,
    metadata: {
      confidence: Math.min(100, 70 + completedCourses * 4 + Math.round(quizAverage / 10)),
      signals: {
        goals,
        interests,
        strengths,
        weaknesses,
        progressSignals: progressSignals.slice(0, 3),
        feedback
      }
    }
  };

  return recommendations;
}

export default {
  buildRecommendationBundle
};
