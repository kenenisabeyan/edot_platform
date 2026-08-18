/**
 * EDOT Intelligence Domain - Intelligence Feedback Loops Router
 * Endpoints for recording feedback, fetching analytics summaries, and performing feedback-aware item re-ranking.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  recordIntelligenceFeedback,
  getFeedbackAnalyticsSummary,
  getAdjustedRankingForItems
} from './feedbackService.js';

const router = express.Router();

// POST /intelligence/feedback
router.post('/', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const feedback = await recordIntelligenceFeedback(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/feedback/analytics
router.get('/analytics', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { domain } = req.query;
    const summary = await getFeedbackAnalyticsSummary(domain || null);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/feedback/rank-items
router.post('/rank-items', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { domain, items } = req.body;
    const ranked = await getAdjustedRankingForItems(req.user.id, domain || 'RECOMMENDATION', items || []);
    res.json({
      success: true,
      data: ranked
    });
  } catch (error) {
    next(error);
  }
});

export default router;
