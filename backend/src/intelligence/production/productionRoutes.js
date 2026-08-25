/**
 * EDOT Intelligence Domain - Production Launch Router
 * REST API endpoints for production readiness evaluation, AI cost governance,
 * feature flag toggling, and operational platform health monitoring.
 */

import express from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import {
  evaluateProductionReadiness,
  getAiGovernanceSummary,
  getAllFeatureFlags,
  setFeatureFlagState,
  getProductionLaunchOverview
} from './productionOrchestrator.js';

const router = express.Router();

// GET /api/v2/intelligence/production/readiness
router.get('/readiness', protect, authorize('admin'), async (req, res, next) => {
  try {
    const readiness = await evaluateProductionReadiness();
    res.json({ success: true, data: readiness });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/production/governance
router.get('/governance', protect, authorize('admin'), async (req, res, next) => {
  try {
    const summary = getAiGovernanceSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/production/feature-flags
router.get('/feature-flags', protect, authorize('admin'), async (req, res, next) => {
  try {
    const flags = getAllFeatureFlags();
    res.json({ success: true, data: flags });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/production/feature-flags/toggle
router.post('/feature-flags/toggle', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { featureName, state } = req.body;
    const result = setFeatureFlagState(featureName, state);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/production/overview
router.get('/overview', protect, authorize('admin'), async (req, res, next) => {
  try {
    const overview = await getProductionLaunchOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

export default router;
