/**
 * EDOT Intelligence Domain - Product Experience Audit Router
 * REST API endpoints for experience telemetry, recommendation feedback, AI Mentor ratings,
 * journey health summaries, and admin product experience metrics.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  logExperienceEvent,
  evaluateJourneyHealth,
  recordRecommendationFeedback,
  recordAIMentorFeedback,
  detectFrictionSignals,
  getAdminProductExperienceHealth
} from './auditService.js';

const router = express.Router();

// POST /api/v2/intelligence/product-experience/events
router.post('/events', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { eventType, featureKey, journeyKey, metadata } = req.body;
    const event = await logExperienceEvent(req.user.id, { eventType, featureKey, journeyKey, metadata });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/product-experience/feedback
router.post('/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { recommendationId, feedbackType } = req.body;
    const feedback = await recordRecommendationFeedback(req.user.id, recommendationId, feedbackType);
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/product-experience/mentor-feedback
router.post('/mentor-feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { messageId, rating, reasonCategory } = req.body;
    const feedback = await recordAIMentorFeedback(req.user.id, messageId, rating, reasonCategory);
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/product-experience/friction
router.get('/friction', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const friction = await detectFrictionSignals(req.user.id);
    res.json({ success: true, count: friction.length, data: friction });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/product-experience/health
router.get('/health', protect, authorize('admin'), async (req, res, next) => {
  try {
    const health = await getAdminProductExperienceHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/product-experience/journeys
router.get('/journeys', protect, authorize('admin'), async (req, res, next) => {
  try {
    const journeys = await evaluateJourneyHealth();
    res.json({ success: true, data: journeys });
  } catch (error) {
    next(error);
  }
});

export default router;
