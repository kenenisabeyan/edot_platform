/**
 * EDOT Intelligence Domain - AI Practice Router
 * Endpoints for generating practice sessions, submitting answers, retrieving session detail, and instructor review.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  createPracticeSession,
  evaluatePracticeSession,
  getPracticeSession,
  reviewPracticeSessionByInstructor
} from './practiceService.js';

const router = express.Router();

// POST /intelligence/practice/generate
router.post('/generate', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const session = await createPracticeSession(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/practice/evaluate
router.post('/evaluate', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { sessionId, answers } = req.body;
    if (!sessionId || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'sessionId and answers array are required' });
    }
    const result = await evaluatePracticeSession(sessionId, answers);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/practice/session/:id
router.get('/session/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const session = await getPracticeSession(req.params.id);
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

// PUT /instructor/practice/:id/review
router.put('/instructor/:id/review', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { approved, notes } = req.body;
    const reviewResult = await reviewPracticeSessionByInstructor(req.params.id, req.user.id, approved, notes);
    res.json({
      success: true,
      data: reviewResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;
