/**
 * EDOT Intelligence Domain - Production Health, Metrics & Readiness Router
 * Exposes health checks, AI status, dead-letter queue monitoring, cost metrics,
 * production readiness audit, graceful degradation status, and usage metrics.
 */

import express from 'express';
import { getHealthStatus, getDeadLetterQueue } from './healthCheckService.js';
import {
  runProductionReadinessAudit,
  getDegradationState,
  isAiAvailable
} from './productionReadinessEngine.js';

const router = express.Router();

// GET /intelligence/health
router.get('/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    const degradation = getDegradationState();
    health.gracefulDegradation = degradation;
    const httpStatus = health.status === 'UP' ? 200 : 503;
    res.status(httpStatus).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      error: error.message
    });
  }
});

// GET /intelligence/metrics
router.get('/metrics', async (req, res) => {
  try {
    const health = await getHealthStatus();
    res.json({
      success: true,
      data: health.metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /intelligence/dead-letters
router.get('/dead-letters', async (req, res) => {
  try {
    const deadLetters = getDeadLetterQueue();
    res.json({
      success: true,
      count: deadLetters.length,
      data: deadLetters
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /intelligence/production-readiness
router.get('/production-readiness', async (req, res) => {
  try {
    const audit = await runProductionReadinessAudit();
    const httpStatus = audit.productionReady ? 200 : 503;
    res.status(httpStatus).json({
      success: true,
      data: audit
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /intelligence/ai-status
router.get('/ai-status', async (req, res) => {
  try {
    const degradation = getDegradationState();
    res.json({
      success: true,
      data: {
        aiAvailable: isAiAvailable(),
        ...degradation,
        fallbackCapabilities: {
          coreLearning: 'FULLY_OPERATIONAL',
          courseAccess: 'FULLY_OPERATIONAL',
          progressTracking: 'FULLY_OPERATIONAL',
          deterministicRecommendations: 'FULLY_OPERATIONAL',
          aiMentor: isAiAvailable() ? 'AI_POWERED' : 'DETERMINISTIC_FALLBACK',
          aiPractice: isAiAvailable() ? 'AI_POWERED' : 'TEMPLATE_BASED_FALLBACK',
          nudges: 'FULLY_OPERATIONAL',
          feedback: 'FULLY_OPERATIONAL'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
