/**
 * EDOT Intelligence Domain - Global Opportunity & Ecosystem Router
 * REST API endpoints for opportunity ingestion, explainable matching, requirement gap analysis,
 * preparation plans, application tracking, partner ecosystem, student consent, and role-based insights.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  ingestOpportunityFromSource,
  getRecommendedOpportunities,
  analyzeRequirementGaps,
  getOpportunityPreparationPlan,
  saveOpportunity,
  updateApplicationStatus,
  getStudentApplications,
  createPartnerOrganization,
  updatePartnerStatus,
  updateStudentConsent,
  getStudentConsents,
  recordOpportunityInteraction,
  getInstructorOpportunityInsights,
  getAdminOpportunityIntelligence,
  getGuardianOpportunitySummary
} from './opportunityService.js';

const router = express.Router();

// POST /api/v2/intelligence/opportunities/ingest
router.post('/ingest', protect, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const { sourceType, rawData, partnerId, confidenceStatus } = req.body;
    const result = await ingestOpportunityFromSource(sourceType, rawData, { partnerId, confidenceStatus });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/recommended
router.get('/recommended', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const opportunities = await getRecommendedOpportunities(req.user.id);
    res.json({ success: true, count: opportunities.length, data: opportunities });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/:id/gap-analysis
router.get('/:id/gap-analysis', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const analysis = await analyzeRequirementGaps(req.user.id, req.params.id);
    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/:id/preparation-plan
router.get('/:id/preparation-plan', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const plan = await getOpportunityPreparationPlan(req.user.id, req.params.id);
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/opportunities/:id/save
router.post('/:id/save', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const application = await saveOpportunity(req.user.id, req.params.id);
    res.status(201).json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/opportunities/applications/:id/status
router.post('/applications/:id/status', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const updated = await updateApplicationStatus(req.params.id, req.user.id, {
      status,
      notes,
      requestingUserRole: req.user.role
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/applications
router.get('/applications', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const applications = await getStudentApplications(req.user.id);
    res.json({ success: true, count: applications.length, data: applications });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/opportunities/partners
router.post('/partners', protect, authorize('admin'), async (req, res, next) => {
  try {
    const partner = await createPartnerOrganization(req.body);
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/intelligence/opportunities/partners/:id/status
router.put('/partners/:id/status', protect, authorize('admin'), async (req, res, next) => {
  try {
    const partner = await updatePartnerStatus(req.params.id, req.body.status);
    res.json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/opportunities/consent
router.post('/consent', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { consentType, granted } = req.body;
    const consent = await updateStudentConsent(req.user.id, consentType, granted);
    res.json({ success: true, data: consent });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/consent
router.get('/consent', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const consents = await getStudentConsents(req.user.id);
    res.json({ success: true, data: consents });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/opportunities/:id/interaction
router.post('/:id/interaction', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const interaction = await recordOpportunityInteraction(req.user.id, req.params.id, req.body.interactionType);
    res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/instructor/insights
router.get('/instructor/insights', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const insights = await getInstructorOpportunityInsights(req.user.id);
    res.json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/admin/intelligence
router.get('/admin/intelligence', protect, authorize('admin'), async (req, res, next) => {
  try {
    const intelligence = await getAdminOpportunityIntelligence();
    res.json({ success: true, data: intelligence });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/opportunities/guardian/students/:studentId/summary
router.get('/guardian/students/:studentId/summary', protect, authorize('guardian', 'admin'), async (req, res, next) => {
  try {
    const summary = await getGuardianOpportunitySummary(req.user.id, req.params.studentId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

export default router;
