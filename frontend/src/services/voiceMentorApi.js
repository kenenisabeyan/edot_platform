/**
 * voiceMentorApi.js
 * 
 * Frontend API client service for EDOT Continuous AI Voice Mentor.
 */

import api from '../utils/api';

export async function startVoiceSession(payload = {}) {
  const { data } = await api.post('/voice/session/start', payload);
  return data.data;
}

export async function changeVoiceMode(sessionId, mode) {
  const { data } = await api.post(`/voice/session/${sessionId}/mode`, { mode });
  return data.data;
}

export async function processVoiceInteraction(payload = {}) {
  const { data } = await api.post('/voice/interact', payload);
  return data.data;
}

export async function cancelVoiceResponse(payload = {}) {
  const { data } = await api.post('/voice/cancel', payload);
  return data.data;
}

export async function resumeVoiceSession(sessionId) {
  const { data } = await api.get(`/voice/session/${sessionId}/resume`);
  return data.data;
}

export default {
  startVoiceSession,
  changeVoiceMode,
  processVoiceInteraction,
  cancelVoiceResponse,
  resumeVoiceSession
};
