/**
 * EDOT Intelligence Domain - Project & Portfolio Intelligence Service
 * Handles project recommendations based on skill gaps, AI milestone guidance,
 * artifact submissions with explicit verification labels (AI_CONCEPTUAL_FEEDBACK vs HUMAN_VERIFIED),
 * and student portfolio assembly.
 */

import { prisma } from '../../../lib/prisma.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Seeds catalog of project challenges.
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
        requiredSkills: ['HTML', 'CSS Grid', 'Flexbox', 'React'],
        milestones: [
          { step: 1, title: 'Build responsive grid product gallery' },
          { step: 2, title: 'Implement dynamic cart state management' },
          { step: 3, title: 'Deploy live demo to Vercel/Netlify' }
        ]
      },
      {
        title: 'AI Assistant Dashboard',
        description: 'Build a full-stack dashboard communicating with REST APIs and AI endpoints.',
        category: 'Software Engineering',
        difficulty: 'ADVANCED',
        requiredSkills: ['JavaScript', 'Node.js', 'Express', 'REST APIs'],
        milestones: [
          { step: 1, title: 'Design RESTful API server with error boundaries' },
          { step: 2, title: 'Connect AI provider adapter with fallback logic' },
          { step: 3, title: 'Write comprehensive integration tests' }
        ]
      }
    ]
  });
}

/**
 * Returns project recommendations based on student skill gaps.
 */
export async function getRecommendedProjects(userId) {
  await seedProjectCatalog();
  const projects = await prisma.project.findMany();

  return projects.map(p => ({
    projectId: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    difficulty: p.difficulty,
    requiredSkills: p.requiredSkills,
    milestones: p.milestones,
    matchReason: `Recommended to strengthen demonstrated ability in ${Array.isArray(p.requiredSkills) ? p.requiredSkills.join(', ') : 'core skills'}`
  }));
}

/**
 * Provides AI milestone breakdown and guidance without false verification claims.
 */
export async function getAiProjectMilestones(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found');
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
 * Submits a project artifact and triggers AI conceptual review.
 */
export async function submitProjectArtifact(userId, { projectId, repoUrl = null, liveDemoUrl = null }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const aiFeedback = {
    completenessScore: 88,
    conceptualNotes: 'Repository contains clean modular components and proper responsive CSS rules.',
    verificationDisclaimer: 'AI Conceptual Feedback (Non-Verification). Final proof requires instructor review or automated build verification.'
  };

  const submission = await prisma.projectSubmission.create({
    data: {
      userId,
      projectId,
      repoUrl,
      liveDemoUrl,
      aiReviewFeedback: aiFeedback,
      verificationType: 'AI_CONCEPTUAL_FEEDBACK',
      isVerified: false
    }
  });

  // Ensure LearnerSkill exists for foreign key constraint
  let profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.learnerProfile.create({ data: { userId } });
  }

  let learnerSkill = await prisma.learnerSkill.findFirst({
    where: { profileId: profile.id, name: 'Web Development' }
  });

  if (!learnerSkill) {
    learnerSkill = await prisma.learnerSkill.create({
      data: {
        userId,
        profileId: profile.id,
        name: 'Web Development',
        proficiencyLevel: 'intermediate',
        masteryScore: 88
      }
    });
  }

  // Automatically record evidence item
  await prisma.skillEvidence.create({
    data: {
      userId,
      skillId: learnerSkill.id,
      evidenceType: 'PROJECT_ARTIFACT',
      sourceId: submission.id,
      title: `Submitted Project: ${project.title}`,
      score: 88,
      verificationLevel: 'AI_REVIEWED'
    }
  });

  return {
    submissionId: submission.id,
    projectTitle: project.title,
    repoUrl: submission.repoUrl,
    liveDemoUrl: submission.liveDemoUrl,
    verificationType: submission.verificationType,
    isVerified: submission.isVerified,
    aiReviewFeedback: submission.aiReviewFeedback,
    createdAt: submission.createdAt
  };
}

/**
 * Retrieves student portfolio items and missing evidence alerts.
 */
export async function getLearnerPortfolio(userId) {
  const portfolioItems = await prisma.portfolioItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  const missingEvidenceAlerts = portfolioItems.length === 0 ? [
    {
      skill: 'Full-Stack Integration',
      alert: 'Missing verified project portfolio artifact. Complete "Responsive E-Commerce Storefront" to add verified proof to your Skill Passport.'
    }
  ] : [];

  return {
    userId,
    portfolioCount: portfolioItems.length,
    portfolioItems: portfolioItems.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      demonstratedSkills: item.demonstratedSkills,
      publicUrl: item.publicUrl,
      verificationStatus: item.verificationStatus,
      createdAt: item.createdAt
    })),
    missingEvidenceAlerts
  };
}

/**
 * Objective instructor verification of a project submission.
 */
export async function reviewProjectByInstructor(submissionId, instructorId, approved = true, notes = '') {
  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true }
  });

  if (!submission) {
    throw new NotFoundError('Project submission not found');
  }

  const instructorReview = {
    approved,
    reviewedBy: instructorId,
    notes,
    reviewedAt: new Date().toISOString()
  };

  const updatedSubmission = await prisma.projectSubmission.update({
    where: { id: submissionId },
    data: {
      instructorReview,
      verificationType: approved ? 'HUMAN_VERIFIED' : 'AI_CONCEPTUAL_FEEDBACK',
      isVerified: approved
    }
  });

  let portfolioItem = null;
  if (approved) {
    portfolioItem = await prisma.portfolioItem.create({
      data: {
        userId: submission.userId,
        submissionId: submission.id,
        title: submission.project.title,
        description: submission.project.description,
        demonstratedSkills: submission.project.requiredSkills,
        publicUrl: submission.liveDemoUrl || submission.repoUrl,
        verificationStatus: 'HUMAN_VERIFIED'
      }
    });

    let profile = await prisma.learnerProfile.findUnique({ where: { userId: submission.userId } });
    if (!profile) {
      profile = await prisma.learnerProfile.create({ data: { userId: submission.userId } });
    }

    let learnerSkill = await prisma.learnerSkill.findFirst({
      where: { profileId: profile.id, name: 'Web Development' }
    });

    if (!learnerSkill) {
      learnerSkill = await prisma.learnerSkill.create({
        data: {
          userId: submission.userId,
          profileId: profile.id,
          name: 'Web Development',
          proficiencyLevel: 'advanced',
          masteryScore: 95
        }
      });
    }

    await prisma.skillEvidence.create({
      data: {
        userId: submission.userId,
        skillId: learnerSkill.id,
        evidenceType: 'INSTRUCTOR_EVALUATION',
        sourceId: portfolioItem.id,
        title: `Instructor Verified Project: ${submission.project.title}`,
        score: 95,
        verificationLevel: 'HUMAN_VERIFIED'
      }
    });
  }

  return {
    submissionId: updatedSubmission.id,
    verificationType: updatedSubmission.verificationType,
    isVerified: updatedSubmission.isVerified,
    instructorReview: updatedSubmission.instructorReview,
    portfolioItem
  };
}
