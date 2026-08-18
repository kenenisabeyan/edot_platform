/**
 * EDOT Intelligence Domain - Production Health & Metrics Router
 * Exposes health checks, AI status, dead-letter queue monitoring, and cost metrics.
 */

import express from 'express';
import { getHealthStatus, getDeadLetterQueue } from './healthCheckService.js';

const router = express.Router();

// GET /intelligence/health or /api/v2/intelligence/health
router.get('/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    const httpStatus = health.status === 'UP' ? 200 : 503;
    res.status(httpStatus).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      error: error.message
    });
  }
});

// GET /intelligence/metrics or /api/v2/intelligence/metrics
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

// GET /intelligence/dead-letters or /api/v2/intelligence/dead-letters
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

export default router;
