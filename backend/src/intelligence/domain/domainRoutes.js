/**
 * EDOT Intelligence Domain - Dynamic Learning Domains Router
 * REST API endpoints for fetching active learning domains with live content counts
 * and creating new learning domains dynamically.
 */

import express from 'express';
import { protect, authorize } from '../../../middleware/auth.js';
import {
  getActiveLearningDomains,
  createLearningDomain
} from './domainService.js';

const router = express.Router();

// GET /api/v2/intelligence/domains
router.get('/', async (req, res, next) => {
  try {
    const domains = await getActiveLearningDomains();
    res.json({ success: true, data: domains });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/domains
router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const domain = await createLearningDomain(req.body);
    res.json({ success: true, data: domain });
  } catch (error) {
    next(error);
  }
});

export default router;
