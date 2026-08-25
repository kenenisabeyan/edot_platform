/**
 * voiceAdminRoutes.js
 * 
 * Express Router for Administrative Voice AI Management & Analytics.
 * 
 * Endpoints:
 *   GET /api/voice/admin/analytics  — Platform-wide usage, cost & duration analytics
 *   GET /api/voice/admin/providers  — List available STT/LLM/TTS providers & capability status
 *   POST /api/voice/admin/policy     — Update voice rate limits & daily duration caps
 */

import express from 'express';
import { protect, checkNotBlocked, authorize } from '../middleware/auth.js';
import VoicePolicyEngine from '../src/intelligence/voice/voicePolicyEngine.js';

const router = express.Router();

router.use(protect);
router.use(checkNotBlocked);

// ──────────────────────────────────────────────
// GET /api/voice/admin/analytics — Admin Usage & Cost Analytics
// ──────────────────────────────────────────────
router.get('/analytics', authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await VoicePolicyEngine.getPlatformVoiceAnalytics({ startDate, endDate });
    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Voice Admin Analytics Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch voice analytics' });
  }
});

// ──────────────────────────────────────────────
// GET /api/voice/admin/providers — Provider Capability Overview
// ──────────────────────────────────────────────
router.get('/providers', authorize('admin'), async (req, res) => {
  try {
    const providers = [
      {
        id: 'stt-web-speech',
        type: 'STT',
        name: 'Web Speech API (Browser Native)',
        status: 'ACTIVE',
        latency: 'Low (<100ms)',
        costPerMin: '$0.00'
      },
      {
        id: 'textgen-gemini-flash',
        type: 'TEXT_GEN',
        name: 'Google Gemini 3.6 Flash',
        status: 'ACTIVE',
        latency: 'Medium (300-600ms)',
        costPer1k: '$0.00015'
      },
      {
        id: 'tts-browser-synth',
        type: 'TTS',
        name: 'Web Speech Synthesis (Browser Native)',
        status: 'ACTIVE',
        latency: 'Low (<50ms)',
        costPer1k: '$0.00'
      }
    ];

    return res.json({ success: true, data: providers });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch provider status' });
  }
});

export default router;
