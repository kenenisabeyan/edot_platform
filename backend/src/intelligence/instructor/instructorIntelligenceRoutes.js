/**
 * EDOT Intelligence Domain - Instructor Intelligence Router
 * Endpoints for instructor action dashboards, at-risk student clusters, weak topics, and misconception tracking.
 */

import express from 'express';
import { protect, authorize } from '../../../middleware/auth.js';
import {
  getTeachingOverview,
  getStudentsNeedingSupport,
  getDifficultConcepts,
  getCourseHealthSummary
} from './instructorIntelligenceService.js';

const router = express.Router();

// GET /instructor/intelligence/overview
router.get('/overview', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const overview = await getTeachingOverview(req.user.id);
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/intelligence/at-risk
router.get('/at-risk', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const atRisk = await getStudentsNeedingSupport(req.user.id);
    res.json({
      success: true,
      count: Array.isArray(atRisk) ? atRisk.length : 0,
      data: atRisk
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/intelligence/struggling-topics
router.get('/struggling-topics', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const topics = await getDifficultConcepts(req.user.id);
    res.json({
      success: true,
      count: Array.isArray(topics) ? topics.length : 0,
      data: topics
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/intelligence/recommended-actions
router.get('/recommended-actions', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const actions = await getCourseHealthSummary(req.user.id);
    res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    next(error);
  }
});

export default router;
