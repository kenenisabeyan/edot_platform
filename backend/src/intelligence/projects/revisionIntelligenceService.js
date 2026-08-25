/**
 * EDOT Intelligence Domain - Revision Intelligence Service
 * Manages versioned submission history and detects explainable evidence improvement loops.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertStudentOwnsProjectData } from './projectAuthorizationService.js';
import { recordProjectEvidence } from './projectEvidenceEngine.js';

/**
 * Creates a new submission revision linked to a previous submission version.
 */
export async function createProjectRevision(userId, {
  projectId,
  previousSubmissionId,
  repoUrl = null,
  liveDemoUrl = null,
  selfReflection = null,
  milestoneProgress = null
}) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(projectId, 'projectId');
  assertValidUUID(previousSubmissionId, 'previousSubmissionId');

  const prevSubmission = await prisma.projectSubmission.findUnique({
    where: { id: previousSubmissionId },
    include: { project: true }
  });

  if (!prevSubmission) {
    throw new Error('Previous submission not found');
  }

  assertStudentOwnsProjectData(userId, prevSubmission.userId);

  const nextVersion = prevSubmission.submissionVersion + 1;

  // Compare milestone progress or URLs to generate evidence improvement statement
  let improvementStatement = `Revision v${nextVersion} submitted for project "${prevSubmission.project.title}".`;
  const prevCompletedCount = Array.isArray(prevSubmission.milestoneProgress?.completed) 
    ? prevSubmission.milestoneProgress.completed.length 
    : 0;
  const currentCompletedCount = Array.isArray(milestoneProgress?.completed) 
    ? milestoneProgress.completed.length 
    : 0;

  if (currentCompletedCount > prevCompletedCount) {
    improvementStatement = `Your latest submission (v${nextVersion}) demonstrates completion of ${currentCompletedCount - prevCompletedCount} additional milestone(s) compared to v${prevSubmission.submissionVersion}.`;
  } else if (repoUrl && repoUrl !== prevSubmission.repoUrl) {
    improvementStatement = `Your latest submission (v${nextVersion}) includes updated codebase repository artifacts with refined implementation.`;
  }

  const newSubmission = await prisma.projectSubmission.create({
    data: {
      userId,
      projectId,
      repoUrl: repoUrl || prevSubmission.repoUrl,
      liveDemoUrl: liveDemoUrl || prevSubmission.liveDemoUrl,
      status: 'SUBMITTED',
      submissionVersion: nextVersion,
      previousSubmissionId,
      milestoneProgress: milestoneProgress || prevSubmission.milestoneProgress,
      selfReflection: selfReflection || prevSubmission.selfReflection,
      improvementSummary: improvementStatement,
      verificationType: 'AI_CONCEPTUAL_FEEDBACK',
      isVerified: false
    }
  });

  // Record REVISION_COMPLETED evidence
  await recordProjectEvidence(userId, {
    projectId,
    submissionId: newSubmission.id,
    sourceType: 'REVISION_COMPLETED',
    sourceEntityId: newSubmission.id,
    confidence: 0.85,
    evidenceStrength: currentCompletedCount > prevCompletedCount ? 'DEMONSTRATING' : 'DEVELOPING',
    metadata: {
      previousVersion: prevSubmission.submissionVersion,
      newVersion: nextVersion,
      improvementStatement
    }
  });

  return newSubmission;
}

/**
 * Retrieves full revision history array for a project submission chain.
 */
export async function getSubmissionRevisionHistory(submissionId, requestingUserId, requestingUserRole = 'student') {
  assertValidUUID(submissionId, 'submissionId');

  const rootSubmission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: {
      project: true,
      revisions: {
        orderBy: { submissionVersion: 'asc' }
      }
    }
  });

  if (!rootSubmission) {
    throw new Error('Submission not found');
  }

  assertStudentOwnsProjectData(requestingUserId, rootSubmission.userId, requestingUserRole);

  // Traverse backwards if this is a child revision
  let current = rootSubmission;
  while (current.previousSubmissionId) {
    const parent = await prisma.projectSubmission.findUnique({
      where: { id: current.previousSubmissionId }
    });
    if (!parent) break;
    current = parent;
  }

  // Fetch all revisions starting from original v1
  const allRevisions = await prisma.projectSubmission.findMany({
    where: {
      userId: current.userId,
      projectId: current.projectId
    },
    orderBy: { submissionVersion: 'asc' }
  });

  return {
    projectId: current.projectId,
    projectTitle: rootSubmission.project.title,
    totalRevisions: allRevisions.length,
    revisions: allRevisions.map(rev => ({
      id: rev.id,
      version: rev.submissionVersion,
      status: rev.status,
      repoUrl: rev.repoUrl,
      liveDemoUrl: rev.liveDemoUrl,
      improvementSummary: rev.improvementSummary,
      createdAt: rev.createdAt
    }))
  };
}
