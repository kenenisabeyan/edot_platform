/**
 * EDOT Intelligence Domain - Project & Portfolio Intelligence Master Orchestrator
 * Coordinates project recommendations, milestone intelligence, formative AI feedback,
 * versioned revision history, team contributions, portfolio publication, and instructor/admin insights.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID, assertStudentOwnsProjectData, assertGuardianStudentLink, sanitizeGuardianProjectView } from './projectAuthorizationService.js';
import { recordProjectEvidence, getStudentProjectEvidences } from './projectEvidenceEngine.js';
import { createProjectRevision, getSubmissionRevisionHistory } from './revisionIntelligenceService.js';
import { getPersonalizedProjectRecommendations, updateMilestoneProgress } from './projectPlannerService.js';
import { generateAiProjectFeedback, reviewProjectByInstructor } from './projectFeedbackService.js';
import { getPortfolioIntelligence, updatePortfolioProjectProfile, removePortfolioItem } from './portfolioIntelligenceService.js';
import { registerTeamSubmission, getIndividualTeamContribution } from './teamProjectService.js';

export {
  assertValidUUID,
  assertStudentOwnsProjectData,
  recordProjectEvidence,
  getStudentProjectEvidences,
  createProjectRevision,
  getSubmissionRevisionHistory,
  getPersonalizedProjectRecommendations,
  updateMilestoneProgress,
  generateAiProjectFeedback,
  reviewProjectByInstructor,
  getPortfolioIntelligence,
  updatePortfolioProjectProfile,
  removePortfolioItem,
  registerTeamSubmission,
  getIndividualTeamContribution
};

/**
 * Seeds catalog of project challenges if empty.
 */
export async function seedProjectCatalog() {
  const count = await prisma.project.count();
  if (count > 0) return;

  await prisma.project.createMany({
    data: [
      {
        title: 'Responsive E-Commerce Storefront',
        description: 'Build a mobile-first e-commerce frontend using Flexbox, CSS Grid, and React.',
        category: 'Web Development',
        difficulty: 'INTERMEDIATE',
        projectType: 'PORTFOLIO_PROJECT',
        requiredSkills: ['HTML', 'CSS Grid', 'Flexbox', 'React'],
        milestones: [
          { id: 'm1', step: 1, title: 'Build responsive grid product gallery', status: 'NOT_STARTED' },
          { id: 'm2', step: 2, title: 'Implement dynamic cart state management', status: 'NOT_STARTED' },
          { id: 'm3', step: 3, title: 'Deploy live demo to Vercel/Netlify', status: 'NOT_STARTED' }
        ]
      },
      {
        title: 'AI Assistant Dashboard',
        description: 'Build a full-stack dashboard communicating with REST APIs and AI endpoints.',
        category: 'Software Engineering',
        difficulty: 'ADVANCED',
        projectType: 'SKILL_PROJECT',
        requiredSkills: ['JavaScript', 'Node.js', 'Express', 'REST APIs'],
        milestones: [
          { id: 'm1', step: 1, title: 'Design RESTful API server with error boundaries', status: 'NOT_STARTED' },
          { id: 'm2', step: 2, title: 'Connect AI provider adapter with fallback logic', status: 'NOT_STARTED' },
          { id: 'm3', step: 3, title: 'Write comprehensive integration tests', status: 'NOT_STARTED' }
        ]
      }
    ]
  });
}

/**
 * Backward compatible alias for project recommendations.
 */
export async function getRecommendedProjects(userId) {
  return getPersonalizedProjectRecommendations(userId);
}

/**
 * Provides AI milestone breakdown and guidance without false verification claims.
 */
export async function getAiProjectMilestones(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error('Project not found');
  }

  return {
    projectId: project.id,
    title: project.title,
    milestones: project.milestones,
    aiGuidance: 'AI provides conceptual assistance and structural guidance. Official verification requires instructor evaluation or automated test pass artifacts.',
    isVerificationClaimed: false
  };
}

/**
 * Backward compatible artifact submission method.
 */
export async function submitProjectArtifact(userId, { projectId, repoUrl = null, liveDemoUrl = null, selfReflection = null }) {
  assertValidUUID(userId, 'userId');
  assertValidUUID(projectId, 'projectId');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error('Project not found');
  }

  const submission = await prisma.projectSubmission.create({
    data: {
      userId,
      projectId,
      repoUrl,
      liveDemoUrl,
      selfReflection,
      status: 'SUBMITTED',
      verificationType: 'AI_CONCEPTUAL_FEEDBACK',
      isVerified: false
    }
  });

  // Record initial submission evidence
  await recordProjectEvidence(userId, {
    projectId,
    submissionId: submission.id,
    sourceType: 'PROJECT_SUBMISSION',
    sourceEntityId: submission.id,
    confidence: 0.8,
    evidenceStrength: 'DEVELOPING',
    metadata: { selfReflection }
  });

  return {
    submissionId: submission.id,
    projectTitle: project.title,
    repoUrl: submission.repoUrl,
    liveDemoUrl: submission.liveDemoUrl,
    status: submission.status,
    verificationType: submission.verificationType,
    isVerified: submission.isVerified,
    createdAt: submission.createdAt
  };
}

/**
 * Backward compatible portfolio retrieval.
 */
export async function getLearnerPortfolio(userId) {
  const intel = await getPortfolioIntelligence(userId);
  return {
    userId,
    portfolioCount: intel.portfolioCount,
    portfolioItems: intel.portfolioItems,
    missingEvidenceAlerts: intel.portfolioSuggestions.map(s => ({
      skill: s.title,
      alert: s.suggestionMessage
    }))
  };
}

/**
 * Aggregate project progress insights for instructors (Phase 4 extension).
 */
export async function getInstructorProjectInsights(instructorId) {
  assertValidUUID(instructorId, 'instructorId');

  const submissions = await prisma.projectSubmission.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, title: true, category: true } }
    }
  });

  const pendingReviewCount = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW').length;
  const verifiedCount = submissions.filter(s => s.isVerified).length;

  return {
    instructorId,
    totalSubmissions: submissions.length,
    pendingReviewCount,
    verifiedCount,
    recentSubmissions: submissions.slice(0, 10).map(s => ({
      submissionId: s.id,
      studentName: s.user.name,
      projectTitle: s.project.title,
      status: s.status,
      isVerified: s.isVerified,
      createdAt: s.createdAt
    }))
  };
}

/**
 * Aggregate institutional project intelligence for admins (Phase 5 extension).
 */
export async function getAdminProjectIntelligence() {
  const totalProjects = await prisma.project.count();
  const totalSubmissions = await prisma.projectSubmission.count();
  const verifiedSubmissions = await prisma.projectSubmission.count({ where: { isVerified: true } });
  const portfolioCount = await prisma.portfolioItem.count();

  return {
    totalProjects,
    totalSubmissions,
    verifiedSubmissions,
    portfolioCount,
    verificationRate: totalSubmissions > 0 ? (verifiedSubmissions / totalSubmissions) * 100 : 0,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Privacy-safe project overview for guardians (Phase 6 extension).
 */
export async function getGuardianProjectSummary(guardianId, studentId) {
  await assertGuardianStudentLink(guardianId, studentId);

  const submissions = await prisma.projectSubmission.findMany({
    where: { userId: studentId },
    include: { project: true },
    orderBy: { updatedAt: 'desc' }
  });

  return {
    studentId,
    projectCount: submissions.length,
    verifiedProjectCount: submissions.filter(s => s.isVerified).length,
    projects: sanitizeGuardianProjectView(submissions)
  };
}
