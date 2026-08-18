/**
 * EDOT Intelligence Domain - Intelligent Nudges Router
 * Endpoints for active nudge retrieval, signal evaluation with anti-fatigue controls, dismissal, and helpfulness feedback.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  evaluateAndGenerateNudges,
  getUserActiveNudges,
  dismissNudge,
  rateNudgeHelpfulness
} from './nudgeService.js';

const router = express.Router();

// GET /intelligence/nudges/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const nudges = await getUserActiveNudges(req.user.id);
    res.json({
      success: true,
      count: nudges.length,
      data: nudges
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/nudges/evaluate
router.post('/evaluate', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await evaluateAndGenerateNudges(req.user.id, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// PUT /intelligence/nudges/:id/dismiss
router.put('/:id/dismiss', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await dismissNudge(req.params.id, req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/nudges/:id/rate
router.post('/:id/rate', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { rating } = req.body;
    const result = await rateNudgeHelpfulness(req.params.id, req.user.id, rating);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
