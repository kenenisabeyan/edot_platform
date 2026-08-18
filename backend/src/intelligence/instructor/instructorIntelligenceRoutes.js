/**
 * EDOT Intelligence Domain - Instructor Intelligence Router
 * Endpoints for instructor action dashboards, at-risk student clusters, weak topics, and misconception tracking.
 */

import express from 'express';
import { protect, authorize } from '../../../middleware/auth.js';
import {
  getInstructorIntelligenceOverview,
  getInstructorAtRiskLearners,
  getInstructorStrugglingTopics,
  getInstructorRecommendedActions
} from './instructorIntelligenceService.js';

const router = express.Router();

// GET /instructor/intelligence/overview
router.get('/overview', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const overview = await getInstructorIntelligenceOverview(req.user.id);
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
    const atRisk = await getInstructorAtRiskLearners(req.user.id);
    res.json({
      success: true,
      count: atRisk.length,
      data: atRisk
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/intelligence/struggling-topics
router.get('/struggling-topics', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const topics = await getInstructorStrugglingTopics(req.user.id);
    res.json({
      success: true,
      count: topics.length,
      data: topics
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/intelligence/recommended-actions
router.get('/recommended-actions', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const actions = await getInstructorRecommendedActions(req.user.id);
    res.json({
      success: true,
      count: actions.length,
      data: actions
    });
  } catch (error) {
    next(error);
  }
});

export default router;
