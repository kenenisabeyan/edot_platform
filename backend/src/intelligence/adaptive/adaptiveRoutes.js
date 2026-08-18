/**
 * EDOT Intelligence Domain - Adaptive Learning Router
 * Endpoints for retrieving adaptive learning plans, paths, and submitting feedback.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  getAdaptiveLearningPlan,
  getAdaptivePath,
  submitAdaptiveFeedback
} from './adaptiveService.js';

const router = express.Router();

// GET /intelligence/learning-plan/me or /api/v2/intelligence/learning-plan/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const plan = await getAdaptiveLearningPlan(req.user.id);
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/adaptive-path/me or /api/v2/intelligence/adaptive-path/me
router.get('/adaptive-path/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const adaptivePath = await getAdaptivePath(req.user.id);
    res.json({
      success: true,
      data: adaptivePath
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/adaptive-plan/feedback or /api/v2/intelligence/adaptive-plan/feedback
router.post('/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { recommendationId, isHelpful, feedbackComment } = req.body;
    const updated = await submitAdaptiveFeedback(req.user.id, recommendationId, isHelpful, feedbackComment);
    res.json({
      success: true,
      message: 'Adaptive feedback recorded',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
