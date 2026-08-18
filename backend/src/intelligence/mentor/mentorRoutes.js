/**
 * EDOT Intelligence Domain - AI Mentor Router
 * Endpoints for context-aware chat, session history, and student feedback.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  executeMentorChat,
  getMentorSessions,
  getMentorSessionById,
  submitSessionFeedback
} from './mentorService.js';

const router = express.Router();

// POST /intelligence/mentor/chat or /api/v2/intelligence/mentor/chat
router.post('/chat', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { message, courseId, lessonId } = req.body;
    const result = await executeMentorChat(req.user.id, message, { courseId, lessonId });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/mentor/sessions or /api/v2/intelligence/mentor/sessions
router.get('/sessions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { limit } = req.query;
    const sessions = await getMentorSessions(req.user.id, limit);
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/mentor/sessions/:id or /api/v2/intelligence/mentor/sessions/:id
router.get('/sessions/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const session = await getMentorSessionById(req.user.id, req.params.id);
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/mentor/feedback or /api/v2/intelligence/mentor/feedback
router.post('/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { sessionId, feedbackScore, feedbackComment } = req.body;
    const updated = await submitSessionFeedback(req.user.id, sessionId, feedbackScore, feedbackComment);
    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
