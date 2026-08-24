/**
 * EDOT Intelligence — Phase 11
 * AI Mentor Router
 *
 * Exposes:
 *   POST   /mentor/chat                    — single-shot or multi-turn chat
 *   POST   /mentor/conversations           — start a new conversation
 *   GET    /mentor/conversations           — list all conversations
 *   GET    /mentor/conversations/:id       — get conversation with messages
 *   GET    /mentor/sessions                — list legacy session history
 *   GET    /mentor/sessions/:id            — get specific legacy session
 *   POST   /mentor/feedback                — submit session feedback
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  executeMentorChat,
  startConversation,
  listConversations,
  getConversation,
  getMentorSessions,
  getMentorSessionById,
  submitSessionFeedback
} from './mentorService.js';

const router = express.Router();

// ── Multi-Turn Chat ───────────────────────────────────────────────────────────

/**
 * POST /mentor/chat
 * Execute a context-aware AI Mentor chat turn.
 * Optionally continues an existing conversationId thread.
 */
router.post('/chat', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { message, courseId, lessonId, conversationId, inputType } = req.body;
    const result = await executeMentorChat(req.user.id, message, {
      courseId,
      lessonId,
      conversationId,
      inputType
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Conversation Management ───────────────────────────────────────────────────

/**
 * POST /mentor/conversations
 * Start a new mentor conversation session.
 */
router.post('/conversations', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId, lessonId, title, topic } = req.body;
    const conversation = await startConversation(req.user.id, {
      courseId,
      lessonId,
      title,
      topic
    });
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /mentor/conversations
 * List all conversations for the authenticated student.
 */
router.get('/conversations', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { limit } = req.query;
    const conversations = await listConversations(req.user.id, limit);
    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /mentor/conversations/:id
 * Get a specific conversation with its message history.
 */
router.get('/conversations/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { messageLimit } = req.query;
    const conversation = await getConversation(
      req.user.id,
      req.params.id,
      messageLimit
    );
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

// ── Legacy Session History ────────────────────────────────────────────────────

/**
 * GET /mentor/sessions
 * List legacy mentor session records for analytics.
 */
router.get('/sessions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { limit } = req.query;
    const sessions = await getMentorSessions(req.user.id, limit);
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /mentor/sessions/:id
 * Get a specific legacy mentor session by ID.
 */
router.get('/sessions/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const session = await getMentorSessionById(req.user.id, req.params.id);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /mentor/feedback
 * Submit student rating/feedback for a mentor session.
 */
router.post('/feedback', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { sessionId, feedbackScore, feedbackComment } = req.body;
    const updated = await submitSessionFeedback(
      req.user.id,
      sessionId,
      feedbackScore,
      feedbackComment
    );
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
