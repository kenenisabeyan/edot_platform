/**
 * EDOT Intelligence Domain - Analytics Engine Router
 * Serves Learner, Instructor, and Admin Platform Analytics.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  getLearnerAnalytics,
  getInstructorAnalytics,
  getAdminAnalyticsOverview,
  getAtRiskLearnersDTO
} from './analyticsService.js';

const router = express.Router();

// GET /intelligence/analytics/me or /api/v2/intelligence/analytics/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const analyticsData = await getLearnerAnalytics(req.user.id);
    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/analytics or /api/v2/intelligence/instructor/analytics
router.get('/instructor', protect, checkNotBlocked, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const analyticsData = await getInstructorAnalytics(req.user.id);
    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/analytics/overview or /api/v2/intelligence/admin/analytics/overview
router.get('/admin/overview', protect, checkNotBlocked, authorize('admin'), async (req, res, next) => {
  try {
    const overview = await getAdminAnalyticsOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/learners/at-risk or /api/v2/intelligence/analytics/at-risk
router.get('/at-risk', protect, checkNotBlocked, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const { limit } = req.query;
    const atRiskList = await getAtRiskLearnersDTO(limit);
    res.json({
      success: true,
      count: atRiskList.length,
      data: atRiskList
    });
  } catch (error) {
    next(error);
  }
});

export default router;
