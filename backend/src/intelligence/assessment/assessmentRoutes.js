/**
 * EDOT Intelligence Domain - Assessment Intelligence Router
 * Endpoints for submission analysis, learner report retrieval, and instructor quality telemetry.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  analyzeAssessmentSubmission,
  getLearnerAssessmentReport,
  getInstructorAssessmentIntelligence
} from './assessmentService.js';

const router = express.Router();

// POST /intelligence/assessment/analyze
router.post('/analyze', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await analyzeAssessmentSubmission(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/assessment/:id/learner-report
router.get('/:id/learner-report', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const report = await getLearnerAssessmentReport(req.user.id, req.params.id);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/assessment/:id/intelligence
router.get('/instructor/:id/intelligence', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const telemetry = await getInstructorAssessmentIntelligence(req.params.id);
    res.json({
      success: true,
      data: telemetry
    });
  } catch (error) {
    next(error);
  }
});

export default router;
