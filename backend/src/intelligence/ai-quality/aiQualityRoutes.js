/**
 * EDOT Intelligence Domain - AI Quality Router
 * REST API endpoints for AI Quality Center metrics, student feedback, AI incidents,
 * evaluation datasets, model evaluation runs, and regression detection.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../middleware/auth.js';
import {
  getAIQualityCenterOverview,
  recordAIFeedback,
  createAIIncident,
  updateIncidentStatus,
  createAIEvaluationDataset,
  addAIEvaluationCase,
  runModelEvaluation,
  detectModelRegression
} from './aiQualityOrchestrator.js';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// GET /api/v2/intelligence/ai-quality/overview (Admin Quality Center)
router.get('/overview', protect, authorize('admin'), async (req, res, next) => {
  try {
    const overview = await getAIQualityCenterOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/ai-quality/metrics
router.get('/metrics', protect, authorize('admin'), async (req, res, next) => {
  try {
    const [evaluations, feedbacks] = await Promise.all([
      prisma.aIQualityEvaluation.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
      prisma.aIFeedback.findMany({ take: 100, orderBy: { createdAt: 'desc' } })
    ]);
    res.json({ success: true, data: { evaluationsCount: evaluations.length, feedbacksCount: feedbacks.length, evaluations, feedbacks } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/ai-quality/incidents
router.get('/incidents', protect, authorize('admin'), async (req, res, next) => {
  try {
    const incidents = await prisma.aIIncident.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: incidents.length, data: incidents });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/ai-quality/incidents
router.post('/incidents', protect, authorize('admin'), async (req, res, next) => {
  try {
    const result = await createAIIncident({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/intelligence/ai-quality/incidents/:id
router.put('/incidents/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const updated = await updateIncidentStatus(req.params.id, req.body.status);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/ai-quality/feedback (Student AI Feedback)
router.post('/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { interactionId, feedbackType, comment } = req.body;
    const feedback = await recordAIFeedback(req.user.id, interactionId, { feedbackType, comment });
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/ai-quality/datasets
router.post('/datasets', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const dataset = await createAIEvaluationDataset(name, description, req.user.id);
    res.status(201).json({ success: true, data: dataset });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/ai-quality/datasets/:id/cases
router.post('/datasets/:id/cases', protect, authorize('admin'), async (req, res, next) => {
  try {
    const evaluationCase = await addAIEvaluationCase(req.params.id, req.body);
    res.status(201).json({ success: true, data: evaluationCase });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/ai-quality/evaluation-runs
router.post('/evaluation-runs', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { datasetId, modelProvider, modelVersion } = req.body;
    const run = await runModelEvaluation(datasetId, { modelProvider, modelVersion });
    res.status(201).json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/ai-quality/regression-check
router.post('/regression-check', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { baselineRunId, candidateRunId } = req.body;
    const result = await detectModelRegression(baselineRunId, candidateRunId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
