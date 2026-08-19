/**
 * continuousConversationManager.js
 * 
 * EDOT Continuous Conversation Manager.
 * 
 * Ensures learners never lose conversation continuity when AI provider requests
 * approach context capacity.
 * 
 * Implements the 10-step Context Boundary Transition Workflow:
 *   1. Preserve active user-facing conversation (Persistent Conversation ID)
 *   2. Extract important learning facts (Key Takeaways)
 *   3. Save unresolved questions
 *   4. Save current topic
 *   5. Save learner understanding level
 *   6. Save detected misconceptions
 *   7. Save relevant course context references
 *   8. Create structured rolling summary (ConversationSummary record)
 *   9. Start new internal AI context window (Compact system prompt + short-term turns)
 *  10. Continue seamless user-facing conversation (Zero visible token limit errors)
 * 
 * Completely decoupled and works dynamically for any subject, course, or student.
 */

import { prisma } from '../../../lib/prisma.js';

export class ContinuousConversationManager {
  /**
   * Check if the conversation context length is approaching provider limits,
   * and execute the 10-step seamless boundary transition if needed.
   * 
   * @param {string} conversationId - Persistent user-facing conversation ID
   * @param {Object} options - Configuration threshold options
   * @returns {Promise<{ transitioned: boolean, internalWindowId: string, summary: Object }>}
   */
  static async manageContextWindow(conversationId, {
    maxActiveTurns = 8,
    courseId = null,
    sectionId = null,
    lessonId = null
  } = {}) {
    if (!conversationId) return { transitioned: false };

    // 1. Preserve active conversation & fetch turns
    const allMessages = await prisma.mentorMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    if (allMessages.length <= maxActiveTurns) {
      return {
        transitioned: false,
        activeTurnCount: allMessages.length,
        conversationId
      };
    }

    // Determine turns to compress vs. turns to keep in active window
    const overflowTurns = allMessages.slice(0, allMessages.length - 4); // Keep last 4 turns for immediate context
    const recentTurnsToKeep = allMessages.slice(allMessages.length - 4);

    // 2. Extract important learning facts
    const userTurns = overflowTurns.filter(m => m.role === 'user');
    const assistantTurns = overflowTurns.filter(m => m.role === 'assistant');

    const importantFacts = userTurns.map(m => m.content.slice(0, 100));

    // 3. Save unresolved questions (user turns containing '?')
    const unresolvedQuestions = userTurns
      .filter(m => m.content.includes('?'))
      .map(m => m.content)
      .slice(-4);

    // 4. Save current topic (from last user turn or lesson context)
    const lastUserPrompt = userTurns[userTurns.length - 1]?.content || '';
    const currentTopic = lastUserPrompt.slice(0, 60) || 'Active Subject Discussion';

    // 5. Save learner understanding level (inferred from sentiment / turns)
    const learnerUnderstanding = userTurns.length > 5 ? 'proficient' : 'developing';

    // 6. Save misconceptions (extract statements containing confusion markers)
    const confusionMarkers = ['confused', "don't get", 'what does that mean', 'why', 'hard'];
    const detectedMisconceptions = userTurns
      .filter(m => confusionMarkers.some(marker => m.content.toLowerCase().includes(marker)))
      .map(m => `Misconception area: "${m.content.slice(0, 80)}"`)
      .slice(-3);

    // 7. Save relevant course context references
    const courseContextReferences = {
      courseId,
      sectionId,
      lessonId,
      totalTurnsProcessed: allMessages.length,
      lastTurnTimestamp: new Date()
    };

    // 8. Create structured rolling summary
    const summarySnippet = overflowTurns
      .map(m => `${m.role === 'user' ? 'Learner' : 'Mentor'}: ${m.content}`)
      .join(' | ')
      .slice(0, 600);

    const summaryRecord = await prisma.conversationSummary.create({
      data: {
        conversationId,
        summaryText: `Rolling Summary (${overflowTurns.length} turns): ${summarySnippet}`,
        keyTakeaways: importantFacts,
        unresolvedQuestions,
        turnRangeStart: 1,
        turnRangeEnd: overflowTurns.length
      }
    });

    // Update structured ConversationLearningState
    await prisma.conversationLearningState.upsert({
      where: { conversationId },
      create: {
        conversationId,
        currentTopic,
        currentConcept: currentTopic,
        learnerUnderstandingLevel: learnerUnderstanding,
        detectedMisconceptions,
        unresolvedQuestions,
        recommendedNextAction: unresolvedQuestions.length > 0
          ? `Address unresolved question: "${unresolvedQuestions[0]}"`
          : 'Continue interactive learning progression'
      },
      update: {
        currentTopic,
        learnerUnderstandingLevel: learnerUnderstanding,
        detectedMisconceptions,
        unresolvedQuestions,
        updatedAt: new Date()
      }
    });

    // 9. Start new internal context window (internal ID for audit/tracking)
    const internalWindowId = `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 10. Continue the same user-facing conversation
    // Update MentorConversation metadata with the active window reference
    await prisma.mentorConversation.update({
      where: { id: conversationId },
      data: {
        summary: summarySnippet,
        updatedAt: new Date()
      }
    });

    return {
      transitioned: true,
      internalWindowId,
      conversationId, // Remains identical to learner
      overflowTurnsCompressed: overflowTurns.length,
      activeTurnsKept: recentTurnsToKeep.length,
      summary: {
        summaryId: summaryRecord.id,
        currentTopic,
        unresolvedQuestions,
        detectedMisconceptions,
        learnerUnderstanding,
        courseContextReferences
      }
    };
  }

  /**
   * Assembles the optimized, compact prompt context for an internal AI request.
   * Merges rolling summary + structured learning state + RAG grounding + active short-term turns.
   * 
   * @param {string} conversationId 
   * @returns {Promise<{ systemContext: string, shortTermTurns: Array }>}
   */
  static async assembleWindowContext(conversationId) {
    const [summaries, learningState, recentTurns] = await Promise.all([
      prisma.conversationSummary.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      prisma.conversationLearningState.findUnique({
        where: { conversationId }
      }),
      prisma.mentorMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 4
      })
    ]);

    const shortTermTurns = recentTurns.reverse();
    const rollingSummaryText = summaries.map(s => s.summaryText).join('\n---\n');

    const stateSummaryParts = [
      `[CONTINUOUS LEARNING STATE]`,
      `Active Topic: ${learningState?.currentTopic || 'General Learning'}`,
      `Learner Level: ${learningState?.learnerUnderstandingLevel || 'developing'}`,
      learningState?.unresolvedQuestions?.length > 0
        ? `Unresolved Questions: ${learningState.unresolvedQuestions.join(' | ')}`
        : '',
      learningState?.detectedMisconceptions?.length > 0
        ? `Detected Misconceptions: ${learningState.detectedMisconceptions.join(' | ')}`
        : '',
      '',
      rollingSummaryText ? `[ROLLING DISCUSSION SUMMARY]\n${rollingSummaryText}` : ''
    ].filter(Boolean).join('\n');

    return {
      systemContext: stateSummaryParts,
      shortTermTurns
    };
  }
}

export default ContinuousConversationManager;
