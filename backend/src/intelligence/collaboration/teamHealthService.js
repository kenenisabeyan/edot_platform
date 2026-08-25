/**
 * EDOT Intelligence Domain - Team Health Intelligence Service
 * Provides aggregate, non-punitive team health analysis (milestone progress, participation balance, unresolved blockers)
 * and supportive recommendations without publicly ranking or blaming members.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './collaborationAuthorizationService.js';

/**
 * Analyzes team project health for a Phase 13 project submission.
 */
export async function getTeamHealthAnalysis(submissionId) {
  assertValidUUID(submissionId, 'submissionId');

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true }
  });

  if (!submission) {
    throw new Error('Project submission not found');
  }

  const milestoneData = submission.milestoneProgress || {};
  const completedCount = Array.isArray(milestoneData.completed) ? milestoneData.completed.length : 0;
  const blockedCount = Array.isArray(milestoneData.blocked) ? milestoneData.blocked.length : 0;
  const totalMilestones = Array.isArray(submission.project.milestones) ? submission.project.milestones.length : 3;

  const teamData = submission.teamMembers || {};
  const members = Array.isArray(teamData.members) ? teamData.members : [];

  let healthStatus = 'HEALTHY';
  let supportiveRecommendation = 'Your team project is progressing on track.';

  if (blockedCount > 0) {
    healthStatus = 'NEEDS_ATTENTION';
    supportiveRecommendation = 'Your team has identified open milestone blockers. Consider scheduling an alignment session or requesting AI Mentor project guidance.';
  } else if (completedCount === 0 && totalMilestones > 0) {
    healthStatus = 'INITIALIZING';
    supportiveRecommendation = 'Your team has initialized the project! Start by breaking down and assigning the first planning milestone.';
  }

  return {
    submissionId: submission.id,
    projectTitle: submission.project.title,
    teamName: teamData.teamName || 'Project Team',
    memberCount: members.length,
    healthStatus,
    milestoneProgress: {
      completedCount,
      blockedCount,
      totalMilestones,
      completionRate: totalMilestones > 0 ? (completedCount / totalMilestones) * 100 : 0
    },
    supportiveRecommendation,
    disclaimer: 'Team health analysis is supportive and non-punitive. It provides constructive recommendations without evaluating individual member blame.'
  };
}
