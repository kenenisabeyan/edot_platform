/**
 * EDOT Intelligence Domain - Comprehensive Evaluation Router
 * Endpoints for running benchmark suites, retrieving quality reports, and evaluating individual AI responses.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { evaluateAiQuality, runIntelligenceBenchmarkSuite } from './intelligenceEvaluator.js';

const router = express.Router();

// POST /intelligence/evaluation/benchmark
router.post('/benchmark', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const report = runIntelligenceBenchmarkSuite();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/evaluation/latest-report
router.get('/latest-report', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const report = runIntelligenceBenchmarkSuite();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/evaluation/evaluate-output
router.post('/evaluate-output', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { query, response, context } = req.body;
    const scoreReport = evaluateAiQuality({ query, response, context });
    res.json({
      success: true,
      data: scoreReport
    });
  } catch (error) {
    next(error);
  }
});

export default router;
