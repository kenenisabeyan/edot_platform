/**
 * EDOT Intelligence Domain - Career Intelligence Router
 * Endpoints for career path catalog, learner skill gap analysis, and dynamic learning roadmaps.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getAvailableCareerPaths, getUserCareerTargets, getLearnerCareerGapAnalysis } from './careerService.js';

const router = express.Router();

// GET /intelligence/career/paths
router.get('/paths', async (req, res, next) => {
  try {
    const paths = await getAvailableCareerPaths();
    res.json({
      success: true,
      count: paths.length,
      data: paths
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/career/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const careerTarget = await getUserCareerTargets(req.user.id);
    res.json({
      success: true,
      data: careerTarget
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/career/:id/gap-analysis
router.get('/:id/gap-analysis', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const gapAnalysis = await getLearnerCareerGapAnalysis(req.user.id, req.params.id);
    res.json({
      success: true,
      data: gapAnalysis
    });
  } catch (error) {
    next(error);
  }
});

export default router;
