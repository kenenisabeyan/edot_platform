/**
 * EDOT Intelligence — Phase 12
 * Portfolio Readiness Service
 *
 * Evaluates what portfolio opportunities are available based on demonstrated
 * EDOT learning evidence.
 *
 * PRINCIPLE: Never fabricates portfolio projects.
 * Analyzes real evidence and suggests what the student COULD turn into
 * a portfolio project — but does NOT claim a project already exists.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Evaluates portfolio readiness and suggests portfolio opportunities.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function evaluatePortfolioReadiness(userId) {
  const [
    existingItems,
    verifiedSubmissions,
    learnerSkills,
    masteredConcepts,
    completedCourses
  ] = await Promise.all([
    prisma.portfolioItem.findMany({
      where: { userId },
      include: {
        submission: {
          include: { project: { select: { title: true, category: true } } }
        }
      }
    }),
    prisma.projectSubmission.findMany({
      where: { userId, isVerified: true },
      include: { project: { select: { title: true, category: true, requiredSkills: true } } }
    }),
    prisma.learnerSkill.findMany({
      where: { userId, masteryScore: { gte: 65 } },
      select: { name: true, masteryScore: true, proficiencyLevel: true }
    }),
    prisma.learnerConceptMastery.findMany({
      where: { userId, masteryState: { in: ['PROFICIENT', 'MASTERED'] } },
      include: { node: { select: { name: true, type: true, domain: true } } },
      take: 20
    }),
    prisma.userCourseProgress.findMany({
      where: { userId, completed: true },
      include: { course: { select: { title: true, mainCategory: true, tags: true } } }
    })
  ]);

  // ── Existing Portfolio ────────────────────────────────────────────────────

  const existingPortfolio = existingItems.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    demonstratedSkills: item.demonstratedSkills,
    verificationStatus: item.verificationStatus,
    projectTitle: item.submission?.project?.title || null
  }));

  // ── Portfolio Opportunities (Suggestions) ─────────────────────────────────

  const suggestions = [];

  // Suggest from strong skills
  for (const skill of learnerSkills.slice(0, 5)) {
    const alreadyPortfolioed = existingPortfolio.some(item =>
      Array.isArray(item.demonstratedSkills) &&
      item.demonstratedSkills.some(
        s => typeof s === 'string' && s.toLowerCase().includes(skill.name.toLowerCase())
      )
    );
    if (!alreadyPortfolioed) {
      suggestions.push({
        type: 'SKILL_BASED',
        skillName: skill.name,
        proficiencyLevel: skill.proficiencyLevel,
        suggestion: `Consider turning your demonstrated ${skill.name} evidence into a portfolio project. The AI Mentor can help you plan and reflect on what you've learned.`,
        canAIMentorHelp: true
      });
    }
  }

  // Suggest from mastered concepts
  const conceptSuggestions = masteredConcepts
    .filter(mc =>
      !suggestions.some(s => s.skillName?.toLowerCase() === mc.node?.name?.toLowerCase())
    )
    .slice(0, 3);

  for (const mc of conceptSuggestions) {
    suggestions.push({
      type: 'CONCEPT_BASED',
      conceptName: mc.node.name,
      conceptType: mc.node.type,
      suggestion: `Your mastery evidence for "${mc.node.name}" may support a portfolio project. The AI Mentor can help you understand how to demonstrate this concept practically.`,
      canAIMentorHelp: true
    });
  }

  // Suggest from completed courses
  for (const cp of completedCourses.slice(0, 3)) {
    const alreadyCovered = suggestions.some(s =>
      s.courseName?.toLowerCase() === cp.course.title.toLowerCase()
    );
    if (!alreadyCovered) {
      suggestions.push({
        type: 'COURSE_COMPLETION',
        courseName: cp.course.title,
        category: cp.course.mainCategory,
        suggestion: `Completing "${cp.course.title}" may provide background knowledge for a portfolio project in ${cp.course.mainCategory}.`,
        canAIMentorHelp: true
      });
    }
  }

  // ── Portfolio Readiness Level ─────────────────────────────────────────────

  let readinessLevel;
  if (existingItems.length >= 3 && verifiedSubmissions.length >= 1) {
    readinessLevel = 'PORTFOLIO_ACTIVE';
  } else if (existingItems.length >= 1 || verifiedSubmissions.length >= 1) {
    readinessLevel = 'PORTFOLIO_STARTED';
  } else if (learnerSkills.length >= 2 || masteredConcepts.length >= 3) {
    readinessLevel = 'EVIDENCE_AVAILABLE';
  } else {
    readinessLevel = 'EARLY_STAGE';
  }

  const levelDescriptions = {
    EARLY_STAGE: 'Continue building your learning evidence. Portfolio projects become meaningful once you have demonstrated skill evidence.',
    EVIDENCE_AVAILABLE: 'You have developing evidence that could support portfolio work. Consider exploring the AI Mentor for project ideas.',
    PORTFOLIO_STARTED: 'You have begun building your portfolio. Continue adding evidence and refining existing projects.',
    PORTFOLIO_ACTIVE: 'Your portfolio shows active development. Consider refining and documenting your work.'
  };

  return {
    userId,
    readinessLevel,
    readinessDescription: levelDescriptions[readinessLevel],
    existingPortfolio,
    portfolioCount: existingItems.length,
    verifiedProjectCount: verifiedSubmissions.length,
    suggestions: suggestions.slice(0, 6),
    generatedAt: new Date(),
    disclaimer:
      'Portfolio suggestions are based on your EDOT learning evidence. ' +
      'EDOT does not fabricate portfolio projects or claim projects exist without submission. ' +
      'The AI Mentor can help you plan and reflect, but project creation is your own work.'
  };
}
