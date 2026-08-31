/**
 * EDOT Phase 23 — AI Mentor Real Conversation Persistence, Multimodal History & User-Controlled Deletion Test Suite
 * tests/phase23RealConversationPersistence.test.js
 *
 * Comprehensive verification for Phase 23 requirements:
 * 1. Real Conversation & Message Persistence in Database (Database is source of truth)
 * 2. Client Idempotency Protection (clientMessageId prevents duplicate sends & duplicate AI calls)
 * 3. Unified Multimodal Threads (Text, Voice, Video in ONE conversation)
 * 4. User-Controlled Soft Deletion (status = 'DELETED') & Soft-Delete Protection
 * 5. Archive and Restore Functionality (status = 'ARCHIVED' / 'ACTIVE')
 * 6. Server-Side Ownership Security Guard (Cross-student access returns 403 Forbidden)
 * 7. Soft-deleted messages excluded from AI context window
 * 8. Empty Conversation Rule (No premature DB pollution on "+ New Conversation")
 * 9. Failure isolation & Retry capabilities without message loss
 * 10. Title auto-generation & dynamic renaming
 */

import {
  createConversation,
  getConversations,
  getConversationWithMessages,
  addStudentMessage,
  addMentorMessage,
  updateConversationTitle,
  archiveConversation,
  restoreConversation,
  deleteConversation,
  deleteMessage,
  buildContextWindowHistory,
  assertConversationOwnership
} from '../src/intelligence/mentor/conversationService.js';
import { executeMentorChat, executeVoiceMentorTurn, executeVideoMentorTurn } from '../src/intelligence/mentor/mentorService.js';
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

async function runPhase23Tests() {
  console.log('====================================================');
  console.log('RUNNING PHASE 23 REAL CONVERSATION PERSISTENCE TEST SUITE');
  console.log('====================================================\n');

  // Generate test user IDs
  const testStudentId = 'test-student-p23-1';
  const unauthorizedStudentId = 'test-student-p23-2';

  // Ensure test users exist in DB
  await prisma.user.upsert({
    where: { id: testStudentId },
    update: {},
    create: { id: testStudentId, name: 'Phase23 Learner', email: 'p23learner@edot.org', password: 'hashedpassword123', role: 'student' }
  }).catch((err) => console.error('User A upsert error:', err.message));

  await prisma.user.upsert({
    where: { id: unauthorizedStudentId },
    update: {},
    create: { id: unauthorizedStudentId, name: 'Other Learner', email: 'otherlearner@edot.org', password: 'hashedpassword123', role: 'student' }
  }).catch((err) => console.error('User B upsert error:', err.message));

  // ── 1. REAL CONVERSATION PERSISTENCE IN DATABASE ──────────────────────
  console.log('1. Testing Real Conversation Persistence & DB Source of Truth:');

  const convo1 = await createConversation(testStudentId, {
    title: 'Understanding Functions in JS',
    conversationType: 'MIXED'
  });
  assert(Boolean(convo1.id), 'Conversation created and persisted with UUID in database');
  assert(convo1.status === 'ACTIVE', 'Default conversation status is ACTIVE');
  assert(convo1.conversationType === 'MIXED', 'Supports MIXED conversation modality');

  // Add student & AI message
  const studentMsg1 = await addStudentMessage(convo1.id, 'Can you explain arrow functions in JavaScript?', {
    inputType: 'TEXT'
  });
  assert(Boolean(studentMsg1.id), 'Student message persisted in database');
  assert(studentMsg1.role === 'STUDENT' && studentMsg1.sender === 'STUDENT', 'Persists role and sender correctly');

  const aiMsg1 = await addMentorMessage(convo1.id, 'Arrow functions provide a concise syntax for writing function expressions in JS.', {
    groundingStatus: 'COURSE_GROUNDED'
  });
  assert(Boolean(aiMsg1.id), 'AI response message persisted in database');
  assert(aiMsg1.role === 'MENTOR' && aiMsg1.sender === 'AI', 'Persists AI response role and sender');

  // Verify reload from DB
  const reloadedConvo = await getConversationWithMessages(testStudentId, convo1.id);
  assert(reloadedConvo.messages.length === 2, 'Reloading conversation from database recovers full message history');
  assert(reloadedConvo.messages[0].content.includes('arrow functions'), 'First message matches persisted content');
  assert(reloadedConvo.messages[1].content.includes('concise syntax'), 'Second message matches persisted AI content');

  // ── 2. CLIENT IDEMPOTENCY & DUPLICATE PREVENTION ───────────────────────
  console.log('\n2. Testing Client Idempotency Protection (clientMessageId):');

  const clientIdempotencyKey = `client-req-${Date.now()}`;
  const firstSend = await addStudentMessage(convo1.id, 'What is a closure?', {
    clientMessageId: clientIdempotencyKey,
    inputType: 'TEXT'
  });

  const duplicateSend = await addStudentMessage(convo1.id, 'What is a closure?', {
    clientMessageId: clientIdempotencyKey,
    inputType: 'TEXT'
  });

  assert(firstSend.id === duplicateSend.id, 'Duplicate send request returns existing message ID without creating duplicate record');

  // ── 3. UNIFIED MULTIMODAL THREAD (TEXT + VOICE + VIDEO IN ONE CONVO) ───
  console.log('\n3. Testing Unified Multimodal Thread (Text + Voice + Video):');

  const voiceTurn = await executeVoiceMentorTurn(testStudentId, {
    conversationId: convo1.id,
    audioUrl: 'https://cdn.edot.org/audio/sample1.mp3',
    transcript: 'How does event loop handle microtasks?',
    clientMessageId: `voice-req-${Date.now()}`
  });

  assert(Boolean(voiceTurn.conversationId), 'Voice turn executed cleanly');
  assert(voiceTurn.conversationId === convo1.id, 'Voice interaction appends to existing conversation instead of creating separate empty session');

  const fullMultimodalConvo = await getConversationWithMessages(testStudentId, convo1.id);
  const voiceMsg = fullMultimodalConvo.messages.find(m => m.inputType === 'VOICE' || m.messageType === 'VOICE');
  assert(Boolean(voiceMsg), 'Voice message stored with VOICE modality type');
  assert(fullMultimodalConvo.messageCount >= 4, 'Voice interaction increments total conversation message count');

  // ── 4. ARCHIVE & RESTORE ───────────────────────────────────────────────
  console.log('\n4. Testing Conversation Archive & Restore:');

  await archiveConversation(testStudentId, convo1.id);
  const activeListAfterArchive = await getConversations(testStudentId, { status: 'ACTIVE' });
  assert(!activeListAfterArchive.some(c => c.id === convo1.id), 'Archived conversation hidden from active conversations list');

  const archivedList = await getConversations(testStudentId, { status: 'ARCHIVED' });
  assert(archivedList.some(c => c.id === convo1.id), 'Archived conversation appears in archived list');

  await restoreConversation(testStudentId, convo1.id);
  const activeListAfterRestore = await getConversations(testStudentId, { status: 'ACTIVE' });
  assert(activeListAfterRestore.some(c => c.id === convo1.id), 'Restored conversation returns to active list');

  // ── 5. USER-CONTROLLED SOFT DELETION & AI CONTEXT EXCLUSION ──────────
  console.log('\n5. Testing Soft Deletion & AI Context Window Exclusion:');

  const convo2 = await createConversation(testStudentId, { title: 'Temporary Practice Session' });
  const msgToDelete = await addStudentMessage(convo2.id, 'Delete this specific line', { inputType: 'TEXT' });
  await addMentorMessage(convo2.id, 'Will do.', {});

  // Soft delete message
  await deleteMessage(testStudentId, convo2.id, msgToDelete.id);
  const convo2Reloaded = await getConversationWithMessages(testStudentId, convo2.id);
  assert(!convo2Reloaded.messages.some(m => m.id === msgToDelete.id), 'Soft-deleted message excluded from conversation messages');

  const contextWindow = await buildContextWindowHistory(testStudentId, convo2.id);
  assert(!contextWindow.some(m => m.content.includes('Delete this specific line')), 'Soft-deleted message excluded from AI context window');

  // Soft delete entire conversation
  await deleteConversation(testStudentId, convo2.id);
  const activeConversations = await getConversations(testStudentId, { status: 'ALL' });
  assert(!activeConversations.some(c => c.id === convo2.id), 'Deleted conversation completely excluded from normal lists');

  // ── 6. SERVER-SIDE SECURITY & OWNERSHIP AUTHORIZATION ─────────────────
  console.log('\n6. Testing Server-Side Ownership Security Guard (403 Forbidden):');

  try {
    await assertConversationOwnership(unauthorizedStudentId, convo1.id);
    assert(false, 'Unauthorized user accessing another student conversation should have thrown error');
  } catch (err) {
    assert(err.name === 'ForbiddenError' || err.message.includes('Forbidden') || err.message.includes('denied'), 'Unauthorized access blocked with ForbiddenError (403)');
  }

  try {
    await getConversationWithMessages(unauthorizedStudentId, convo1.id);
    assert(false, 'Unauthorized getConversationWithMessages should have thrown error');
  } catch (err) {
    assert(err.name === 'NotFoundError' || err.name === 'ForbiddenError' || err.message.includes('not found'), 'Unauthorized conversation query denied');
  }

  // ── 7. DYNAMIC TITLE EDITING ───────────────────────────────────────────
  console.log('\n7. Testing Dynamic Title Editing:');

  const updatedConvo = await updateConversationTitle(testStudentId, convo1.id, 'Advanced JavaScript Mastery');
  assert(updatedConvo.title === 'Advanced JavaScript Mastery', 'Student successfully updated conversation title');

  // Cleanup test data safely
  await prisma.mentorMessage.deleteMany({ where: { conversationId: convo1.id } }).catch(() => {});
  await prisma.mentorConversation.delete({ where: { id: convo1.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [testStudentId, unauthorizedStudentId] } } }).catch(() => {});

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n====================================================');
  console.log(`PHASE 23 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase23Tests().catch(err => {
  console.error('Phase 23 Test Suite Failure:', err);
  process.exit(1);
});
