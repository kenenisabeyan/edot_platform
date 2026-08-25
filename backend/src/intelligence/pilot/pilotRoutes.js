/**
 * EDOT Intelligence Domain - Real-World Pilot Router
 * REST API endpoints for pilot program management, cohorts, voluntary student join/withdraw,
 * contextual feedback, issue tracking, hypothesis testing, and Pilot Command Center analytics.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  createPilotProgram,
  updatePilotStatus,
  createPilotCohort,
  joinPilotProgram,
  withdrawFromPilot,
  recordPilotFeedback,
  createPilotIssue,
  updateIssueStatus,
  createPilotHypothesis,
  evaluatePilotHypothesis,
  getPilotInsights,
  generatePilotValidationReport,
  getPilotCommandCenterOverview
} from './pilotService.js';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// GET /api/v2/pilots
router.get('/', protect, async (req, res, next) => {
  try {
    const pilots = await prisma.pilotProgram.findMany({
      where: req.user.role === 'admin' ? {} : { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, count: pilots.length, data: pilots });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/pilots/overview (Admin Command Center)
router.get('/overview', protect, authorize('admin'), async (req, res, next) => {
  try {
    const overview = await getPilotCommandCenterOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots
router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const pilot = await createPilotProgram({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: pilot });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/pilots/:id/status
router.put('/:id/status', protect, authorize('admin'), async (req, res, next) => {
  try {
    const pilot = await updatePilotStatus(req.params.id, req.body.status);
    res.json({ success: true, data: pilot });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots/:id/cohorts
router.post('/:id/cohorts', protect, authorize('admin'), async (req, res, next) => {
  try {
    const cohort = await createPilotCohort(req.params.id, req.body);
    res.status(201).json({ success: true, data: cohort });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots/:id/join
router.post('/:id/join', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const participation = await joinPilotProgram(req.user.id, req.params.id, req.body);
    res.status(201).json({ success: true, data: participation });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots/:id/withdraw
router.post('/:id/withdraw', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const withdrawal = await withdrawFromPilot(req.user.id, req.params.id);
    res.json({ success: true, data: withdrawal });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots/:id/feedback
router.post('/:id/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await recordPilotFeedback(req.user.id, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/pilots/:id/insights
router.get('/:id/insights', protect, authorize('admin'), async (req, res, next) => {
  try {
    const insights = await getPilotInsights(req.params.id);
    res.json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots/:id/issues
router.post('/:id/issues', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const issue = await createPilotIssue({
      pilotProgramId: req.params.id,
      ...req.body,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/pilots/issues/:issueId/status
router.put('/issues/:issueId/status', protect, authorize('admin'), async (req, res, next) => {
  try {
    const updated = await updateIssueStatus(req.params.issueId, req.body.status);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/pilots/:id/hypotheses
router.post('/:id/hypotheses', protect, authorize('admin'), async (req, res, next) => {
  try {
    const hypothesis = await createPilotHypothesis(req.params.id, req.body.statement);
    res.status(201).json({ success: true, data: hypothesis });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/pilots/hypotheses/:hypothesisId/evaluate
router.put('/hypotheses/:hypothesisId/evaluate', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { status, evidenceSummary } = req.body;
    const evaluated = await evaluatePilotHypothesis(req.params.hypothesisId, status, evidenceSummary);
    res.json({ success: true, data: evaluated });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/pilots/:id/report
router.get('/:id/report', protect, authorize('admin'), async (req, res, next) => {
  try {
    const report = await generatePilotValidationReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

export default router;
