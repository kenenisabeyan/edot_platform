/**
 * EDOT Intelligence — Phase 12
 * Development Roadmap Service
 *
 * Builds a personalized career development roadmap by integrating with
 * the Phase 10 Personal Learning Engine.
 *
 * DESIGN PRINCIPLE:
 *   This service DOES NOT duplicate Phase 10's recommendation engine.
 *   It adds career-goal context to Phase 10's outputs and structures them
 *   into a roadmap narrative (NOW / NEXT / LATER).
 *
 *   The roadmap is dynamic: it re-evaluates whenever called, reflecting
 *   the latest skills, mastery, and course catalog.
 */

import { prisma } from '../../../lib/prisma.js';
import { analyzeSkillGap } from './skillGapService.js';

/**
 * Builds a career development roadmap for a student.
 *
 * @param {string} userId
 * @param {object} careerPath  — resolved CareerPath with skillRequirements
 * @returns {Promise<object>}
 */
export async function buildCareerRoadmap(userId, careerPath) {
  // 1. Get skill gap analysis
  const gapAnalysis = await analyzeSkillGap(userId, careerPath);

  // 2. Find relevant courses for each gap skill
  const gapSkillNames = [
    ...gapAnalysis.priorityGaps.map(g => g.skillName),
    ...gapAnalysis.developing.map(d => d.skillName)
  ];

  const roadmapItems = [];

  for (const skillName of gapSkillNames.slice(0, 10)) {
    // Find SkillNode
    const skillNode = await prisma.skillNode.findFirst({
      where: { name: { contains: skillName, mode: 'insensitive' } },
      select: { id: true }
    });

    // Find courses that teach this skill
    let relevantCourses = [];
    if (skillNode) {
      const courseMappings = await prisma.courseSkillMapping.findMany({
        where: { skillId: skillNode.id },
        include: {
          course: {
            select: { id: true, title: true, mainCategory: true, isPublished: true }
          }
        },
        take: 3
      });
      relevantCourses = courseMappings
        .filter(m => m.course.isPublished)
        .map(m => ({
          courseId: m.course.id,
          title: m.course.title,
          category: m.course.mainCategory
        }));
    }

    // If no mapped course, try category search
    if (relevantCourses.length === 0) {
      const categoryCourses = await prisma.course.findMany({
        where: {
          isPublished: true,
          OR: [
            { tags: { has: skillName } },
            { mainCategory: { contains: careerPath.category, mode: 'insensitive' } }
          ]
        },
        select: { id: true, title: true, mainCategory: true },
        take: 2
      });
      relevantCourses = categoryCourses.map(c => ({
        courseId: c.id,
        title: c.title,
        category: c.mainCategory
      }));
    }

    roadmapItems.push({
      skillName,
      relevantCourses,
      suggestedAction: relevantCourses.length > 0
        ? `Explore "${relevantCourses[0].title}" to develop evidence in ${skillName}`
        : `Search for learning resources related to ${skillName}`
    });
  }

  // 3. Get active Phase 10 learning plans for personal recommendations context
  let phase10Plans = [];
  try {
    phase10Plans = await prisma.studentLearningPlan.findMany({
      where: { studentId: userId, status: 'ACTIVE' },
      include: {
        course: { select: { id: true, title: true } },
        actions: {
          where: { status: { in: ['GENERATED', 'VIEWED'] } },
          orderBy: { priorityScore: 'desc' },
          take: 3
        }
      }
    });
  } catch {
    // Phase 10 data unavailable — non-critical for roadmap
  }

  // 4. Structure roadmap into NOW / NEXT / LATER phases
  const nowItems = [];
  const nextItems = [];
  const laterItems = [];

  // Priority gaps → NOW
  gapAnalysis.priorityGaps.slice(0, 2).forEach(gap => {
    const mapItem = roadmapItems.find(
      r => r.skillName.toLowerCase() === gap.skillName.toLowerCase()
    );
    nowItems.push({
      phase: 'NOW',
      action: mapItem?.suggestedAction || `Develop evidence in ${gap.skillName}`,
      rationale: `"${gap.skillName}" is a ${gap.importance.toLowerCase()} requirement for ${careerPath.title}. ${gap.explanation}`,
      relatedCourses: mapItem?.relevantCourses || [],
      skillName: gap.skillName,
      importance: gap.importance
    });
  });

  // Developing skills → NEXT
  gapAnalysis.developing.slice(0, 2).forEach(dev => {
    const mapItem = roadmapItems.find(
      r => r.skillName.toLowerCase() === dev.skillName.toLowerCase()
    );
    nextItems.push({
      phase: 'NEXT',
      action: mapItem?.suggestedAction || `Strengthen evidence in ${dev.skillName}`,
      rationale: `Your current evidence for "${dev.skillName}" is ${dev.evidenceState.toLowerCase().replace('_', ' ')}. Continued assessment and practice may strengthen it.`,
      relatedCourses: mapItem?.relevantCourses || [],
      skillName: dev.skillName,
      evidenceState: dev.evidenceState
    });
  });

  // Later: remaining gaps, then Phase 10 personal recommendations
  gapAnalysis.priorityGaps.slice(2).forEach(gap => {
    laterItems.push({
      phase: 'LATER',
      action: `Explore ${gap.skillName}`,
      rationale: `This skill is part of the ${careerPath.title} path but can be developed after foundational areas are addressed.`,
      skillName: gap.skillName
    });
  });

  // Add Phase 10 personal learning actions to LATER if not already covered
  if (phase10Plans.length > 0) {
    const planActions = phase10Plans.flatMap(p => p.actions).slice(0, 2);
    planActions.forEach(action => {
      laterItems.push({
        phase: 'LATER',
        action: action.reason,
        rationale: action.explanation || 'Recommended by your personal learning engine.',
        source: 'PERSONAL_LEARNING_ENGINE'
      });
    });
  }

  return {
    userId,
    careerPathId: careerPath.id,
    careerTitle: careerPath.title,
    generatedAt: new Date(),
    roadmap: {
      now: nowItems,
      next: nextItems,
      later: laterItems
    },
    strengths: gapAnalysis.strengths.map(s => s.skillName),
    gapSummary: {
      priorityGapCount: gapAnalysis.priorityGaps.length,
      developingCount: gapAnalysis.developing.length
    },
    limitations: gapAnalysis.limitations,
    disclaimer:
      'This roadmap is generated from your current EDOT learning evidence and career path requirements. ' +
      'It adapts as you learn new skills, complete courses, and improve assessments. ' +
      'Timeline estimates are not provided. Career outcomes are not guaranteed.'
  };
}
