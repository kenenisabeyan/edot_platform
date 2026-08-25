/**
 * EDOT Intelligence Domain - Portfolio Intelligence Service
 * Manages student-controlled portfolio publication, visibility settings (PRIVATE, COURSE_PEERS, TEAM_ONLY, PUBLIC_WITH_CONSENT),
 * and portfolio project profile generation.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertStudentOwnsProjectData } from './projectAuthorizationService.js';

/**
 * Retrieves student portfolio suggestions and existing published/draft portfolio items.
 */
export async function getPortfolioIntelligence(userId) {
  assertValidUUID(userId, 'userId');

  const portfolioItems = await prisma.portfolioItem.findMany({
    where: { userId },
    include: {
      submission: {
        include: { project: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Find completed or verified project submissions that are not yet in portfolio
  const eligibleSubmissions = await prisma.projectSubmission.findMany({
    where: {
      userId,
      OR: [
        { isVerified: true },
        { status: 'COMPLETED' },
        { status: 'SUBMITTED' }
      ]
    },
    include: { project: true }
  });

  const existingSubmissionIds = new Set(portfolioItems.map(p => p.submissionId));
  const portfolioSuggestions = eligibleSubmissions
    .filter(sub => !existingSubmissionIds.has(sub.id))
    .map(sub => ({
      submissionId: sub.id,
      projectId: sub.projectId,
      title: sub.project.title,
      description: sub.project.description,
      demonstratedSkills: sub.project.requiredSkills,
      suggestionMessage: `Consider including "${sub.project.title}" in your portfolio to demonstrate verified capability.`
    }));

  return {
    userId,
    portfolioCount: portfolioItems.length,
    portfolioItems: portfolioItems.map(item => ({
      id: item.id,
      submissionId: item.submissionId,
      title: item.title,
      description: item.description,
      demonstratedSkills: item.demonstratedSkills,
      publicUrl: item.publicUrl,
      verificationStatus: item.verificationStatus,
      projectRole: item.projectRole || 'Lead Contributor',
      learningContext: item.learningContext || 'EDOT Project Challenge',
      evidenceSummary: item.evidenceSummary || 'Demonstrated core competencies through verified project submission.',
      visibility: item.visibility,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt
    })),
    portfolioSuggestions
  };
}

/**
 * Creates or updates a portfolio project profile. Requires explicit student control over visibility and inclusion.
 */
export async function updatePortfolioProjectProfile(userId, {
  submissionId,
  title = null,
  description = null,
  projectRole = 'Lead Contributor',
  learningContext = null,
  publicUrl = null,
  visibility = 'PRIVATE',
  publish = false
}) {
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

  const validVisibilities = ['PRIVATE', 'COURSE_PEERS', 'TEAM_ONLY', 'PUBLIC_WITH_CONSENT'];
  const finalVisibility = validVisibilities.includes(visibility) ? visibility : 'PRIVATE';

  let item = await prisma.portfolioItem.findFirst({
    where: { userId, submissionId }
  });

  const profileData = {
    userId,
    submissionId,
    title: title || submission.project.title,
    description: description || submission.project.description,
    demonstratedSkills: submission.project.requiredSkills,
    publicUrl: publicUrl || submission.liveDemoUrl || submission.repoUrl,
    verificationStatus: submission.isVerified ? 'HUMAN_VERIFIED' : 'AI_REVIEWED',
    projectRole,
    learningContext: learningContext || `Completed project in ${submission.project.category}`,
    evidenceSummary: `Verified evidence generated through submission v${submission.submissionVersion}.`,
    visibility: finalVisibility,
    publishedAt: publish ? new Date() : (item ? item.publishedAt : null)
  };

  if (item) {
    item = await prisma.portfolioItem.update({
      where: { id: item.id },
      data: profileData
    });
  } else {
    item = await prisma.portfolioItem.create({
      data: profileData
    });
  }

  return item;
}

/**
 * Deletes or removes a project item from student portfolio.
 */
export async function removePortfolioItem(userId, itemId) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(itemId, 'itemId');

  const item = await prisma.portfolioItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new Error('Portfolio item not found');
  }

  assertStudentOwnsProjectData(userId, item.userId);

  await prisma.portfolioItem.delete({ where: { id: itemId } });

  return { success: true, removedItemId: itemId };
}
