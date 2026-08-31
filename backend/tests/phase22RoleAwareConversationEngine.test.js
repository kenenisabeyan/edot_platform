/**
 * phase22RoleAwareConversationEngine.test.js
 * 
 * EDOT Role-Aware AI Conversation Engine & Closed-Loop Intelligence Test Suite
 * 
 * Verifies:
 *   1. Dynamic User Generation (Zero hardcoded IDs, works for any newly created user)
 *   2. Student AI Conversation ("I feel confused. What should I do next?")
 *   3. Instructor AI Conversation ("Who needs my attention today?") with Action CTAs
 *   4. Parent AI Conversation ("How can I help my child?") with non-judgmental encouragement
 *   5. Sponsor AI Conversation ("What impact is my sponsorship creating?") with Impact Intelligence
 *   6. Admin AI Conversation ("What is happening across EDOT?") with Platform Health Index
 *   7. Closed-Loop Action Engine Execution (Human action -> Telemetry update)
 *   8. Privacy Boundaries & Security Ownership Rejections (403 Forbidden)
 */

import { executeRoleAwareAiChat } from '../src/intelligence/ai/roleAssistantService.js';
import { executeClosedLoopAction } from '../src/intelligence/action/closedLoopActionEngine.js';
import { resolveIntelligenceVisibility, ForbiddenError } from '../src/intelligence/privacy/intelligenceVisibilityResolver.js';

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

async function runRoleAwareConversationEngineTests() {
  console.log('================================================================');
  console.log('RUNNING PHASE 22 ROLE-AWARE AI CONVERSATION ENGINE TEST SUITE');
  console.log('================================================================\n');

  // Dynamic timestamp-based user IDs (Zero hardcoded IDs)
  const timestamp = Date.now();
  const dynStudentId = `dyn-student-${timestamp}`;
  const dynInstructorId = `dyn-instructor-${timestamp}`;
  const dynParentId = `dyn-parent-${timestamp}`;
  const dynSponsorId = `dyn-sponsor-${timestamp}`;
  const dynAdminId = `dyn-admin-${timestamp}`;
  const dynUnauthId = `dyn-unauth-${timestamp}`;

  // ── 1. STUDENT AI CONVERSATION TEST ─────────────────────────────────────────
  console.log('1. Testing Student Role-Aware AI Conversation Engine:');
  const studentChat = await executeRoleAwareAiChat({
    userId: dynStudentId,
    role: 'student',
    message: 'I feel confused. What should I do next?',
    modality: 'TEXT'
  });
  assert(studentChat.role === 'student', 'Student AI correctly identifies role');
  assert(studentChat.reply.includes('one step at a time'), 'Provides supportive, step-by-step guidance');
  assert(Array.isArray(studentChat.actions) && studentChat.actions.length > 0, 'Returns actionable next best step CTAs');

  // ── 2. INSTRUCTOR AI CONVERSATION TEST ──────────────────────────────────────
  console.log('\n2. Testing Instructor Role-Aware AI Conversation Engine:');
  const instructorChat = await executeRoleAwareAiChat({
    userId: dynInstructorId,
    role: 'instructor',
    message: 'Who needs my attention today?',
    modality: 'VOICE'
  });
  assert(instructorChat.role === 'instructor', 'Instructor AI correctly identifies role');
  assert(instructorChat.reply.includes('students may benefit from support'), 'Identifies students needing attention');
  assert(instructorChat.actions.some(a => a.actionType === 'SEND_ENCOURAGEMENT'), 'Provides [ Send Encouragement ] CTA');
  assert(instructorChat.actions.some(a => a.actionType === 'ASSIGN_PRACTICE'), 'Provides [ Assign Practice ] CTA');

  // ── 3. PARENT AI CONVERSATION TEST ──────────────────────────────────────────
  console.log('\n3. Testing Parent Role-Aware AI Conversation Engine:');
  const parentChat = await executeRoleAwareAiChat({
    userId: dynParentId,
    role: 'parent',
    message: 'How can I help my child?',
    modality: 'TEXT'
  });
  assert(parentChat.role === 'parent', 'Parent AI correctly identifies role');
  assert(!parentChat.reply.toLowerCase().includes('failing'), 'Strict Policy: Never says "child is failing"');
  assert(parentChat.reply.includes('celebrate'), 'Recommends positive encouragement and celebration');

  // ── 4. SPONSOR AI CONVERSATION TEST ─────────────────────────────────────────
  console.log('\n4. Testing Sponsor Role-Aware AI Conversation Engine:');
  const sponsorChat = await executeRoleAwareAiChat({
    userId: dynSponsorId,
    role: 'sponsor',
    message: 'What impact is my sponsorship creating?',
    modality: 'VIDEO'
  });
  assert(sponsorChat.role === 'sponsor', 'Sponsor AI correctly identifies role');
  assert(sponsorChat.reply.includes('Students Supported'), 'Provides Impact Intelligence metrics breakdown');
  assert(sponsorChat.actions.some(a => a.actionType === 'SEND_ENCOURAGEMENT'), 'Provides [ Send Encouragement Update ] CTA');

  // ── 5. ADMIN AI CONVERSATION TEST ───────────────────────────────────────────
  console.log('\n5. Testing Admin Role-Aware AI Conversation Engine:');
  const adminChat = await executeRoleAwareAiChat({
    userId: dynAdminId,
    role: 'admin',
    message: 'What is happening across EDOT?',
    modality: 'TEXT'
  });
  assert(adminChat.role === 'admin', 'Admin AI correctly identifies role');
  assert(adminChat.reply.includes('Platform Health Index'), 'Returns Platform Health Index breakdown');

  // ── 6. CLOSED-LOOP ACTION ENGINE EXECUTION ──────────────────────────────────
  console.log('\n6. Testing Closed-Loop Action Engine Execution:');
  const actionResult = await executeClosedLoopAction({
    actionType: 'SEND_ENCOURAGEMENT',
    userId: dynInstructorId,
    recipientId: dynStudentId,
    payload: { message: 'Great job completing Module 1!', recipientRole: 'student' }
  });
  assert(actionResult.success === true, 'Successfully executed SEND_ENCOURAGEMENT action');
  assert(Boolean(actionResult.resultMessage), 'Generates confirmation result message');

  // ── 7. SECURITY & PRIVACY REJECTION (403 FORBIDDEN) ────────────────────────
  console.log('\n7. Testing Security & Unauthorized Access Rejection:');
  try {
    await resolveIntelligenceVisibility({
      viewerId: dynUnauthId,
      viewerRole: 'parent',
      studentId: dynStudentId
    });
    assert(false, 'Unlinked parent access attempt should be rejected');
  } catch (err) {
    assert(err.name === 'ForbiddenError' || err.statusCode === 403, 'Correctly rejected unlinked parent with HTTP 403 ForbiddenError');
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`ROLE-AWARE CONVERSATION ENGINE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRoleAwareConversationEngineTests().catch(err => {
  console.error('Role-Aware Conversation Engine Test Error:', err);
  process.exit(1);
});
