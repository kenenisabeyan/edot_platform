/**
 * EDOT Intelligence — Phase 23
 * AI Mentor Router
 *
 * RESTful APIs for real conversation persistence, multimodal interaction (Text, Voice, Video),
 * soft deletion, archiving, title editing, and security ownership enforcement.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  executeMentorChat,
  executeVoiceMentorTurn,
  executeVideoMentorTurn,
  startConversation,
  listConversations,
  getConversation,
  updateConversationTitle,
  archiveConversation,
  restoreConversation,
  deleteConversation,
  deleteMessage,
  getMentorSessions,
  getMentorSessionById,
  submitSessionFeedback
} from './mentorService.js';

const router = express.Router();

// ── Multi-Turn Chat (Text & Idempotency) ──────────────────────────────────────

/**
 * POST /mentor/chat
 * Execute a context-aware AI Mentor chat turn.
 */
router.post('/chat', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { message, courseId, lessonId, conversationId, clientMessageId, inputType } = req.body;
    const result = await executeMentorChat(req.user.id, message, {
      courseId,
      lessonId,
      conversationId,
      clientMessageId,
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
    const { courseId, lessonId, title, topic, conversationType } = req.body;
    const conversation = await startConversation(req.user.id, {
      courseId,
      lessonId,
      title,
      topic,
      conversationType
    });
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /mentor/conversations
 * List conversations for authenticated student (supports status='ACTIVE'|'ARCHIVED'|'ALL', search, limit).
 */
router.get('/conversations', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { limit, status, search } = req.query;
    const conversations = await listConversations(req.user.id, { limit, status, search });
    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /mentor/conversations/:id
 * Get a specific conversation with non-deleted message history.
 */
router.get('/conversations/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { messageLimit } = req.query;
    const conversation = await getConversation(req.user.id, req.params.id, messageLimit);
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /mentor/conversations/:id
 * Rename / update title of a conversation.
 */
router.patch('/conversations/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { title } = req.body;
    const updated = await updateConversationTitle(req.user.id, req.params.id, title);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /mentor/conversations/:id/archive
 * Archive a conversation.
 */
router.post('/conversations/:id/archive', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const updated = await archiveConversation(req.user.id, req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /mentor/conversations/:id/restore
 * Restore an archived conversation back to active.
 */
router.post('/conversations/:id/restore', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const updated = await restoreConversation(req.user.id, req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /mentor/conversations/:id
 * Soft-delete a conversation and its messages.
 */
router.delete('/conversations/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const deleted = await deleteConversation(req.user.id, req.params.id);
    res.json({ success: true, data: deleted });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /mentor/conversations/:id/messages/:messageId
 * Soft-delete an individual message.
 */
router.delete('/conversations/:id/messages/:messageId', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const deleted = await deleteMessage(req.user.id, req.params.id, req.params.messageId);
    res.json({ success: true, data: deleted });
  } catch (error) {
    next(error);
  }
});

// ── Multimodal Voice & Video Turns ────────────────────────────────────────────

/**
 * POST /mentor/conversations/:id/voice
 * Submit a voice turn with audioUrl and transcript.
 */
router.post('/conversations/:id/voice', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { audioUrl, transcript, prompt, clientMessageId, courseId, lessonId } = req.body;
    const result = await executeVoiceMentorTurn(req.user.id, {
      conversationId: req.params.id,
      audioUrl,
      transcript,
      prompt,
      clientMessageId,
      courseId,
      lessonId
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /mentor/conversations/:id/video
 * Submit a video turn with videoUrl and transcript.
 */
router.post('/conversations/:id/video', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { videoUrl, transcript, prompt, clientMessageId, courseId, lessonId } = req.body;
    const result = await executeVideoMentorTurn(req.user.id, {
      conversationId: req.params.id,
      videoUrl,
      transcript,
      prompt,
      clientMessageId,
      courseId,
      lessonId
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Legacy Session History ────────────────────────────────────────────────────

router.get('/sessions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { limit } = req.query;
    const sessions = await getMentorSessions(req.user.id, limit);
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:id', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const session = await getMentorSessionById(req.user.id, req.params.id);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

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
