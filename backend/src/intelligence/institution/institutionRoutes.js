/**
 * EDOT Intelligence Domain - Institutional Cohort Router
 * Endpoints for institution overview, cohort performance analytics, and risk clusters.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getInstitutionalOverview, getCohortAnalytics } from './institutionService.js';

const router = express.Router();

// GET /intelligence/institution/overview
router.get('/overview', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const overview = await getInstitutionalOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/institution/cohorts/:cohortId/analytics
router.get('/cohorts/:cohortId/analytics', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const analytics = await getCohortAnalytics(req.params.cohortId);
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
});

export default router;
