/**
 * EDOT Intelligence Domain - Team Project Intelligence Service
 * Handles team project membership, role assignments, and distinguishes
 * team project evidence from individual contribution evidence.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertStudentOwnsProjectData } from './projectAuthorizationService.js';
import { recordProjectEvidence } from './projectEvidenceEngine.js';

/**
 * Registers team members and specific individual contribution roles for a project submission.
 */
export async function registerTeamSubmission(userId, {
  projectId,
  teamName = null,
  teamMembers = [], // Array of { userId, role, contributionSummary, verifiedSkills }
  repoUrl = null,
  liveDemoUrl = null
}) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(projectId, 'projectId');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error('Project not found');
  }

  // Enforce team project type
  if (project.projectType !== 'TEAM_PROJECT') {
    await prisma.project.update({
      where: { id: projectId },
      data: { projectType: 'TEAM_PROJECT' }
    });
  }

  const submission = await prisma.projectSubmission.create({
    data: {
      userId,
      projectId,
      repoUrl,
      liveDemoUrl,
      status: 'SUBMITTED',
      teamMembers: {
        teamName: teamName || 'Project Team',
        members: teamMembers.map(m => ({
          userId: m.userId,
          role: m.role || 'Contributor',
          contributionSummary: m.contributionSummary || 'Contributed to team project development',
          verifiedSkills: m.verifiedSkills || []
        }))
      },
      verificationType: 'AI_CONCEPTUAL_FEEDBACK',
      isVerified: false
    }
  });

  // Record individual contribution evidence for EACH member distinctly based on declared role/skills
  for (const member of teamMembers) {
    if (member.userId) {
      await recordProjectEvidence(member.userId, {
        projectId,
        submissionId: submission.id,
        sourceType: 'DEMONSTRATED_SKILL',
        sourceEntityId: submission.id,
        confidence: 0.75,
        evidenceStrength: 'DEVELOPING',
        metadata: {
          teamName: teamName || 'Project Team',
          individualRole: member.role || 'Contributor',
          contributionSummary: member.contributionSummary || '',
          isIndividualContribution: true
        }
      });
    }
  }

  return submission;
}

/**
 * Retrieves individual contribution summary for a team project member.
 */
export async function getIndividualTeamContribution(submissionId, studentId) {
  assertValidUUID(submissionId, 'submissionId');
  assertValidUUID(studentId, 'studentId');

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true }
  });

  if (!submission) {
    throw new Error('Submission not found');
  }

  const teamData = submission.teamMembers || {};
  const members = Array.isArray(teamData.members) ? teamData.members : [];
  const memberRecord = members.find(m => m.userId === studentId) || {
    userId: studentId,
    role: 'Team Member',
    contributionSummary: 'General contribution to team project',
    verifiedSkills: []
  };

  return {
    submissionId: submission.id,
    projectTitle: submission.project.title,
    teamName: teamData.teamName || 'Project Team',
    individualContribution: {
      userId: memberRecord.userId,
      role: memberRecord.role,
      contributionSummary: memberRecord.contributionSummary,
      verifiedSkills: memberRecord.verifiedSkills
    }
  };
}
