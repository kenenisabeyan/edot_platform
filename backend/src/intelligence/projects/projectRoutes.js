/**
 * EDOT Intelligence Domain - Project & Portfolio Router
 * Endpoints for project recommendations, artifact submission, AI project guidance, portfolio retrieval, and instructor review.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  getRecommendedProjects,
  getAiProjectMilestones,
  submitProjectArtifact,
  getLearnerPortfolio,
  reviewProjectByInstructor
} from './projectService.js';

const router = express.Router();

// GET /intelligence/projects/recommendations/me
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

// POST /intelligence/projects/submissions
router.post('/projects/submissions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { projectId, repoUrl, liveDemoUrl } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required' });
    }
    const submission = await submitProjectArtifact(req.user.id, { projectId, repoUrl, liveDemoUrl });
    res.status(201).json({
      success: true,
      data: submission
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/portfolio/me
router.get('/portfolio/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const portfolio = await getLearnerPortfolio(req.user.id);
    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/projects/:id/ai-guidance
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

// PUT /instructor/projects/submissions/:id/review
router.put('/instructor/submissions/:id/review', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { approved, notes } = req.body;
    const reviewResult = await reviewProjectByInstructor(req.params.id, req.user.id, approved, notes);
    res.json({
      success: true,
      data: reviewResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;
