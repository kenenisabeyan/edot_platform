/**
 * EDOT Intelligence Domain - Goal Intelligence Router
 * Endpoints for goal creation, active roadmap retrieval, goal modification, and roadmap refresh.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  createOrUpdateGoal,
  getLearnerActiveGoalAndRoadmap,
  modifyGoal
} from './goalService.js';

const router = express.Router();

// POST /intelligence/goals
router.post('/', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { goalText, category, targetDate } = req.body;
    if (!goalText) {
      return res.status(400).json({ success: false, message: 'goalText is required' });
    }
    const result = await createOrUpdateGoal(req.user.id, { goalText, category, targetDate });
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/goals/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await getLearnerActiveGoalAndRoadmap(req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// PUT /intelligence/goals/:id
router.put('/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await modifyGoal(req.params.id, req.user.id, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/goals/:id/refresh-roadmap
router.post('/:id/refresh-roadmap', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await modifyGoal(req.params.id, req.user.id, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
