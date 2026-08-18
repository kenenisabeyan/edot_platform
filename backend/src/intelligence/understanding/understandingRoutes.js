/**
 * EDOT Intelligence Domain - Understanding & Misconception Router
 * Endpoints for concept explanation analysis and evaluation history.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { analyzeConceptExplanation, getUserUnderstandingHistory } from './understandingService.js';

const router = express.Router();

// POST /intelligence/understanding/analyze
router.post('/analyze', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { conceptName, explanationText } = req.body;
    if (!explanationText) {
      return res.status(400).json({ success: false, message: 'explanationText is required' });
    }
    const analysis = await analyzeConceptExplanation(req.user.id, conceptName || 'Flexbox', explanationText);
    res.status(201).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/understanding/history
router.get('/history', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const history = await getUserUnderstandingHistory(req.user.id);
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

export default router;
