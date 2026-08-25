/**
 * EDOT Intelligence — Phase 12
 * Opportunity Readiness Service
 *
 * Evaluates a student's readiness to explore opportunities (internships,
 * scholarships, mentorships, competitions, etc.) based on EDOT internal
 * learning evidence only.
 *
 * IMPORTANT:
 *   "READY_TO_EXPLORE" does NOT mean guaranteed eligibility or qualification.
 *   It means EDOT has enough internal evidence to suggest the student may
 *   benefit from exploring relevant opportunities.
 *
 * Readiness Categories:
 *   EARLY_EXPLORATION   — very limited learning evidence
 *   DEVELOPING          — growing evidence across some areas
 *   BUILDING_EVIDENCE   — solid evidence in several areas
 *   READY_TO_EXPLORE    — broad evidence suggesting active exploration is worthwhile
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Evaluates opportunity readiness for a student.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function evaluateOpportunityReadiness(userId) {
  // ── 1. Course Readiness ───────────────────────────────────────────────────

  const [enrollments, completedCourses, learnerProfile] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: userId, status: 'active' },
      select: { courseId: true }
    }),
    prisma.userCourseProgress.findMany({
      where: { userId, completed: true },
      select: { courseId: true }
    }),
    prisma.learnerProfile.findUnique({
      where: { userId },
      select: { completedCourses: true, completedLessons: true, quizAverage: true }
    })
  ]);

  const enrolledCount = enrollments.length;
  const completedCount = completedCourses.length;

  // ── 2. Skill Evidence ─────────────────────────────────────────────────────

  const learnerSkills = await prisma.learnerSkill.findMany({
    where: { userId },
    select: { masteryScore: true, masteryState: true, proficiencyLevel: true }
  });

  const verifiedSkills = learnerSkills.filter(s => s.masteryScore >= 70).length;
  const totalSkills = learnerSkills.length;

  // ── 3. Portfolio Readiness ────────────────────────────────────────────────

  const portfolioItems = await prisma.portfolioItem.count({
    where: { userId }
  });

  const projectSubmissions = await prisma.projectSubmission.count({
    where: { userId, isVerified: true }
  });

  // ── 4. Learning Progress ──────────────────────────────────────────────────

  const recentEvents = await prisma.learningEvent.count({
    where: {
      userId,
      timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }
  });

  const masteredConcepts = await prisma.learnerConceptMastery.count({
    where: {
      userId,
      masteryState: { in: ['PROFICIENT', 'MASTERED'] }
    }
  });

  // ── 5. Readiness Score Components ────────────────────────────────────────

  const courseReadinessScore = Math.min(
    100,
    (enrolledCount * 10) + (completedCount * 20)
  );

  const skillEvidenceScore = Math.min(
    100,
    (totalSkills * 5) + (verifiedSkills * 15)
  );

  const portfolioScore = Math.min(
    100,
    (portfolioItems * 20) + (projectSubmissions * 30)
  );

  const learningProgressScore = Math.min(
    100,
    (recentEvents > 0 ? 30 : 0) + (masteredConcepts * 10)
  );

  const overallScore =
    (courseReadinessScore * 0.3) +
    (skillEvidenceScore * 0.4) +
    (portfolioScore * 0.15) +
    (learningProgressScore * 0.15);

  // ── 6. Readiness Category ─────────────────────────────────────────────────

  let readinessCategory;
  if (overallScore >= 70) {
    readinessCategory = 'READY_TO_EXPLORE';
  } else if (overallScore >= 45) {
    readinessCategory = 'BUILDING_EVIDENCE';
  } else if (overallScore >= 20) {
    readinessCategory = 'DEVELOPING';
  } else {
    readinessCategory = 'EARLY_EXPLORATION';
  }

  const categoryDescriptions = {
    EARLY_EXPLORATION:
      'Based on your current learning evidence, you are in the early stages of building your profile. Continue learning to develop your evidence base.',
    DEVELOPING:
      'Your current profile shows growing learning evidence. As you complete more courses and assessments, your readiness profile will strengthen.',
    BUILDING_EVIDENCE:
      'Your current profile shows solid learning evidence in several areas. You may want to explore opportunities that align with your current skill development.',
    READY_TO_EXPLORE:
      'Based on your current EDOT learning evidence, your profile suggests you may benefit from actively exploring relevant opportunities. This does not guarantee eligibility — individual opportunity requirements vary.'
  };

  // ── 7. Evidence Breakdown ─────────────────────────────────────────────────

  const strengths = [];
  const gaps = [];

  if (completedCount >= 1) strengths.push(`${completedCount} completed course(s)`);
  if (verifiedSkills >= 1) strengths.push(`${verifiedSkills} skill(s) with verified evidence`);
  if (portfolioItems >= 1) strengths.push(`${portfolioItems} portfolio item(s)`);
  if (masteredConcepts >= 1) strengths.push(`${masteredConcepts} mastered concept(s)`);
  if (recentEvents > 0) strengths.push('Active learning engagement in the last 30 days');

  if (completedCount === 0) gaps.push('No completed courses yet');
  if (verifiedSkills === 0) gaps.push('No verified skill evidence yet');
  if (portfolioItems === 0) gaps.push('No portfolio items yet');

  return {
    userId,
    readinessCategory,
    readinessCategoryDescription: categoryDescriptions[readinessCategory],
    evidence: {
      courseReadiness: {
        enrolledCourses: enrolledCount,
        completedCourses: completedCount,
        label: courseReadinessScore >= 60 ? 'Developing' : 'Early'
      },
      skillEvidence: {
        totalSkills,
        verifiedSkills,
        label: skillEvidenceScore >= 60 ? 'Developing' : 'Early'
      },
      portfolioReadiness: {
        portfolioItems,
        verifiedProjects: projectSubmissions,
        label: portfolioScore >= 40 ? 'Building' : 'Early'
      },
      learningProgress: {
        recentLearningEvents: recentEvents,
        masteredConcepts,
        label: learningProgressScore >= 40 ? 'Active' : 'Limited'
      }
    },
    strengths,
    gaps,
    generatedAt: new Date(),
    disclaimer:
      '"READY_TO_EXPLORE" means EDOT has enough internal evidence to suggest exploring opportunities. ' +
      'It does NOT guarantee eligibility for any specific opportunity. ' +
      'Individual opportunity requirements vary and are determined by opportunity providers.'
  };
}

/**
 * Returns available opportunities filtered by readiness category.
 *
 * @param {string} userId
 * @param {string} readinessCategory
 */
export async function getOpportunitiesForReadiness(userId, readinessCategory) {
  // Only suggest opportunities for students who are at least DEVELOPING
  if (readinessCategory === 'EARLY_EXPLORATION') {
    return {
      opportunities: [],
      message:
        'Continue building your learning evidence before exploring specific opportunities. ' +
        'Focus on completing courses and assessments first.'
    };
  }

  const opportunities = await prisma.opportunity.findMany({
    where: { status: 'active' },
    include: {
      requirements: { select: { requirementType: true, name: true } }
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  return {
    opportunities: opportunities.map(opp => ({
      id: opp.id,
      title: opp.title,
      type: opp.type,
      organization: opp.organization,
      description: opp.description,
      deadline: opp.deadline,
      applyUrl: opp.applyUrl,
      requirements: opp.requirements
    })),
    readinessCategory,
    disclaimer:
      'These opportunities are shown based on your general readiness category. ' +
      'Eligibility for each opportunity depends on its specific requirements and provider criteria.'
  };
}
