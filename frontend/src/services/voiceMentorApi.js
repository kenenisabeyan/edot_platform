/**
 * voiceMentorApi.js
 * 
 * Frontend API client for EDOT Continuous AI Voice Mentor.
 * Supports both request-response and SSE streaming modes.
 */

import api from '../utils/api';

/**
 * Start a new voice learning session.
 */
export async function startVoiceSession(payload = {}) {
  const { data } = await api.post('/voice/session/start', payload);
  return data.data;
}

/**
 * Switch the active conversation mode.
 */
export async function changeVoiceMode(sessionId, mode) {
  const { data } = await api.post(`/voice/session/${sessionId}/mode`, { mode });
  return data.data;
}

/**
 * Process a voice/text interaction (request-response mode).
 */
export async function processVoiceInteraction(payload = {}) {
  const { data } = await api.post('/voice/interact', payload);
  return data.data;
}

/**
 * Process a voice/text interaction with SSE streaming.
 * 
 * Returns an EventSource-like interface that fires callbacks:
 *   onStatus(stage, message)     — Pipeline stage updates
 *   onTranscript(text, confidence) — Transcribed speech
 *   onContext(contextInfo)        — Loaded context summary
 *   onSpeechChunk(chunk)          — Individual TTS sentence chunk
 *   onComplete(fullResponse)      — Complete response data
 *   onError(error)                — Error event
 * 
 * @param {Object} payload - Interaction parameters
 * @param {Object} callbacks - Event callbacks
 * @returns {AbortController} - Call .abort() to cancel
 */
export function processVoiceInteractionStreaming(payload = {}, callbacks = {}) {
  const controller = new AbortController();

  const baseUrl = api.defaults.baseURL || '';
  const url = `${baseUrl}/voice/interact/stream`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
    credentials: 'include'
  })
    .then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case 'status':
                  callbacks.onStatus?.(data.stage, data.message);
                  break;
                case 'transcript':
                  callbacks.onTranscript?.(data.text, data.confidence);
                  break;
                case 'context':
                  callbacks.onContext?.(data);
                  break;
                case 'speech_chunk':
                  callbacks.onSpeechChunk?.(data);
                  break;
                case 'complete':
                  callbacks.onComplete?.(data);
                  break;
                case 'error':
                  callbacks.onError?.(data);
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
            currentEvent = '';
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.({ message: err.message });
      }
    });

  return controller;
}

/**
 * Cancel an active AI voice response (barge-in).
 */
export async function cancelVoiceResponse(payload = {}) {
  const { data } = await api.post('/voice/cancel', payload);
  return data.data;
}

/**
 * End a voice learning session.
 */
export async function endVoiceSession(sessionId) {
  const { data } = await api.post(`/voice/session/${sessionId}/end`);
  return data.data;
}

/**
 * Resume a voice learning session with rolling memory.
 */
export async function resumeVoiceSession(sessionId) {
  const { data } = await api.get(`/voice/session/${sessionId}/resume`);
  return data.data;
}

/**
 * List user's voice learning sessions.
 */
export async function listVoiceSessions(courseId = null, limit = 10) {
  const params = { limit };
  if (courseId) params.courseId = courseId;
  const { data } = await api.get('/voice/sessions', { params });
  return data.data;
}

/**
 * Helper to extract auth headers from the api instance.
 */
function getAuthHeaders() {
  const headers = {};
  if (api.defaults.headers?.common?.Authorization) {
    headers.Authorization = api.defaults.headers.common.Authorization;
  }
  // Try to get token from localStorage as fallback
  try {
    const token = localStorage.getItem('token');
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Not in browser context
  }
  return headers;
}

export default {
  startVoiceSession,
  changeVoiceMode,
  processVoiceInteraction,
  processVoiceInteractionStreaming,
  cancelVoiceResponse,
  endVoiceSession,
  resumeVoiceSession,
  listVoiceSessions
};
