/**
 * EDOT Intelligence Domain - AI Project Planner & Milestone Intelligence
 * Provides milestone planning, status tracking (NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED),
 * and links blocked milestones to Personal Learning Engine interventions.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertStudentOwnsProjectData } from './projectAuthorizationService.js';
import { getStudentSkillProfile } from '../career/skillProfileService.js';

/**
 * Recommends personalized projects based on student skill gaps and enrolled courses.
 */
export async function getPersonalizedProjectRecommendations(userId) {
  assertValidUUID(userId, 'userId');

  const skillProfile = await getStudentSkillProfile(userId).catch(() => ({ developingSkills: [], priorityGaps: [] }));
  const projects = await prisma.project.findMany({
    where: { status: 'ACTIVE' },
    include: { course: { select: { id: true, title: true } } }
  });

  if (projects.length === 0) {
    // Seed default projects if empty
    await prisma.project.createMany({
      data: [
        {
          title: 'Responsive Portfolio Website',
          description: 'Build a modern responsive portfolio showcasing HTML, CSS Grid, and React mastery.',
          category: 'Web Development',
          difficulty: 'INTERMEDIATE',
          projectType: 'PORTFOLIO_PROJECT',
          requiredSkills: ['HTML', 'CSS Grid', 'React'],
          milestones: [
            { id: 'm1', step: 1, title: 'HTML5 Semantic Layout & Wireframe', status: 'NOT_STARTED' },
            { id: 'm2', step: 2, title: 'CSS Grid & Flexbox Responsive Styles', status: 'NOT_STARTED' },
            { id: 'm3', step: 3, title: 'React Dynamic Project Components', status: 'NOT_STARTED' },
            { id: 'm4', step: 4, title: 'Self Reflection & Live Demo Deployment', status: 'NOT_STARTED' }
          ]
        },
        {
          title: 'Full-Stack REST API Challenge',
          description: 'Design and deploy an Express API server with authentication and unit tests.',
          category: 'Backend Development',
          difficulty: 'ADVANCED',
          projectType: 'SKILL_PROJECT',
          requiredSkills: ['Node.js', 'Express', 'REST APIs'],
          milestones: [
            { id: 'm1', step: 1, title: 'API Endpoint Architecture', status: 'NOT_STARTED' },
            { id: 'm2', step: 2, title: 'JWT Authentication & Middleware', status: 'NOT_STARTED' },
            { id: 'm3', step: 3, title: 'Integration Test Suite', status: 'NOT_STARTED' }
          ]
        }
      ]
    });

    return getPersonalizedProjectRecommendations(userId);
  }

  return projects.map(p => {
    const required = Array.isArray(p.requiredSkills) ? p.requiredSkills : [];
    const matchedGap = required.find(s => skillProfile.priorityGaps?.some(g => g.skillName === s));

    return {
      projectId: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      difficulty: p.difficulty,
      projectType: p.projectType,
      requiredSkills: p.requiredSkills,
      milestones: p.milestones,
      matchReason: matchedGap
        ? `Recommended to address identified skill gap in ${matchedGap}`
        : `Recommended to build portfolio evidence in ${p.category}`
    };
  });
}

/**
 * Updates milestone progress for a project submission and recommends intervention if BLOCKED.
 */
export async function updateMilestoneProgress(userId, { submissionId, milestoneId, status, blockerReason = null }) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(submissionId, 'submissionId');

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true }
  });

  if (!submission) {
    throw new Error('Project submission not found');
  }

  assertStudentOwnsProjectData(userId, submission.userId);

  const currentMilestones = Array.isArray(submission.milestoneProgress?.milestones)
    ? submission.milestoneProgress.milestones
    : (Array.isArray(submission.project.milestones) ? submission.project.milestones : []);

  const updatedMilestones = currentMilestones.map(m => {
    if (m.id === milestoneId || m.step === milestoneId || m.title === milestoneId) {
      return {
        ...m,
        status,
        blockerReason: status === 'BLOCKED' ? blockerReason : null,
        updatedAt: new Date().toISOString()
      };
    }
    return m;
  });

  let recommendedIntervention = null;
  if (status === 'BLOCKED') {
    recommendedIntervention = {
      type: 'LEARNING_INTERVENTION',
      title: 'Milestone Blocked Guidance',
      suggestion: 'We noticed you are blocked on this milestone. Consider asking AI Mentor for conceptual guidance or reviewing prerequisite course lessons.',
      actionUrl: `/intelligence/mentor`,
      suggestedActions: [
        { label: 'Ask AI Mentor for Help', actionType: 'MENTOR_CHAT' },
        { label: 'Review Prerequisite Lesson', actionType: 'OPEN_LESSON' }
      ]
    };
  }

  const updatedSubmission = await prisma.projectSubmission.update({
    where: { id: submissionId },
    data: {
      milestoneProgress: {
        milestones: updatedMilestones,
        completed: updatedMilestones.filter(m => m.status === 'COMPLETED').map(m => m.id || m.title),
        blocked: updatedMilestones.filter(m => m.status === 'BLOCKED').map(m => m.id || m.title),
        lastUpdated: new Date().toISOString()
      }
    }
  });

  return {
    submissionId: updatedSubmission.id,
    milestoneProgress: updatedSubmission.milestoneProgress,
    recommendedIntervention
  };
}
