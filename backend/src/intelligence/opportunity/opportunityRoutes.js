/**
 * EDOT Intelligence Domain - Opportunity Router
 * Endpoints for verified learner opportunity matching and evaluation.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getUserOpportunityMatches, getOpportunityMatchById } from './opportunityService.js';

const router = express.Router();

// GET /intelligence/opportunities/me or /api/v2/intelligence/opportunities/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const matches = await getUserOpportunityMatches(req.user.id);
    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/opportunities/:id/match or /api/v2/intelligence/opportunities/:id/match
router.get('/:id/match', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const match = await getOpportunityMatchById(req.user.id, req.params.id);
    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    next(error);
  }
});

export default router;
