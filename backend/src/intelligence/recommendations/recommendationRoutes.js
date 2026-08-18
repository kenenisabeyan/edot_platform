/**
 * EDOT Intelligence Domain - Recommendation & Next Best Action Router
 * Endpoints for recommendations stream, dismissal, completion feedback, and Next Best Action resolution.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  getLearnerRecommendations,
  getNextBestAction,
  dismissRecommendation,
  completeRecommendation
} from './recommendationService.js';

const router = express.Router();

// GET /intelligence/recommendations/me or /api/v2/intelligence/recommendations/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const recommendations = await getLearnerRecommendations(req.user.id);
    res.json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/next-action/me or /api/v2/intelligence/next-action/me
router.get('/next-action/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const nextAction = await getNextBestAction(req.user.id);
    res.json({
      success: true,
      data: nextAction
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/recommendations/:id/dismiss or /api/v2/intelligence/recommendations/:id/dismiss
router.post('/:id/dismiss', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const updated = await dismissRecommendation(req.user.id, req.params.id);
    res.json({
      success: true,
      message: 'Recommendation dismissed',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/recommendations/:id/complete or /api/v2/intelligence/recommendations/:id/complete
router.post('/:id/complete', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const updated = await completeRecommendation(req.user.id, req.params.id);
    res.json({
      success: true,
      message: 'Recommendation marked as completed',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
