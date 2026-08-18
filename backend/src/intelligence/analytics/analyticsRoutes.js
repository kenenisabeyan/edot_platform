/**
 * EDOT Intelligence Domain - Analytics Router
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import { getLearnerAnalytics, recalculateLearnerAnalytics, getAtRiskLearners } from './analyticsService.js';

const router = express.Router();

// GET /api/v2/intelligence/analytics/me - Student's learning analytics & risk overview
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const report = await getLearnerAnalytics(req.user.id);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/analytics/recalculate - Force refresh analytics
router.post('/recalculate', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const report = await recalculateLearnerAnalytics(req.user.id);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/analytics/at-risk - Admin view of at-risk students
router.get('/at-risk', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { limit } = req.query;
    const learners = await getAtRiskLearners(limit);
    res.json({
      success: true,
      data: learners
    });
  } catch (error) {
    next(error);
  }
});

export default router;
