/**
 * recommendationEngineService.js
 *
 * Wave 1 upgrade: Real course matching from the database.
 * Previously used hardcoded candidate course names — replaced with actual
 * prisma.Course lookup that filters by tag/category intersection with the
 * learner's interests, goals, and detected weaknesses.
 *
 * The buildRecommendationBundle() signature is unchanged for full
 * backward-compatibility. A second function buildLiveRecommendationBundle()
 * takes an additional `allCourses` param (passed from the route after a
 * DB lookup) to produce real course recommendations.
 */

// ─── Legacy static scoring (kept for backward-compat) ────────────────────────

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

// ─── Wave 1: Real course scoring ─────────────────────────────────────────────

/**
 * Score a real Course record against the learner context.
 *
 * @param {Object} course  Prisma Course with tags[], mainCategory, subCategory
 * @param {Object} context Learner context (goals, interests, strengths, weaknesses, etc.)
 * @returns {{ score: number, reason: string }}
 */
function scoreCourse(course, context) {
  const courseTags = (course.tags || []).map((t) => t.toLowerCase());
  const courseCategory = (course.mainCategory || '').toLowerCase();
  const courseTitle = (course.title || '').toLowerCase();

  const goals = (context.goals || []).map((g) => g.toLowerCase());
  const interests = (context.interests || []).map((i) => i.toLowerCase());
  const weaknesses = (context.weaknesses || []).map((w) => w.toLowerCase());
  const strengths = (context.strengths || []).map((s) => s.toLowerCase());

  let score = 40; // baseline relevance

  // Tag intersection
  const tagMatchCount = courseTags.filter(
    (tag) => interests.some((i) => i.includes(tag) || tag.includes(i)) ||
              goals.some((g) => g.includes(tag) || tag.includes(g))
  ).length;
  score += tagMatchCount * 12;

  // Category match
  if (interests.some((i) => i.includes(courseCategory) || courseCategory.includes(i))) {
    score += 15;
  }

  // Weakness match — prioritise courses that address weak areas
  if (weaknesses.some((w) => courseTitle.includes(w) || courseTags.some((t) => t.includes(w)))) {
    score += 20;
  }

  // Strength match — reinforce strengths
  if (strengths.some((s) => courseTitle.includes(s) || courseTags.some((t) => t.includes(s)))) {
    score += 10;
  }

  // Progress signals (learner already has momentum in this area)
  const progressSignals = (context.progressSignals || []).map((p) =>
    (p.category || '').toLowerCase()
  );
  if (progressSignals.some((p) => p.includes(courseCategory) || courseCategory.includes(p))) {
    score += 8;
  }

  // Experience signals
  score += Math.min(15, (context.completedCourses || 0) * 3);
  score += Math.min(10, Math.round((context.quizAverage || 0) / 10));

  const topTag = courseTags[0] || course.mainCategory;
  const reason = tagMatchCount > 0
    ? `${course.title} aligns with your ${topTag} interest and current learning goals.`
    : `${course.title} can strengthen your ${course.mainCategory} foundation.`;

  return { score: Math.min(100, score), reason };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a recommendation bundle from REAL course data.
 *
 * @param {Object}   context           Learner context
 * @param {Object[]} allCourses        Array of published Course records from Prisma
 * @param {string[]} enrolledCourseIds Course IDs the learner is already enrolled in
 * @returns {Object} Recommendation bundle
 */
export function buildLiveRecommendationBundle(context = {}, allCourses = [], enrolledCourseIds = []) {
  const goals = context.goals || [];
  const interests = context.interests || [];
  const strengths = context.strengths || [];
  const weaknesses = context.weaknesses || [];
  const quizAverage = Number(context.quizAverage || 0);
  const completedCourses = Number(context.completedCourses || 0);
  const progressSignals = context.progressSignals || [];
  const feedback = context.feedback || [];

  // Filter out already-enrolled courses
  const unenrolledCourses = allCourses.filter((c) => !enrolledCourseIds.includes(c.id));

  // Score and rank all unenrolled published courses
  const scoredCourses = unenrolledCourses
    .map((course) => {
      const { score, reason } = scoreCourse(course, {
        goals, interests, strengths, weaknesses, quizAverage, completedCourses, progressSignals
      });
      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        mainCategory: course.mainCategory,
        level: course.level,
        thumbnail: course.thumbnail,
        rating: course.rating,
        totalStudents: course.totalStudents,
        tags: course.tags || [],
        instructor: course.instructor?.name || 'EDOT Instructor',
        score,
        reason,
        tags: course.tags || [course.mainCategory]
      };
    })
    .sort((a, b) => b.score - a.score);

  const topCourses = scoredCourses.slice(0, 6);

  // Derive learning paths from top categories
  const topCategories = [...new Set(topCourses.map((c) => c.mainCategory))].slice(0, 2);
  const learningPaths = topCategories.map((cat) => ({
    title: `${cat} Learning Path`,
    description: `A curated journey through ${cat} courses matching your profile and goals.`,
    steps: scoredCourses
      .filter((c) => c.mainCategory === cat)
      .slice(0, 4)
      .map((c) => c.title),
    score: Math.round(scoredCourses.find((c) => c.mainCategory === cat)?.score || 70)
  }));

  // Skill recommendations derived from weakness areas
  const skillRecommendations = weaknesses.slice(0, 4).map((w) => ({
    name: w,
    reason: `You have a detected weakness in ${w}. Focused practice will improve your mastery score.`,
    tags: [w],
    score: 80
  }));

  // Project suggestions from top-scoring full-stack or portfolio courses
  const projects = scoredCourses
    .filter((c) => c.tags.some((t) =>
      ['portfolio', 'project', 'full stack', 'capstone'].some((kw) => t.toLowerCase().includes(kw))
    ))
    .slice(0, 2)
    .map((c) => ({
      name: c.title,
      description: c.reason,
      score: c.score,
      fit: c.score >= 75 ? 'High' : 'Medium'
    }));

  return {
    courses: topCourses,
    skills: skillRecommendations,
    learningPaths,
    projects,
    metadata: {
      confidence: Math.min(100, 60 + completedCourses * 4 + Math.round(quizAverage / 10)),
      totalCandidates: unenrolledCourses.length,
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
}

/**
 * Legacy compatibility wrapper — used by any caller that doesn't pass real courses.
 * Kept intact so existing callers don't break.
 */
export function buildRecommendationBundle(context = {}) {
  const goals = context.goals || [];
  const interests = context.interests || [];
  const strengths = context.strengths || [];
  const weaknesses = context.weaknesses || [];
  const quizAverage = Number(context.quizAverage || 0);
  const completedCourses = Number(context.completedCourses || 0);
  const progressSignals = context.progressSignals || [];
  const feedback = context.feedback || [];

  const candidateSkills = ['React', 'Backend Development', 'Full Stack Project', 'Node.js', 'Database Design', 'UI/UX'];

  const skills = candidateSkills
    .map((name) => ({
      name,
      score: scoreSkill(name, { goals, interests, strengths, weaknesses, quizAverage, completedCourses }),
      reason: `${name} aligns with your current progress and interests.`,
      tags: COURSE_TAGS[name] || ['Learning']
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return {
    courses: skills.map((skill) => ({
      title: `${skill.name} Course`,
      reason: skill.reason,
      tags: skill.tags,
      score: skill.score
    })),
    skills,
    learningPaths: [],
    projects: [],
    metadata: {
      confidence: Math.min(100, 70 + completedCourses * 4 + Math.round(quizAverage / 10)),
      signals: { goals, interests, strengths, weaknesses, progressSignals, feedback }
    }
  };
}

export default { buildRecommendationBundle, buildLiveRecommendationBundle };
