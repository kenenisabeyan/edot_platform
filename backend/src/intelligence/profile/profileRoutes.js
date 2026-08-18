/**
 * EDOT Intelligence Domain - Learner Profile Router
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getFullLearnerProfile, syncLearnerProfile, upsertSkillNode } from './profileService.js';

const router = express.Router();

// GET /api/v2/intelligence/profile/me - Fetch full dynamic learner profile
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const profile = await getFullLearnerProfile(req.user.id);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/profile/sync - Trigger on-demand profile resynchronization
router.post('/sync', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const profile = await syncLearnerProfile(req.user.id);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/profile/skills - Update or add skill node in skill graph
router.post('/skills', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const skill = await upsertSkillNode(req.user.id, req.body);
    res.json({
      success: true,
      data: skill
    });
  } catch (error) {
    next(error);
  }
});

export default router;
