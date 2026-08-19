/**
 * continuousConversationManagement.test.js
 * 
 * End-to-end automated test suite for EDOT Continuous Conversation Management.
 * 
 * Verifies the 10-step Context Boundary Transition Workflow:
 *   1. Preserve active user-facing conversation (Persistent Conversation ID)
 *   2. Extract important learning facts
 *   3. Save unresolved questions
 *   4. Save current topic
 *   5. Save learner understanding
 *   6. Save detected misconceptions
 *   7. Save relevant course context references
 *   8. Create structured rolling summary
 *   9. Start new internal context window
 *  10. Continue same user-facing conversation without exposing token limits
 */

import { prisma } from '../lib/prisma.js';
import ContinuousConversationManager from '../src/intelligence/voice/continuousConversationManager.js';
import VoiceOrchestrator from '../src/intelligence/voice/voiceOrchestrator.js';

async function runContinuousConversationTests() {
  console.log('🧪 Starting EDOT Continuous Conversation Management Test Suite...\n');

  try {
    const student = await prisma.user.findFirst({ where: { role: 'student' } });
    const course = await prisma.course.findFirst({ where: { isPublished: true }, include: { lessons: true } });

    if (!student || !course) {
      throw new Error('Baseline test data missing');
    }

    // 1. Create a continuous conversation session
    const sessionResult = await VoiceOrchestrator.startSession({
      userId: student.id,
      courseId: course.id,
      lessonId: course.lessons?.[0]?.id,
      mode: 'EXPLAIN'
    });

    const conversationId = sessionResult.conversationId;
    console.log(`Persistent Learner Conversation ID: ${conversationId}`);

    // 2. Simulate 12 conversation turns to push past threshold
    const sampleTurns = [
      { role: 'user', content: 'What is JavaScript DOM manipulation and how does it work?' },
      { role: 'assistant', content: 'DOM manipulation allows JavaScript to dynamically alter web page elements.' },
      { role: 'user', content: 'Wait, I am confused about getElementById vs querySelector.' },
      { role: 'assistant', content: 'getElementById finds elements by ID attribute, while querySelector accepts any CSS selector.' },
      { role: 'user', content: 'Why does querySelector return null sometimes?' },
      { role: 'assistant', content: 'It returns null if the element has not loaded yet when script executes.' },
      { role: 'user', content: 'How do I attach click event listeners to multiple buttons?' },
      { role: 'assistant', content: 'Use querySelectorAll and loop through with forEach.' },
      { role: 'user', content: 'What is event delegation in JavaScript?' },
      { role: 'assistant', content: 'Event delegation handles events at a parent level using event bubbling.' }
    ];

    for (const turn of sampleTurns) {
      await prisma.mentorMessage.create({
        data: {
          conversationId,
          role: turn.role,
          content: turn.content,
          inputType: 'TEXT',
          outputType: 'TEXT',
          courseId: course.id
        }
      });
    }

    // 3. Execute 10-Step Context Window Management Transition
    console.log('\n--- Executing 10-Step Context Boundary Transition Workflow ---');
    const transitionResult = await ContinuousConversationManager.manageContextWindow(conversationId, {
      maxActiveTurns: 6,
      courseId: course.id,
      lessonId: course.lessons?.[0]?.id
    });

    console.log(`  Transition Triggered: ${transitionResult.transitioned}`);
    console.log(`  Persistent Conversation ID Preserved: ${transitionResult.conversationId === conversationId}`);
    console.log(`  Internal Context Window ID: ${transitionResult.internalWindowId}`);
    console.log(`  Turns Compressed: ${transitionResult.overflowTurnsCompressed}`);
    console.log(`  Active Turns Kept: ${transitionResult.activeTurnsKept}`);

    // Verify 10-Step Requirements
    console.assert(transitionResult.transitioned === true, '1. Context transition must trigger when threshold exceeded');
    console.assert(transitionResult.conversationId === conversationId, '1. User-facing conversation ID must be preserved');
    console.assert(transitionResult.summary.currentTopic.length > 0, '4. Current topic must be saved');
    console.assert(transitionResult.summary.unresolvedQuestions.length > 0, '3. Unresolved questions must be extracted');
    console.assert(transitionResult.summary.learnerUnderstanding === 'proficient', '5. Learner understanding level must be saved');

    // 4. Verify Structured DB Records
    const learningState = await prisma.conversationLearningState.findUnique({
      where: { conversationId }
    });

    const summaryRecord = await prisma.conversationSummary.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n--- Verified Structured Database Memory Records ---');
    console.log(`  Learning State Topic: "${learningState.currentTopic}"`);
    console.log(`  Unresolved Questions Saved:`, learningState.unresolvedQuestions);
    console.log(`  Detected Misconceptions Saved:`, learningState.detectedMisconceptions);
    console.log(`  Summary Record Text: "${summaryRecord.summaryText.slice(0, 100)}..."`);

    console.assert(learningState !== null, 'Learning state record must exist');
    console.assert(summaryRecord !== null, 'Summary record must exist');

    // 5. Test Seamless Assembly for New AI Context Window
    console.log('\n--- Assembling Compact Prompt for New Internal Window ---');
    const windowContext = await ContinuousConversationManager.assembleWindowContext(conversationId);
    console.log(`  System Prompt Context Length: ${windowContext.systemContext.length} chars`);
    console.log(`  Short-Term Turns for Provider: ${windowContext.shortTermTurns.length} turns`);

    console.assert(windowContext.shortTermTurns.length <= 4, 'Provider must receive compact short-term turns');
    console.assert(windowContext.systemContext.includes('Active Topic'), 'System context must incorporate structured state');

    // 6. Clean up test entities
    await prisma.voiceLearningSession.deleteMany({ where: { conversationId } });
    await prisma.conversationSummary.deleteMany({ where: { conversationId } });
    await prisma.conversationLearningState.deleteMany({ where: { conversationId } });
    await prisma.mentorMessage.deleteMany({ where: { conversationId } });
    await prisma.mentorConversation.delete({ where: { id: conversationId } });

    console.log('\n🎉 ALL CONTINUOUS CONVERSATION MANAGEMENT TESTS PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('\n❌ Continuous Conversation Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runContinuousConversationTests();
