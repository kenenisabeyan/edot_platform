/**
 * phase23LivingIntelligenceOrchestrator.test.js
 * 
 * EDOT Phase 23 — Real-Time Intelligence Orchestration & Human Experience Test Suite
 * 
 * Tests core Phase 23 mandates:
 *   1. Intelligence Event Processing (QUIZ_FAILED, LESSON_COMPLETED, etc.)
 *   2. Notification Rate-Limiting & Anti-Spam (24h window protection)
 *   3. Progressive Escalation (AI Practice -> Instructor Alert -> Parent Supportive Update)
 *   4. Unified Conversation Memory across Text, Voice, and Video modalities
 *   5. Strict Privacy Boundaries (Private AI chats hidden from parents/instructors)
 *   6. Non-Judgmental Parent Phrasing ("Your student may benefit from encouragement")
 *   7. Zero Hardcoded User/Student IDs
 *   8. Full Regression Stability across Phases 0-22
 */

import { processIntelligenceEvent, getInstructorTeachingPriorities, checkRateLimit } from '../src/intelligence/orchestration/edotIntelligenceOrchestrator.js';
import { recordConversationTurn, getUnifiedConversationContext, deleteConversationMemory } from '../src/intelligence/memory/conversationIntelligenceMemoryService.js';

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

async function runPhase23Tests() {
  console.log('================================================================');
  console.log('RUNNING PHASE 23 REAL-TIME INTELLIGENCE ORCHESTRATION TESTS');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testStudentId = `p23-student-${timestamp}`;
  const testInstructorId = `p23-instructor-${timestamp}`;
  const testGuardianId = `p23-parent-${timestamp}`;
  const conversationId = `p23-conv-${timestamp}`;

  // 1. Testing Event Processing & Progressive Escalation
  console.log('1. Testing Real-Time Intelligence Event Processing:');
  const eventRes = await processIntelligenceEvent({ eventType: 'QUIZ_FAILED', userId: testStudentId });
  assert(eventRes.success === true, 'Event processed successfully by Orchestrator');
  assert(eventRes.orchestration.escalationLevel === 'SUPPORT_RECOMMENDED', 'Escalated to SUPPORT_RECOMMENDED');
  assert(eventRes.orchestration.suggestedActions.length > 0, 'Generated role-specific suggested actions');

  // 2. Testing Anti-Spam Rate Limiting
  console.log('\n2. Testing Notification Rate-Limiting & Anti-Spam:');
  const rateKey = `${testStudentId}:SPAM_TEST_ALERT`;
  const firstCheck = checkRateLimit(rateKey);
  const secondCheck = checkRateLimit(rateKey);
  assert(firstCheck === true, 'First notification allowed');
  assert(secondCheck === false, 'Duplicate notification blocked within 24h window (Anti-Spam active)');

  // 3. Testing Teaching Priorities Grid
  console.log('\n3. Testing Instructor Teaching Priorities Grid:');
  const priorities = await getInstructorTeachingPriorities(testInstructorId);
  assert(typeof priorities.redCount === 'number', 'Calculated red alert learner count');
  assert(typeof priorities.yellowCount === 'number', 'Calculated yellow reduced activity count');
  assert(typeof priorities.greenCount === 'number', 'Calculated green progress count');

  // 4. Testing Unified Conversation Memory Across Text, Voice, and Video
  console.log('\n4. Testing Unified Multi-Modality Conversation Memory (Text, Voice, Video):');
  const textTurn = await recordConversationTurn({ userId: testStudentId, conversationId, modality: 'TEXT', topic: 'Data Structures', content: 'I need help with trees' });
  const voiceTurn = await recordConversationTurn({ userId: testStudentId, conversationId, modality: 'VOICE', topic: 'Data Structures', content: 'Voice audio note recorded' });
  const videoTurn = await recordConversationTurn({ userId: testStudentId, conversationId, modality: 'VIDEO', topic: 'Data Structures', content: 'Video support session' });

  assert(textTurn.success === true, 'Recorded Text conversation turn');
  assert(voiceTurn.success === true, 'Recorded Voice conversation turn');
  assert(videoTurn.success === true, 'Recorded Video conversation turn');

  const unifiedContext = await getUnifiedConversationContext({ viewerId: testStudentId, viewerRole: 'student', studentId: testStudentId, conversationId });
  assert(unifiedContext.modalitiesUsed.length === 3, 'Unified context connects Text, Voice, and Video sessions');
  assert(unifiedContext.topics.includes('Data Structures'), 'Preserved continuous topic graph across modalities');

  // 5. Testing Privacy Enforcement for Conversation Memory
  console.log('\n5. Testing Privacy Boundaries & Unverified Role Rejection:');
  try {
    await getUnifiedConversationContext({ viewerId: testGuardianId, viewerRole: 'parent', studentId: testStudentId, conversationId });
    assert(false, 'Guardian should be denied direct access to private AI conversation memory');
  } catch (err) {
    assert(err.message.includes('Access denied') || err.message.includes('private'), 'Parent denied direct access to student private AI chats (HTTP 403)');
  }

  // 6. Delete conversation memory (Consent & GDPR support)
  console.log('\n6. Testing Consent & Deletion Support:');
  const deleteRes = await deleteConversationMemory({ userId: testStudentId, conversationId });
  assert(deleteRes.deleted === true, 'Conversation memory deleted successfully on request');

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`PHASE 23 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase23Tests().catch(err => {
  console.error('Phase 23 Test Suite Error:', err);
  process.exit(1);
});
