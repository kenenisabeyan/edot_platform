/**
 * Test Suite - EDOT AI Mentor MVP (Context-Aware AI Tutor, Session Auditing, Human Support Detection)
 */

import { buildStudentLearningContext } from '../src/intelligence/mentor/contextBuilder.js';
import { detectHumanSupportNeed, buildMentorSystemInstruction, parseAndValidateMentorResponse } from '../src/intelligence/mentor/promptOrchestrator.js';
import { executeMentorChat, getMentorSessions, submitSessionFeedback } from '../src/intelligence/mentor/mentorService.js';
import { prisma } from '../lib/prisma.js';

async function runMentorTestSuite() {
  console.log('🧪 Starting EDOT AI Mentor MVP Test Suite...\n');

  try {
    // 1. Fetch test student
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };
    console.log(`👤 Testing with student ID: ${testUser.id}`);

    // 2. Test Secure Context Building
    console.log('\n--- 1. Testing Secure Learning Context Building ---');
    const context = await buildStudentLearningContext(testUser.id);
    console.log('Assembled Context Summary:', JSON.stringify({
      learnerName: context.learnerName,
      academicLevel: context.academicLevel,
      currentCourseTitle: context.currentCourseTitle,
      identifiedWeakSkills: context.identifiedWeakSkills,
      sources: context.sources
    }, null, 2));

    if (context.learnerName && Array.isArray(context.sources)) {
      console.log('✅ Context building test PASSED');
    } else {
      throw new Error('Context building failed');
    }

    // 3. Test Human Support Request Detection
    console.log('\n--- 2. Testing Human / Instructor Support Need Detection ---');
    const normalMsg = 'Can you explain promises in JavaScript?';
    const supportMsg = 'I am completely lost and want to talk to an instructor';

    const isNormalNeed = detectHumanSupportNeed(normalMsg);
    const isSupportNeed = detectHumanSupportNeed(supportMsg);

    console.log(`Normal Query Flag: ${isNormalNeed}, Support Query Flag: ${isSupportNeed}`);
    if (!isNormalNeed && isSupportNeed) {
      console.log('✅ Human support detection test PASSED');
    } else {
      throw new Error('Human support detection failed');
    }

    // 4. Test Full Context-Aware Mentor Chat Execution
    console.log('\n--- 3. Testing Context-Aware Mentor Chat Execution ---');
    const chatResult = await executeMentorChat(testUser.id, 'How do I optimize my study habit for weak concepts?');

    console.log('Mentor Chat Response Output:', JSON.stringify({
      sessionId: chatResult.sessionId,
      answer: chatResult.answer.slice(0, 150) + '...',
      sources: chatResult.sources,
      suggestedNextActions: chatResult.suggestedNextActions,
      confidence: chatResult.confidence
    }, null, 2));

    if (chatResult.sessionId && chatResult.answer && Array.isArray(chatResult.suggestedNextActions)) {
      console.log('✅ Mentor chat execution test PASSED');
    } else {
      throw new Error('Mentor chat execution failed');
    }

    // 5. Test Session Audit Retrieval & Feedback Submission
    console.log('\n--- 4. Testing Session Audit Retrieval & Feedback Submission ---');
    const sessions = await getMentorSessions(testUser.id, 5);
    console.log(`Retrieved ${sessions.length} recorded mentor audit sessions.`);

    if (sessions.length > 0) {
      const targetSession = sessions[0];
      const feedbackResult = await submitSessionFeedback(testUser.id, targetSession.sessionId, 1, 'Great grounded explanation!');
      console.log(`Feedback submitted for session [${targetSession.sessionId}]: score = ${feedbackResult.feedbackScore}`);
      console.log('✅ Session audit and feedback test PASSED');
    } else {
      throw new Error('Session retrieval returned 0 sessions');
    }

    console.log('\n🎉 ALL AI MENTOR MVP TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMentorTestSuite();
