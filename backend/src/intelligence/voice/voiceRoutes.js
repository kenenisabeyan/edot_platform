/**
 * EDOT Intelligence — Phase 23
 * Voice Mentorship Router
 * voiceRoutes.js
 *
 * RESTful APIs and SSE streaming endpoints for real-time voice sessions,
 * voice interactions, barge-in cancellation, and mode switching.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { VoiceOrchestrator } from './voiceOrchestrator.js';

const router = express.Router();

/**
 * POST /voice/session/start
 * Start or resume a voice learning session.
 */
router.post('/session/start', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId, sectionId, lessonId, mode, voiceStyle, explanationStyle, speakingSpeed, speechLanguage } = req.body;
    const sessionData = await VoiceOrchestrator.startSession({
      userId: req.user.id,
      courseId,
      sectionId,
      lessonId,
      mode,
      voiceStyle,
      explanationStyle,
      speakingSpeed,
      speechLanguage
    });
    res.json({ success: true, data: sessionData });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /voice/session/:id/resume
 * Resume an existing voice session.
 */
router.get('/session/:id/resume', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const sessionData = await VoiceOrchestrator.resumeSession({
      sessionId: req.params.id,
      userId: req.user.id
    });
    if (!sessionData) {
      return res.status(404).json({ success: false, message: 'Voice session not found' });
    }
    res.json({ success: true, data: sessionData });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /voice/interact
 * Process a voice/text interaction turn (Request-Response mode).
 */
router.post('/interact', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const {
      sessionId,
      conversationId,
      transcript,
      audioBase64,
      inputType,
      courseId,
      sectionId,
      lessonId,
      mode,
      voiceStyle,
      explanationStyle,
      speakingSpeed,
      speechLanguage
    } = req.body;

    const result = await VoiceOrchestrator.processInteraction({
      userId: req.user.id,
      sessionId,
      conversationId,
      transcript,
      audioBase64,
      inputType: inputType || 'VOICE',
      courseId,
      sectionId,
      lessonId,
      mode,
      voiceStyle,
      explanationStyle,
      speakingSpeed,
      speechLanguage
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /voice/interact/stream
 * Process a voice interaction with Server-Sent Events (SSE) streaming.
 */
router.post('/interact/stream', protect, checkNotBlocked, async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const {
      sessionId,
      conversationId,
      transcript,
      audioBase64,
      inputType,
      courseId,
      sectionId,
      lessonId,
      mode,
      voiceStyle,
      explanationStyle,
      speakingSpeed,
      speechLanguage
    } = req.body;

    await VoiceOrchestrator.processInteractionStreaming({
      userId: req.user.id,
      sessionId,
      conversationId,
      transcript,
      audioBase64,
      inputType: inputType || 'VOICE',
      courseId,
      sectionId,
      lessonId,
      mode,
      voiceStyle,
      explanationStyle,
      speakingSpeed,
      speechLanguage,
      res
    });
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /voice/cancel
 * Handle barge-in cancellation when student interrupts AI speech.
 */
router.post('/cancel', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { sessionId, responseId } = req.body;
    await VoiceOrchestrator.cancelResponse({ sessionId, responseId, userId: req.user.id });
    res.json({ success: true, message: 'Response cancelled' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /voice/session/:id/mode
 * Change active conversation mode (EXPLAIN, SOCRATIC, PRACTICE, etc.).
 */
router.post('/session/:id/mode', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { mode } = req.body;
    const updated = await VoiceOrchestrator.changeMode({ sessionId: req.params.id, mode, userId: req.user.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /voice/session/:id/end
 * End a voice learning session.
 */
router.post('/session/:id/end', protect, checkNotBlocked, async (req, res, next) => {
  try {
    await VoiceOrchestrator.endSession({ sessionId: req.params.id, userId: req.user.id });
    res.json({ success: true, message: 'Session ended' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /voice/sessions
 * List active & past voice learning sessions for student.
 */
router.get('/sessions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId, limit } = req.query;
    const sessions = await VoiceOrchestrator.listSessions({ userId: req.user.id, courseId, limit });
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

export default router;
