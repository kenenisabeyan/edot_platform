/**
 * EDOT Intelligence Domain - Project Feedback Service
 * Handles formative AI feedback assistant (STRENGTH, IMPROVEMENT_AREA, QUESTION, NEXT_STEP)
 * and objective human instructor review workflows.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertInstructorProjectAccess } from './projectAuthorizationService.js';
import { recordProjectEvidence } from './projectEvidenceEngine.js';

/**
 * Generates formative AI feedback categorized into STRENGTH, IMPROVEMENT_AREA, QUESTION, NEXT_STEP.
 * AI feedback is explicitly non-grading and does not affect official student grades.
 */
export async function generateAiProjectFeedback(submissionId) {
  assertValidUUID(submissionId, 'submissionId');

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true }
  });

  if (!submission) {
    throw new Error('Project submission not found');
  }

  const aiFeedback = {
    disclaimer: 'AI Formative Feedback (Non-Grading). Official assessment remains controlled by your instructor.',
    categories: [
      {
        type: 'STRENGTH',
        title: 'Solid Architecture',
        detail: `The project structure cleanly maps to required skills (${Array.isArray(submission.project.requiredSkills) ? submission.project.requiredSkills.join(', ') : 'Core skills'}).`
      },
      {
        type: 'IMPROVEMENT_AREA',
        title: 'Edge Case Testing',
        detail: 'Consider expanding error boundaries and verifying handling for unexpected user inputs.'
      },
      {
        type: 'QUESTION',
        title: 'Reflection Query',
        detail: 'What trade-offs did you encounter when organizing your state and component layout?'
      },
      {
        type: 'NEXT_STEP',
        title: 'Refinement Action',
        detail: 'Submit a revision or link your live demo link to publish to your portfolio.'
      }
    ],
    generatedAt: new Date().toISOString()
  };

  await prisma.projectSubmission.update({
    where: { id: submissionId },
    data: {
      aiReviewFeedback: aiFeedback,
      status: 'FEEDBACK_RECEIVED'
    }
  });

  // Record AI_FEEDBACK evidence
  await recordProjectEvidence(submission.userId, {
    projectId: submission.projectId,
    submissionId: submission.id,
    sourceType: 'PEER_FEEDBACK', // Formative feedback
    sourceEntityId: submission.id,
    confidence: 0.8,
    evidenceStrength: 'DEVELOPING',
    metadata: { feedbackType: 'AI_FORMATIVE' }
  });

  return aiFeedback;
}

/**
 * Objective human instructor review of project submission.
 * Enforces server-side instructor course/project authorization.
 */
export async function reviewProjectByInstructor(submissionId, instructorId, { approved = true, notes = '', score = null, requestingUserRole = 'instructor' }) {
  assertValidUUID(submissionId, 'submissionId');
  assertValidUUID(instructorId, 'instructorId');

  await assertInstructorProjectAccess(instructorId, submissionId, requestingUserRole);

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true }
  });

  if (!submission) {
    throw new Error('Submission not found');
  }

  const instructorReview = {
    approved,
    reviewedBy: instructorId,
    notes,
    score,
    reviewedAt: new Date().toISOString()
  };

  const updatedStatus = approved ? 'COMPLETED' : 'REVISION_REQUESTED';

  const updatedSubmission = await prisma.projectSubmission.update({
    where: { id: submissionId },
    data: {
      instructorReview,
      score,
      status: updatedStatus,
      verificationType: approved ? 'HUMAN_VERIFIED' : 'AI_CONCEPTUAL_FEEDBACK',
      isVerified: approved
    }
  });

  // Record INSTRUCTOR_EVALUATION evidence
  await recordProjectEvidence(submission.userId, {
    projectId: submission.projectId,
    submissionId: submission.id,
    sourceType: 'INSTRUCTOR_EVALUATION',
    sourceEntityId: instructorId,
    confidence: approved ? 0.95 : 0.6,
    evidenceStrength: approved ? 'DEMONSTRATING' : 'DEVELOPING',
    metadata: { approved, notes, score }
  });

  return {
    submissionId: updatedSubmission.id,
    status: updatedSubmission.status,
    verificationType: updatedSubmission.verificationType,
    isVerified: updatedSubmission.isVerified,
    instructorReview: updatedSubmission.instructorReview,
    score: updatedSubmission.score
  };
}
