/**
 * voiceRoutes.js
 * 
 * Express routes for EDOT Continuous AI Voice Mentor.
 * 
 * Endpoints:
 *   POST /session/start          — Start a new voice learning session
 *   POST /session/:id/mode       — Switch conversation mode
 *   POST /interact               — Process voice/text interaction (request-response)
 *   POST /interact/stream        — Process voice/text interaction (SSE streaming)
 *   POST /cancel                 — Cancel active AI response (barge-in)
 *   POST /session/:id/end        — End a voice learning session
 *   GET  /session/:id/resume     — Resume session with rolling memory
 *   GET  /sessions               — List user's voice learning sessions
 */

import express from 'express';
import { protect, checkNotBlocked } from '../middleware/auth.js';
import VoiceOrchestrator from '../src/intelligence/voice/voiceOrchestrator.js';
import ContextCompressor from '../src/intelligence/voice/contextCompressor.js';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

router.use(protect);
router.use(checkNotBlocked);

// ──────────────────────────────────────────────
// Start or resume a Voice Learning Session
// ──────────────────────────────────────────────
router.post('/session/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, sectionId, lessonId, mode, voiceStyle, explanationStyle, speakingSpeed, speechLanguage } = req.body;

    const result = await VoiceOrchestrator.startSession({
      userId,
      courseId,
      sectionId,
      lessonId,
      mode,
      voiceStyle,
      explanationStyle,
      speakingSpeed,
      speechLanguage
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Voice Session Start Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to start voice session' });
  }
});

// ──────────────────────────────────────────────
// Switch active conversation mode
// ──────────────────────────────────────────────
router.post('/session/:id/mode', async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.body;

    if (!mode) return res.status(400).json({ success: false, message: 'Mode is required' });

    const session = await prisma.voiceLearningSession.update({
      where: { id },
      data: { mode }
    });

    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('Voice Mode Change Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update voice mode' });
  }
});

// ──────────────────────────────────────────────
// Process voice/text interaction (request-response)
// ──────────────────────────────────────────────
router.post('/interact', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sessionId, conversationId, transcript, audioBase64,
      inputType, courseId, sectionId, lessonId, mode,
      voiceStyle, explanationStyle, speakingSpeed, speechLanguage
    } = req.body;

    const result = await VoiceOrchestrator.processInteraction({
      userId,
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
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Voice Interaction Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process voice interaction' });
  }
});

// ──────────────────────────────────────────────
// Process voice/text interaction (SSE streaming)
//
// Client receives events:
//   status        — Pipeline stage updates
//   transcript    — Transcribed text from speech
//   context       — Loaded context summary
//   speech_chunk  — Individual TTS sentence chunks
//   complete      — Full response with all data
//   error         — Error event
// ──────────────────────────────────────────────
router.post('/interact/stream', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sessionId, conversationId, transcript, audioBase64,
      inputType, courseId, sectionId, lessonId, mode,
      voiceStyle, explanationStyle, speakingSpeed, speechLanguage
    } = req.body;

    await VoiceOrchestrator.processInteractionStreaming({
      res,
      userId,
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
    });
  } catch (error) {
    console.error('Voice Streaming Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to process streaming voice interaction' });
    }
  }
});

// ──────────────────────────────────────────────
// Cancel active AI response (barge-in / speech interruption)
// ──────────────────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const { sessionId, responseId } = req.body;
    const result = await VoiceOrchestrator.cancelActiveResponse({ sessionId, responseId });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to cancel response' });
  }
});

// ──────────────────────────────────────────────
// End a voice learning session
// ──────────────────────────────────────────────
router.post('/session/:id/end', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await VoiceOrchestrator.endSession({ sessionId: id, userId });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Voice Session End Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to end voice session' });
  }
});

// ──────────────────────────────────────────────
// Resume session with full rolling memory summary
// ──────────────────────────────────────────────
router.get('/session/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.voiceLearningSession.findUnique({ where: { id } });

    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const rollingMemory = await ContextCompressor.getRollingMemory(session.conversationId);
    const messages = await prisma.mentorMessage.findMany({
      where: { conversationId: session.conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    return res.json({
      success: true,
      data: {
        session,
        messages,
        rollingMemory
      }
    });
  } catch (error) {
    console.error('Voice Session Resume Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resume voice session' });
  }
});

// ──────────────────────────────────────────────
// List user's voice learning sessions
// ──────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, limit = 10 } = req.query;

    const where = { learnerId: userId };
    if (courseId) where.courseId = courseId;

    const sessions = await prisma.voiceLearningSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    return res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Voice Sessions List Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list voice sessions' });
  }
});

export default router;
