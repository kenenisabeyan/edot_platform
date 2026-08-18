/**
 * EDOT Intelligence Domain - Recommendation Router
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getPersonalizedRecommendations, recordRecommendationFeedback } from './recommendationService.js';

const router = express.Router();

// GET /api/v2/intelligence/recommendations/me - Get personalized recommendation bundle
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const recommendations = await getPersonalizedRecommendations(req.user.id);
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/recommendations/feedback - Log user reaction to recommendations
router.post('/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await recordRecommendationFeedback(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
