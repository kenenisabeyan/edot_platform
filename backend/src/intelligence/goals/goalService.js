/**
 * EDOT Intelligence Domain - Goal Intelligence Service
 * Manages learner goal creation, modification, roadmap calculation, and adaptation persistence.
 */

import { prisma } from '../../../lib/prisma.js';
import { calculateDynamicRoadmap } from './goalRoadmapCalculator.js';
import { NotFoundError, ForbiddenError } from '../shared/errors.js';

/**
 * Creates or updates active learner goal and generates dynamic roadmap.
 */
export async function createOrUpdateGoal(userId, { goalText, category = 'career', targetDate = null }) {
  // Ensure LearnerProfile exists
  let profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.learnerProfile.create({ data: { userId } });
  }

  // Deactivate prior goals if any
  await prisma.learnerGoal.updateMany({
    where: { profileId: profile.id, status: 'active' },
    data: { status: 'archived' }
  });

  const goal = await prisma.learnerGoal.create({
    data: {
      profileId: profile.id,
      goalText,
      category,
      targetDate: targetDate ? new Date(targetDate) : null,
      status: 'active'
    }
  });

  const learnerSkills = await prisma.learnerSkill.findMany({ where: { userId } });
  const roadmapData = calculateDynamicRoadmap(goal.goalText, learnerSkills);

  const roadmap = await prisma.learningRoadmap.create({
    data: {
      goalId: goal.id,
      userId,
      currentPosition: roadmapData.currentPosition,
      requiredSkills: roadmapData.requiredSkills,
      currentStrengths: roadmapData.currentStrengths,
      skillGaps: roadmapData.skillGaps,
      recommendedPath: roadmapData.recommendedPath,
      milestones: roadmapData.milestones,
      evidenceRequired: roadmapData.evidenceRequired,
      disclaimer: roadmapData.disclaimer
    }
  });

  return {
    goalId: goal.id,
    goalText: goal.goalText,
    category: goal.category,
    status: goal.status,
    roadmap: {
      id: roadmap.id,
      currentPosition: roadmap.currentPosition,
      requiredSkills: roadmap.requiredSkills,
      currentStrengths: roadmap.currentStrengths,
      skillGaps: roadmap.skillGaps,
      recommendedPath: roadmap.recommendedPath,
      milestones: roadmap.milestones,
      evidenceRequired: roadmap.evidenceRequired,
      disclaimer: roadmap.disclaimer
    }
  };
}

/**
 * Retrieves active learner goal and roadmap DTO.
 */
export async function getLearnerActiveGoalAndRoadmap(userId) {
  const profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  if (!profile) {
    return createOrUpdateGoal(userId, { goalText: 'Become a Frontend Developer' });
  }

  const goal = await prisma.learnerGoal.findFirst({
    where: { profileId: profile.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { roadmaps: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  if (!goal) {
    return createOrUpdateGoal(userId, { goalText: 'Become a Frontend Developer' });
  }

  const roadmap = goal.roadmaps[0];
  return {
    goalId: goal.id,
    goalText: goal.goalText,
    category: goal.category,
    status: goal.status,
    roadmap: roadmap ? {
      id: roadmap.id,
      currentPosition: roadmap.currentPosition,
      requiredSkills: roadmap.requiredSkills,
      currentStrengths: roadmap.currentStrengths,
      skillGaps: roadmap.skillGaps,
      recommendedPath: roadmap.recommendedPath,
      milestones: roadmap.milestones,
      evidenceRequired: roadmap.evidenceRequired,
      disclaimer: roadmap.disclaimer
    } : null
  };
}

/**
 * Modifies an existing learner goal.
 */
export async function modifyGoal(goalId, userId, { goalText, category, status }) {
  const goal = await prisma.learnerGoal.findUnique({
    where: { id: goalId },
    include: { profile: true }
  });

  if (!goal || goal.profile.userId !== userId) {
    throw new ForbiddenError('Not authorized to modify this goal');
  }

  const updatedGoal = await prisma.learnerGoal.update({
    where: { id: goalId },
    data: {
      goalText: goalText || goal.goalText,
      category: category || goal.category,
      status: status || goal.status
    }
  });

  const learnerSkills = await prisma.learnerSkill.findMany({ where: { userId } });
  const roadmapData = calculateDynamicRoadmap(updatedGoal.goalText, learnerSkills);

  const updatedRoadmap = await prisma.learningRoadmap.create({
    data: {
      goalId: updatedGoal.id,
      userId,
      currentPosition: roadmapData.currentPosition,
      requiredSkills: roadmapData.requiredSkills,
      currentStrengths: roadmapData.currentStrengths,
      skillGaps: roadmapData.skillGaps,
      recommendedPath: roadmapData.recommendedPath,
      milestones: roadmapData.milestones,
      evidenceRequired: roadmapData.evidenceRequired,
      disclaimer: roadmapData.disclaimer
    }
  });

  return {
    goalId: updatedGoal.id,
    goalText: updatedGoal.goalText,
    category: updatedGoal.category,
    status: updatedGoal.status,
    roadmap: updatedRoadmap
  };
}
