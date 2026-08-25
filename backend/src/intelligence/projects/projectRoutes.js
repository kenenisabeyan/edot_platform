/**
 * EDOT Intelligence Domain - Project & Portfolio Router
 * REST API endpoints for project recommendations, submissions, revisions, milestone tracking,
 * AI feedback, portfolio publication, team contributions, and role-based insights (instructor, admin, guardian).
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../middleware/auth.js';
import {
  getRecommendedProjects,
  getAiProjectMilestones,
  submitProjectArtifact,
  getLearnerPortfolio,
  reviewProjectByInstructor,
  createProjectRevision,
  getSubmissionRevisionHistory,
  updateMilestoneProgress,
  generateAiProjectFeedback,
  getPortfolioIntelligence,
  updatePortfolioProjectProfile,
  removePortfolioItem,
  registerTeamSubmission,
  getInstructorProjectInsights,
  getAdminProjectIntelligence,
  getGuardianProjectSummary
} from './projectService.js';

const router = express.Router();

// GET /api/v2/intelligence/projects/recommendations/me
router.get('/projects/recommendations/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const recommendations = await getRecommendedProjects(req.user.id);
    res.json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/projects/submissions
router.post('/projects/submissions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { projectId, repoUrl, liveDemoUrl, selfReflection } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required' });
    }
    const submission = await submitProjectArtifact(req.user.id, { projectId, repoUrl, liveDemoUrl, selfReflection });
    res.status(201).json({
      success: true,
      data: submission
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/projects/submissions/:id/revisions
router.post('/projects/submissions/:id/revisions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { projectId, repoUrl, liveDemoUrl, selfReflection, milestoneProgress } = req.body;
    const revision = await createProjectRevision(req.user.id, {
      projectId,
      previousSubmissionId: req.params.id,
      repoUrl,
      liveDemoUrl,
      selfReflection,
      milestoneProgress
    });
    res.status(201).json({
      success: true,
      data: revision
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/projects/submissions/:id/revisions
router.get('/projects/submissions/:id/revisions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const history = await getSubmissionRevisionHistory(req.params.id, req.user.id, req.user.role);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/intelligence/projects/submissions/:id/milestones
router.put('/projects/submissions/:id/milestones', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { milestoneId, status, blockerReason } = req.body;
    const result = await updateMilestoneProgress(req.user.id, {
      submissionId: req.params.id,
      milestoneId,
      status,
      blockerReason
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/projects/submissions/:id/ai-feedback
router.post('/projects/submissions/:id/ai-feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const feedback = await generateAiProjectFeedback(req.params.id);
    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/portfolio/me
router.get('/portfolio/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const portfolio = await getPortfolioIntelligence(req.user.id);
    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/portfolio/project-profile
router.post('/portfolio/project-profile', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { submissionId, title, description, projectRole, learningContext, publicUrl, visibility, publish } = req.body;
    const item = await updatePortfolioProjectProfile(req.user.id, {
      submissionId,
      title,
      description,
      projectRole,
      learningContext,
      publicUrl,
      visibility,
      publish
    });
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v2/intelligence/portfolio/:id
router.delete('/portfolio/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await removePortfolioItem(req.user.id, req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/projects/team-submissions
router.post('/projects/team-submissions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { projectId, teamName, teamMembers, repoUrl, liveDemoUrl } = req.body;
    const submission = await registerTeamSubmission(req.user.id, {
      projectId,
      teamName,
      teamMembers,
      repoUrl,
      liveDemoUrl
    });
    res.status(201).json({
      success: true,
      data: submission
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/projects/:id/ai-guidance
router.post('/projects/:id/ai-guidance', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const guidance = await getAiProjectMilestones(req.params.id);
    res.json({
      success: true,
      data: guidance
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/intelligence/instructor/submissions/:id/review
router.put('/instructor/submissions/:id/review', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { approved, notes, score } = req.body;
    const reviewResult = await reviewProjectByInstructor(req.params.id, req.user.id, {
      approved,
      notes,
      score,
      requestingUserRole: req.user.role
    });
    res.json({
      success: true,
      data: reviewResult
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/instructor/projects/insights
router.get('/instructor/projects/insights', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const insights = await getInstructorProjectInsights(req.user.id);
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/admin/projects/intelligence
router.get('/admin/projects/intelligence', protect, authorize('admin'), async (req, res, next) => {
  try {
    const intelligence = await getAdminProjectIntelligence();
    res.json({
      success: true,
      data: intelligence
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/guardian/students/:studentId/projects
router.get('/guardian/students/:studentId/projects', protect, authorize('guardian', 'admin'), async (req, res, next) => {
  try {
    const summary = await getGuardianProjectSummary(req.user.id, req.params.studentId);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

export default router;
