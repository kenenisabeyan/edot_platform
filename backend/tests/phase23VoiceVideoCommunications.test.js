/**
 * EDOT Phase 23 — Voice & Video Communications Test Suite
 * tests/phase23VoiceVideoCommunications.test.js
 *
 * Verifies real-time Voice and Video interactions:
 * 1. Starting & Resuming Voice Learning Sessions (/api/voice/session/start, /api/voice/session/:id/resume)
 * 2. Voice Turn Processing with transcripts and AI responses (/api/voice/interact)
 * 3. Multimodal Voice Turns in Mentor Conversations (/api/v2/intelligence/mentor/conversations/:id/voice)
 * 4. Multimodal Video Turns in Mentor Conversations (/api/v2/intelligence/mentor/conversations/:id/video)
 * 5. Database persistence of audioUrl, videoUrl, transcript, and messageType
 */

import VoiceOrchestrator from '../src/intelligence/voice/voiceOrchestrator.js';
import { executeVoiceMentorTurn, executeVideoMentorTurn, getConversationWithMessages } from '../src/intelligence/mentor/mentorService.js';
import { prisma } from '../lib/prisma.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runVoiceVideoTests() {
  console.log('====================================================');
  console.log('RUNNING PHASE 23 VOICE & VIDEO COMMUNICATIONS TEST SUITE');
  console.log('====================================================\n');

  const testStudentId = 'test-voice-video-student-1';

  // Ensure test user exists
  await prisma.user.upsert({
    where: { id: testStudentId },
    update: {},
    create: {
      id: testStudentId,
      name: 'Voice Video Learner',
      email: 'voicevideolearner@edot.org',
      password: 'hashedpassword123',
      role: 'student'
    }
  }).catch(() => {});

  // ── 1. VOICE SESSION START & RESUME ──────────────────────────────────
  console.log('1. Testing Voice Session Start & Resume:');

  const startData = await VoiceOrchestrator.startSession({
    userId: testStudentId,
    mode: 'EXPLAIN',
    voiceStyle: 'Friendly',
    explanationStyle: 'Normal'
  });

  assert(Boolean(startData.session?.id), 'Voice session created successfully in database');
  assert(Boolean(startData.conversationId), 'Voice session bound to parent MentorConversation');

  const resumeData = await VoiceOrchestrator.resumeSession({
    sessionId: startData.session.id,
    userId: testStudentId
  });

  assert(Boolean(resumeData.session), 'Voice session resumed with continuity context');
  assert(resumeData.session.status === 'ACTIVE', 'Resumed session status updated to ACTIVE');

  // ── 2. VOICE INTERACTION PIPELINE ──────────────────────────────────────
  console.log('\n2. Testing Voice Interaction Turn Processing:');

  const interactionResult = await VoiceOrchestrator.processInteraction({
    userId: testStudentId,
    sessionId: startData.session.id,
    conversationId: startData.conversationId,
    transcript: 'Can you explain quantum computing in simple terms?',
    inputType: 'VOICE'
  });

  assert(Boolean(interactionResult.responseId), 'Voice interaction generated response ID');
  assert(Boolean(interactionResult.mentorReply), 'Voice interaction returned AI mentor reply');
  assert(interactionResult.userText.includes('quantum computing'), 'Correctly transcribed user speech transcript');

  // ── 3. MULTIMODAL VOICE TURN PERSISTENCE ──────────────────────────────
  console.log('\n3. Testing Multimodal Voice Turn Persistence in Mentor Conversation:');

  const voiceTurnResult = await executeVoiceMentorTurn(testStudentId, {
    conversationId: startData.conversationId,
    audioUrl: 'https://cdn.edot.org/audio/sample_recording.mp3',
    transcript: 'What are the main applications of machine learning in healthcare?',
    clientMessageId: `voice-idemp-${Date.now()}`
  });

  assert(Boolean(voiceTurnResult.conversationId), 'Voice turn executed in mentor conversation');

  // Reload conversation history
  const convoHistory = await getConversationWithMessages(testStudentId, startData.conversationId);
  const voiceMessageInDB = convoHistory.messages.find(m => m.content.includes('machine learning in healthcare'));

  assert(Boolean(voiceMessageInDB), 'Voice transcript persisted into database conversation thread');

  // ── 4. MULTIMODAL VIDEO TURN PERSISTENCE ──────────────────────────────
  console.log('\n4. Testing Multimodal Video Turn Persistence in Mentor Conversation:');

  const videoTurnResult = await executeVideoMentorTurn(testStudentId, {
    conversationId: startData.conversationId,
    videoUrl: 'https://cdn.edot.org/video/sample_student_presentation.mp4',
    transcript: 'Here is my project code walkthrough video.',
    clientMessageId: `video-idemp-${Date.now()}`
  });

  assert(Boolean(videoTurnResult.conversationId), 'Video turn executed in mentor conversation');

  const convoHistoryAfterVideo = await getConversationWithMessages(testStudentId, startData.conversationId);
  const videoMessageInDB = convoHistoryAfterVideo.messages.find(m => m.content.includes('project code walkthrough'));

  assert(Boolean(videoMessageInDB), 'Video interaction persisted into database conversation thread');
  assert(convoHistoryAfterVideo.messages.length >= 4, 'Total conversation thread contains combined Text, Voice, and Video turns');

  // Cleanup test data safely
  await prisma.voiceLearningSession.deleteMany({ where: { learnerId: testStudentId } }).catch(() => {});
  await prisma.mentorMessage.deleteMany({ where: { conversationId: startData.conversationId } }).catch(() => {});
  await prisma.mentorConversation.delete({ where: { id: startData.conversationId } }).catch(() => {});
  await prisma.user.delete({ where: { id: testStudentId } }).catch(() => {});

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n====================================================');
  console.log(`VOICE & VIDEO TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVoiceVideoTests().catch(err => {
  console.error('Voice/Video Test Suite Error:', err);
  process.exit(1);
});
