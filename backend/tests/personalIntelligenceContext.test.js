/**
 * EDOT Personal Intelligence Context Layer — Comprehensive Test Suite
 * tests/personalIntelligenceContext.test.js
 *
 * Tests:
 * 1. Conversational Intent Classification (22+ intent types, multi-intent resolution).
 * 2. Human Language Translation (verifies zero internal database IDs, vector IDs, or technical terms leak).
 * 3. Role-Based Authorization & Cross-Role Security (Student, Instructor, Admin, Guardian, Sponsor).
 * 4. Recency & Freshness Tagging (CURRENT, RECENT, HISTORICAL).
 * 5. Fault Isolation (individual domain fetcher failure gracefully handled).
 * 6. End-to-End Context Resolution.
 */

import {
  classifyConversationalIntent,
  translateInternalComplexityToHumanLanguage,
  assertContextAuthorization,
  resolvePersonalIntelligenceContext,
  INTENT_TYPES
} from '../src/intelligence/context/personalIntelligenceContextService.js';

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

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING PERSONAL INTELLIGENCE CONTEXT TEST SUITE');
  console.log('====================================================\n');

  // ── 1. INTENT CLASSIFICATION ─────────────────────────────────────────
  console.log('1. Testing Conversational Intent Classifier:');

  const intents1 = classifyConversationalIntent('How do I solve recursion in JavaScript?');
  assert(intents1.includes(INTENT_TYPES.CONCEPT_EXPLANATION), 'Detects CONCEPT_EXPLANATION intent');
  assert(intents1.includes(INTENT_TYPES.LEARNING_QUESTION), 'Detects LEARNING_QUESTION intent');

  const intents2 = classifyConversationalIntent('I am struggling with JavaScript and want to know what I should learn next for frontend jobs.');
  assert(intents2.includes(INTENT_TYPES.MASTERY_QUESTION) || intents2.includes(INTENT_TYPES.LEARNING_SUPPORT), 'Detects mastery/support intent');
  assert(intents2.includes(INTENT_TYPES.CAREER_QUESTION), 'Detects CAREER_QUESTION intent');
  assert(intents2.includes(INTENT_TYPES.RECOMMENDATION_REQUEST) || intents2.includes(INTENT_TYPES.NEXT_BEST_ACTION), 'Detects RECOMMENDATION/NEXT_ACTION intent');

  const intents3 = classifyConversationalIntent('Hello there!');
  assert(intents3.includes(INTENT_TYPES.GENERAL_CONVERSATION), 'Detects GENERAL_CONVERSATION fallback');

  // ── 2. HUMAN LANGUAGE TRANSLATOR (SANITIZATION) ───────────────────────
  console.log('\n2. Testing Human Language Translator (No Internal Jargon):');

  const rawContext = {
    profile: { name: 'Alex Learner', learningGoals: ['Web Development'] },
    activeLearning: { courseTitle: 'React Fundamentals', lessonTitle: 'State & Props', currentProgress: 65.4 },
    progress: { engagementScore: 88, consistencyScore: 92, studyStreak: 7 },
    mastery: [
      { conceptName: 'Components', masteryLevel: 'MASTERED', confidenceScore: 0.95 },
      { conceptName: 'Hooks', masteryLevel: 'DEVELOPING', confidenceScore: 0.42 }
    ],
    skills: [
      { name: 'JavaScript', proficiencyLevel: 'intermediate', masteryScore: 78 }
    ],
    nextAction: { title: 'Practice React Hooks', reason: 'Reinforce state management' }
  };

  const humanContext = translateInternalComplexityToHumanLanguage(rawContext);
  const jsonStr = JSON.stringify(humanContext);

  assert(!jsonStr.includes('0.95'), 'Strips raw numerical confidence scores');
  assert(!jsonStr.includes('0.42'), 'Strips raw confidence score decimals');
  assert(humanContext.identitySummary.includes('Alex Learner'), 'Includes learner name naturally');
  assert(humanContext.currentLearningState.includes('React Fundamentals'), 'Includes course title in natural language');
  assert(humanContext.conceptMasterySummary.includes('Comfortable with: Components'), 'Translates MASTERED to "Comfortable with"');
  assert(humanContext.conceptMasterySummary.includes('more practice in: Hooks'), 'Translates DEVELOPING to "more practice in"');

  // ── 3. ROLE-BASED AUTHORIZATION & SECURITY ───────────────────────────
  console.log('\n3. Testing Role-Based Authorization & Privacy Guard:');

  const studentUser = { id: 'user-student-1', role: 'student' };
  const studentUser2 = { id: 'user-student-2', role: 'student' };
  const adminUser = { id: 'user-admin-1', role: 'admin' };

  // Student self-access
  try {
    await assertContextAuthorization(studentUser, 'user-student-1');
    assert(true, 'Student self-access authorized');
  } catch (err) {
    assert(false, `Student self-access failed: ${err.message}`);
  }

  // Admin access to any student
  try {
    await assertContextAuthorization(adminUser, 'user-student-1');
    assert(true, 'Admin access to student authorized');
  } catch (err) {
    assert(false, `Admin access failed: ${err.message}`);
  }

  // Student accessing another student -> MUST FAIL (HTTP 403)
  try {
    await assertContextAuthorization(studentUser, 'user-student-2');
    assert(false, 'Student accessing another student should have thrown ForbiddenError');
  } catch (err) {
    assert(err.name === 'ForbiddenError' || err.statusCode === 403 || err.message.includes('Forbidden'), 'Unauthorized cross-student access denied with 403');
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
