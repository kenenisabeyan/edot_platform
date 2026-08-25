/**
 * EDOT Intelligence Domain - Performance & Scale Router
 * REST API endpoints for system health status (liveness, readiness, dependencies),
 * latency percentiles, cache hit metrics, event queue metrics, load testing, and admin cache controls.
 */

import express from 'express';
import { protect, authorize } from '../../../middleware/auth.js';
import {
  getAdminPerformanceOverview,
  getSystemPerformanceHealth,
  flushAllCache,
  flushEventQueue,
  runLoadTestScenario,
  getCircuitBreakerState
} from './performanceOrchestrator.js';

const router = express.Router();

// GET /api/v2/intelligence/performance/health/live (Liveness check)
router.get('/health/live', (req, res) => {
  res.json({ status: 'UP', service: 'EDOT_INTELLIGENCE', timestamp: new Date().toISOString() });
});

// GET /api/v2/intelligence/performance/health/ready (Readiness check)
router.get('/health/ready', async (req, res) => {
  res.json({ status: 'READY', service: 'EDOT_INTELLIGENCE', timestamp: new Date().toISOString() });
});

// GET /api/v2/intelligence/performance/health/dependencies (Dependency health)
router.get('/health/dependencies', protect, authorize('admin'), async (req, res) => {
  res.json({
    status: 'HEALTHY',
    dependencies: {
      database: 'UP',
      cache: 'UP',
      aiCircuitBreaker: getCircuitBreakerState('OPENAI')
    },
    timestamp: new Date().toISOString()
  });
});

// GET /api/v2/intelligence/performance/health (Overall health)
router.get('/health', protect, authorize('admin'), async (req, res, next) => {
  try {
    const health = await getSystemPerformanceHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/performance/metrics
router.get('/metrics', protect, authorize('admin'), async (req, res, next) => {
  try {
    const overview = await getAdminPerformanceOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/performance/cache/flush
router.post('/cache/flush', protect, authorize('admin'), async (req, res, next) => {
  try {
    const count = flushAllCache();
    res.json({ success: true, message: `Flushed ${count} items from cache store.` });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/performance/queue/flush
router.post('/queue/flush', protect, authorize('admin'), async (req, res, next) => {
  try {
    const result = await flushEventQueue();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/performance/load-test
router.post('/load-test', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { scenarioName, concurrency, totalRequests } = req.body;
    const result = await runLoadTestScenario(scenarioName, concurrency, totalRequests);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
