/**
 * EDOT Intelligence — Phase 12
 * Career Intelligence Service — Master Orchestrator
 *
 * Central coordination layer for all Phase 12 intelligence:
 *   - Career exploration (interest-based + evidence-based recommendations)
 *   - Skill profile retrieval
 *   - Skill gap analysis
 *   - Career readiness assessment
 *   - Development roadmap generation
 *   - Opportunity readiness
 *   - Portfolio readiness
 *   - Career interest & goal lifecycle management
 *   - Instructor aggregate skill insights
 *   - Admin institutional skill intelligence
 *
 * All operations are evidence-based. The system provides GUIDANCE only.
 * It does NOT make deterministic life decisions.
 */

import { prisma } from '../../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { getStudentSkillProfile, getStudentSkillDetail } from './skillProfileService.js';
import { analyzeSkillGap } from './skillGapService.js';
import { computeCareerReadiness } from './careerReadinessService.js';
import { buildCareerRoadmap } from './developmentRoadmapService.js';
import { evaluateOpportunityReadiness, getOpportunitiesForReadiness } from './opportunityReadinessService.js';
import { evaluatePortfolioReadiness } from './portfolioReadinessService.js';
import { resolveCareerPath, assertValidUUID } from './careerAuthorizationService.js';

// ── Career Path Management ─────────────────────────────────────────────────────

/**
 * Returns all active career paths.
 */
export async function getCareerPaths() {
  return prisma.careerPath.findMany({
    where: { status: { not: 'ARCHIVED' } },
    include: { skillRequirements: true },
    orderBy: { title: 'asc' }
  });
}

/**
 * Creates a new dynamic career path without requiring code changes.
 *
 * @param {object} data
 */
export async function createCareerPath(data) {
  const { title, category, description, industry, requiredSkillNames = [], demandLevel = 'HIGH' } = data;

  if (!title || !category || !description) {
    throw new ValidationError('title, category, and description are required');
  }

  const normalizedName = title.toLowerCase().trim().replace(/\s+/g, '-');

  // Prevent duplicate
  const existing = await prisma.careerPath.findFirst({
    where: {
      OR: [
        { title: { equals: title, mode: 'insensitive' } },
        { normalizedName }
      ]
    }
  });
  if (existing) {
    throw new ValidationError(`A career path with the title "${title}" already exists.`);
  }

  const careerPath = await prisma.careerPath.create({
    data: {
      title,
      normalizedName,
      category,
      description,
      industry: industry || category,
      requiredSkills: requiredSkillNames.map(name => ({ name })), // backward compat JSON
      demandLevel,
      status: 'ACTIVE'
    }
  });

  // Create relational skill requirements
  if (requiredSkillNames.length > 0) {
    const skillRequirements = requiredSkillNames.map((name, idx) => ({
      careerPathId: careerPath.id,
      skillName: name,
      importance: idx === 0 ? 'FOUNDATIONAL' : 'IMPORTANT'
    }));
    await prisma.careerPathSkillRequirement.createMany({ data: skillRequirements });
  }

  return prisma.careerPath.findUnique({
    where: { id: careerPath.id },
    include: { skillRequirements: true }
  });
}

// ── Skill Profile ─────────────────────────────────────────────────────────────

export { getStudentSkillProfile, getStudentSkillDetail };

// ── Career Interest Management ────────────────────────────────────────────────

/**
 * Records or updates a student's career interest.
 *
 * @param {string} userId
 * @param {object} data — { interestText, careerPathId?, source? }
 */
export async function addCareerInterest(userId, data) {
  const { interestText, careerPathId, source = 'EXPLICIT' } = data;

  if (!interestText || typeof interestText !== 'string') {
    throw new ValidationError('interestText is required');
  }

  // Check for existing active interest with same text
  const existing = await prisma.learnerCareerInterest.findFirst({
    where: {
      userId,
      interestText: { equals: interestText, mode: 'insensitive' },
      status: 'ACTIVE'
    }
  });

  if (existing) {
    return existing; // Idempotent — don't duplicate
  }

  return prisma.learnerCareerInterest.create({
    data: {
      userId,
      interestText,
      careerPathId: careerPathId || null,
      source
    }
  });
}

/**
 * Returns all career interests for a student.
 */
export async function getCareerInterests(userId) {
  return prisma.learnerCareerInterest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Updates a career interest status (ACTIVE → PAUSED → ARCHIVED).
 *
 * @param {string} userId
 * @param {string} interestId
 * @param {object} updates — { status }
 */
export async function updateCareerInterest(userId, interestId, updates) {
  assertValidUUID(interestId, 'interestId');

  const interest = await prisma.learnerCareerInterest.findFirst({
    where: { id: interestId, userId }
  });
  if (!interest) {
    throw new NotFoundError(`Career interest [${interestId}] not found`);
  }

  const allowedStatuses = ['ACTIVE', 'PAUSED', 'ARCHIVED'];
  if (updates.status && !allowedStatuses.includes(updates.status)) {
    throw new ValidationError(`status must be one of: ${allowedStatuses.join(', ')}`);
  }

  return prisma.learnerCareerInterest.update({
    where: { id: interestId },
    data: { status: updates.status }
  });
}

// ── Career Goal Management ────────────────────────────────────────────────────

/**
 * Creates a career goal for a student.
 *
 * @param {string} userId
 * @param {object} data — { title, type, careerPathId?, targetDate?, notes? }
 */
export async function createCareerGoal(userId, data) {
  const { title, type = 'EXPLORE', careerPathId, targetDate, notes } = data;

  if (!title) {
    throw new ValidationError('title is required');
  }

  const allowedTypes = ['EXPLORE', 'DEVELOP', 'PREPARE'];
  if (!allowedTypes.includes(type)) {
    throw new ValidationError(`type must be one of: ${allowedTypes.join(', ')}`);
  }

  return prisma.careerGoal.create({
    data: {
      userId,
      title,
      type,
      careerPathId: careerPathId || null,
      targetDate: targetDate ? new Date(targetDate) : null,
      notes: notes || null
    }
  });
}

/**
 * Updates a career goal.
 *
 * @param {string} userId
 * @param {string} goalId
 * @param {object} updates — { title?, type?, status?, targetDate?, notes? }
 */
export async function updateCareerGoal(userId, goalId, updates) {
  assertValidUUID(goalId, 'goalId');

  const goal = await prisma.careerGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) {
    throw new NotFoundError(`Career goal [${goalId}] not found`);
  }

  const allowedStatuses = ['ACTIVE', 'PAUSED', 'ARCHIVED'];
  if (updates.status && !allowedStatuses.includes(updates.status)) {
    throw new ValidationError(`status must be one of: ${allowedStatuses.join(', ')}`);
  }

  return prisma.careerGoal.update({
    where: { id: goalId },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.type && { type: updates.type }),
      ...(updates.status && { status: updates.status }),
      ...(updates.targetDate && { targetDate: new Date(updates.targetDate) }),
      ...(updates.notes !== undefined && { notes: updates.notes })
    }
  });
}

/**
 * Returns all career goals for a student.
 */
export async function getCareerGoals(userId) {
  return prisma.careerGoal.findMany({
    where: { userId },
    include: { careerPath: { select: { id: true, title: true, category: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

// ── Career Exploration ────────────────────────────────────────────────────────

/**
 * Generates evidence-based career exploration recommendations.
 *
 * Every recommendation is explainable — WHY it is suggested, WHAT evidence
 * supports it, WHAT gaps exist, and WHAT next steps are suggested.
 *
 * @param {string} userId
 */
export async function exploreCareerPaths(userId) {
  // 1. Get student interests
  const interests = await prisma.learnerCareerInterest.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });

  // 2. Get skill profile summary
  const skillProfile = await getStudentSkillProfile(userId);

  // 3. Find all active career paths
  const careerPaths = await prisma.careerPath.findMany({
    where: { status: { not: 'ARCHIVED' } },
    include: { skillRequirements: true }
  });

  if (careerPaths.length === 0) {
    return {
      recommendations: [],
      message:
        'No career paths are currently defined in EDOT. ' +
        'Ask your administrator to add career paths for exploration.',
      disclaimer: EXPLORATION_DISCLAIMER
    };
  }

  const recommendations = [];

  // 4. Score paths based on skill alignment + explicit interests
  for (const path of careerPaths) {
    // Interest match
    const interestMatch = interests.some(
      i =>
        i.interestText.toLowerCase().includes(path.title.toLowerCase()) ||
        i.interestText.toLowerCase().includes(path.category.toLowerCase()) ||
        path.title.toLowerCase().includes(i.interestText.toLowerCase()) ||
        (i.careerPathId && i.careerPathId === path.id)
    );

    // Skill alignment (count skills the student has DEVELOPING or better)
    const requiredSkillNames = buildRequiredNames(path);
    let alignedCount = 0;
    const alignedSkills = [];

    for (const skillName of requiredSkillNames) {
      const studentSkill = skillProfile.skills.find(
        s => s.name.toLowerCase().includes(skillName.toLowerCase())
      );
      if (
        studentSkill &&
        ['DEVELOPING', 'DEMONSTRATING', 'STRONG_EVIDENCE'].includes(
          studentSkill.evidenceState
        )
      ) {
        alignedCount++;
        alignedSkills.push(studentSkill.name);
      }
    }

    const relevanceScore =
      (interestMatch ? 40 : 0) +
      (requiredSkillNames.length > 0
        ? Math.round((alignedCount / requiredSkillNames.length) * 60)
        : 0);

    // Build WHY explanation
    const whyReasons = [];
    if (interestMatch) {
      whyReasons.push(
        `This path aligns with your expressed interest in "${interests.find(i => i.interestText.toLowerCase().includes(path.category.toLowerCase()))?.interestText || path.category}"`
      );
    }
    if (alignedSkills.length > 0) {
      whyReasons.push(
        `You are developing evidence in ${alignedSkills.slice(0, 3).join(', ')} — skills relevant to this path`
      );
    }
    if (whyReasons.length === 0) {
      whyReasons.push(
        `This path is available in the EDOT career catalog for your exploration`
      );
    }

    const gapCount =
      requiredSkillNames.length - alignedCount;

    recommendations.push({
      careerPathId: path.id,
      title: path.title,
      category: path.category,
      industry: path.industry,
      description: path.description,
      demandLevel: path.demandLevel,
      relevanceScore,
      whyRecommended: whyReasons.join('. ') + '.',
      evidence: {
        alignedSkillCount: alignedCount,
        alignedSkills,
        totalRequiredSkills: requiredSkillNames.length
      },
      currentGaps: {
        gapCount,
        note:
          gapCount > 0
            ? `You may want to explore ${gapCount} skill area(s) to develop stronger evidence for this path.`
            : 'Your current evidence covers the required skill areas for this path.'
      },
      suggestedNextSteps: [
        alignedSkills.length === 0
          ? 'Start by exploring courses in this domain to build initial evidence.'
          : `Continue developing your evidence in ${alignedSkills[0]} and explore related areas.`,
        'Use the Career Explorer to see your full skill gap analysis for this path.'
      ]
    });
  }

  // Sort by relevance score
  recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    recommendations,
    totalPaths: careerPaths.length,
    studentSkillSummary: skillProfile.summary,
    activeInterests: interests.map(i => i.interestText),
    disclaimer: EXPLORATION_DISCLAIMER
  };
}

// ── Full Career Intelligence (Single Path) ────────────────────────────────────

export { analyzeSkillGap, computeCareerReadiness, buildCareerRoadmap };

/**
 * Returns complete career intelligence for a student and a specific path.
 * Includes: gap analysis + readiness + roadmap in one call.
 *
 * @param {string} userId
 * @param {string} careerPathId
 */
export async function getCareerIntelligence(userId, careerPathId) {
  const careerPath = await resolveCareerPath(careerPathId);

  const [gapAnalysis, readiness, roadmap] = await Promise.all([
    analyzeSkillGap(userId, careerPath),
    computeCareerReadiness(userId, careerPath),
    buildCareerRoadmap(userId, careerPath)
  ]);

  return {
    careerPath: {
      id: careerPath.id,
      title: careerPath.title,
      category: careerPath.category,
      industry: careerPath.industry,
      description: careerPath.description,
      demandLevel: careerPath.demandLevel
    },
    gapAnalysis,
    readiness,
    roadmap,
    generatedAt: new Date()
  };
}

// ── Opportunity & Portfolio ───────────────────────────────────────────────────

export { evaluateOpportunityReadiness, getOpportunitiesForReadiness, evaluatePortfolioReadiness };

// ── Instructor Insights ───────────────────────────────────────────────────────

/**
 * Returns aggregate skill development insights for an instructor's course.
 * Individual student data is aggregated — no individual ranking or shaming.
 *
 * @param {string} instructorId
 * @param {string} courseId
 */
export async function getInstructorSkillInsights(instructorId, courseId) {
  const skillMappings = await prisma.courseSkillMapping.findMany({
    where: { courseId },
    include: { skill: { select: { id: true, name: true, domain: true } } }
  });

  if (skillMappings.length === 0) {
    return {
      courseId,
      message: 'No skill mappings are defined for this course yet.',
      insights: []
    };
  }

  const insights = [];

  for (const mapping of skillMappings) {
    const skillNode = mapping.skill;

    // Count students with any evidence for this skill in this course
    const enrolledStudents = await prisma.enrollment.count({
      where: { courseId, status: 'active' }
    });

    const studentsWithEvidence = await prisma.learnerSkill.count({
      where: {
        name: { contains: skillNode.name, mode: 'insensitive' },
        masteryScore: { gte: 30 }
      }
    });

    insights.push({
      skillId: skillNode.id,
      skillName: skillNode.name,
      domain: skillNode.domain,
      enrolledStudentCount: enrolledStudents,
      studentsWithEvidence,
      evidenceCoveragePercent:
        enrolledStudents > 0
          ? Math.round((studentsWithEvidence / enrolledStudents) * 100)
          : 0,
      note:
        studentsWithEvidence < enrolledStudents * 0.4
          ? 'Many students are still developing evidence for this skill. Consider additional practice opportunities.'
          : 'Students are generally developing evidence for this skill.'
    });
  }

  return {
    courseId,
    insights,
    disclaimer:
      'Insights show aggregate patterns only. Individual student data is not shown here. ' +
      'Use individual student views (with appropriate authorization) for specific cases.'
  };
}

// ── Admin Intelligence ────────────────────────────────────────────────────────

/**
 * Returns institutional skill intelligence for administrators.
 *
 * @param {string} adminId
 */
export async function getAdminSkillIntelligence() {
  const [totalStudents, totalSkillRecords, topSkills, careerPathCount] =
    await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.learnerSkill.count(),
      prisma.learnerSkill.groupBy({
        by: ['name'],
        _count: { _all: true },
        _avg: { masteryScore: true },
        orderBy: { _count: { name: 'desc' } },
        take: 15
      }),
      prisma.careerPath.count({ where: { status: 'ACTIVE' } })
    ]);

  return {
    platformOverview: {
      totalStudents,
      totalSkillRecords,
      activeCareerPaths: careerPathCount
    },
    emergingSkills: topSkills.map(s => ({
      skillName: s.name,
      studentsWithEvidence: s._count._all,
      avgMasteryScore: Math.round((s._avg.masteryScore || 0) * 10) / 10
    })),
    disclaimer:
      'Institutional intelligence reflects aggregated learning evidence only. ' +
      'Individual students are not identified or ranked in this view.'
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRequiredNames(careerPath) {
  const seen = new Set();
  const names = [];

  (careerPath.skillRequirements || []).forEach(r => {
    const key = r.skillName.toLowerCase();
    if (!seen.has(key)) { seen.add(key); names.push(r.skillName); }
  });

  const jsonSkills = Array.isArray(careerPath.requiredSkills)
    ? careerPath.requiredSkills
    : [];
  jsonSkills.forEach(js => {
    if (!js || !js.name) return;
    const key = js.name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); names.push(js.name); }
  });

  return names;
}

const EXPLORATION_DISCLAIMER =
  'Career exploration is advisory guidance based on your current EDOT learning evidence. ' +
  'The system does not choose a career for you, predict employment outcomes, or guarantee success. ' +
  'Student choice and individual circumstances are primary factors in any career decision.';
