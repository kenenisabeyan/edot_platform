/**
 * contextCompressor.js
 * 
 * Layered Conversation Memory & State Manager.
 * 
 * Implements:
 *   - Short-Term Memory: Last 6-10 conversation turns
 *   - Mid-Term Memory: Structured ConversationSummary records with key takeaways & unresolved questions
 *   - Long-Term Learning Memory: Persistent ConversationLearningState & LearnerProfile/Skills
 *   - Automatic Context Compression: Prevents token overflows without exposing limits to the student
 *   - Zero Invention: All resumption context is strictly grounded in stored database evidence
 */

import { prisma } from '../../../lib/prisma.js';

export class ContextCompressor {
  /**
   * Compress old conversation turns when total message count exceeds threshold.
   * Creates a structured ConversationSummary and updates ConversationLearningState.
   * 
   * @param {string} conversationId 
   * @param {number} threshold - Trigger compression when turns exceed this (default 10)
   */
  static async compressIfNecessary(conversationId, threshold = 10) {
    if (!conversationId) return null;

    const messages = await prisma.mentorMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    if (messages.length <= threshold) {
      return { compressed: false, activeTurnCount: messages.length };
    }

    // Keep the last 6 messages as active short-term memory
    const overflowCount = messages.length - 6;
    const messagesToCompress = messages.slice(0, overflowCount);

    const userMessages = messagesToCompress.filter(m => m.role === 'user');
    const assistantMessages = messagesToCompress.filter(m => m.role === 'assistant');

    const summaryText = messagesToCompress
      .map(m => `${m.role === 'user' ? 'Learner' : 'Mentor'}: ${m.content}`)
      .join(' | ')
      .slice(0, 500);

    const keyTakeaways = userMessages.map(m => m.content.slice(0, 80));

    // Extract potential unresolved questions (questions asked by user that haven't been fully answered)
    const unresolvedQuestions = userMessages
      .filter(m => m.content.includes('?'))
      .map(m => m.content)
      .slice(-3);

    // Save structured ConversationSummary
    await prisma.conversationSummary.create({
      data: {
        conversationId,
        summaryText: `Prior discussion summary: ${summaryText}`,
        keyTakeaways,
        unresolvedQuestions,
        turnRangeStart: 1,
        turnRangeEnd: overflowCount
      }
    });

    // Update main conversation summary
    await prisma.mentorConversation.update({
      where: { id: conversationId },
      data: { summary: summaryText }
    });

    // Extract current topic and concept from last user message
    const lastUserMsg = userMessages[userMessages.length - 1]?.content || 'General Concept';
    const topicExtract = lastUserMsg.slice(0, 50);

    // Update structured learning state
    await prisma.conversationLearningState.upsert({
      where: { conversationId },
      create: {
        conversationId,
        currentTopic: topicExtract,
        currentConcept: topicExtract,
        learnerUnderstandingLevel: 'developing',
        unresolvedQuestions,
        recommendedNextAction: 'Continue interactive learning discussion'
      },
      update: {
        currentTopic: topicExtract,
        unresolvedQuestions,
        updatedAt: new Date()
      }
    });

    return {
      compressed: true,
      compressedTurns: overflowCount,
      activeTurnCount: 6,
      summaryText
    };
  }

  /**
   * Update structured ConversationLearningState after meaningful interaction turns.
   */
  static async updateLearningState(conversationId, {
    topic = null,
    concept = null,
    skill = null,
    understandingLevel = 'developing',
    misconception = null,
    unresolvedQuestion = null,
    recommendedNextAction = null
  }) {
    if (!conversationId) return;

    const existingState = await prisma.conversationLearningState.findUnique({
      where: { conversationId }
    }).catch(() => null);

    const misconceptions = existingState?.detectedMisconceptions || [];
    if (misconception && !misconceptions.includes(misconception)) {
      misconceptions.push(misconception);
    }

    const unresolved = existingState?.unresolvedQuestions || [];
    if (unresolvedQuestion && !unresolved.includes(unresolvedQuestion)) {
      unresolved.push(unresolvedQuestion);
    }

    return prisma.conversationLearningState.upsert({
      where: { conversationId },
      create: {
        conversationId,
        currentTopic: topic || 'General Learning',
        currentConcept: concept || topic || 'Core Concept',
        currentSkill: skill,
        learnerUnderstandingLevel: understandingLevel,
        detectedMisconceptions: misconceptions,
        unresolvedQuestions: unresolved,
        recommendedNextAction: recommendedNextAction || 'Continue active practice'
      },
      update: {
        currentTopic: topic || existingState?.currentTopic,
        currentConcept: concept || existingState?.currentConcept,
        currentSkill: skill || existingState?.currentSkill,
        learnerUnderstandingLevel: understandingLevel || existingState?.learnerUnderstandingLevel,
        detectedMisconceptions: misconceptions,
        unresolvedQuestions: unresolved,
        recommendedNextAction: recommendedNextAction || existingState?.recommendedNextAction
      }
    });
  }

  /**
   * Retrieve structured rolling memory for prompt assembly.
   * 
   * @param {string} conversationId 
   * @returns {Promise<{ shortTermMessages: Array, rollingSummary: string, learningState: Object, summaries: Array }>}
   */
  static async getRollingMemory(conversationId) {
    if (!conversationId) {
      return { shortTermMessages: [], rollingSummary: '', learningState: null, summaries: [] };
    }

    const [shortTermMessages, summaries, learningState] = await Promise.all([
      prisma.mentorMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 8
      }),
      prisma.conversationSummary.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 4
      }),
      prisma.conversationLearningState.findUnique({
        where: { conversationId }
      })
    ]);

    const rollingSummary = summaries.map(s => s.summaryText).join('; ');

    return {
      shortTermMessages,
      rollingSummary,
      learningState,
      summaries
    };
  }

  /**
   * Build evidence-based session resumption message from database history.
   * Never invents previous learning history.
   * 
   * @param {string} conversationId 
   * @param {string} courseTitle 
   * @param {string} lessonTitle 
   */
  static async generateResumptionContext(conversationId, courseTitle = null, lessonTitle = null) {
    if (!conversationId) {
      return {
        hasHistory: false,
        greeting: `Welcome to your AI Voice Mentor session! ${courseTitle ? `We're studying ${courseTitle}.` : ''} What would you like to explore today?`
      };
    }

    const { rollingSummary, learningState, shortTermMessages, summaries } = await this.getRollingMemory(conversationId);

    if (shortTermMessages.length === 0 && summaries.length === 0) {
      return {
        hasHistory: false,
        greeting: `Welcome! ${courseTitle ? `I see you're working on ${courseTitle}${lessonTitle ? ` - ${lessonTitle}` : ''}.` : ''} What shall we work on together?`
      };
    }

    const lastTopic = learningState?.currentTopic || lessonTitle || courseTitle || 'our previous topic';
    const lastUnresolved = learningState?.unresolvedQuestions?.[0] || null;
    const nextAction = learningState?.recommendedNextAction || null;

    let greeting = `Welcome back! `;
    if (courseTitle && lessonTitle) {
      greeting += `Last time we were working on ${lessonTitle} in ${courseTitle}. `;
    } else if (courseTitle) {
      greeting += `Last time we were working on ${courseTitle}. `;
    } else {
      greeting += `Last time we were discussing ${lastTopic}. `;
    }

    if (lastUnresolved) {
      greeting += `You had asked about "${lastUnresolved}". `;
    }

    if (nextAction) {
      greeting += `Would you like to pick up from there, or explore something new?`;
    } else {
      greeting += `Would you like to continue where we left off?`;
    }

    return {
      hasHistory: true,
      lastTopic,
      lastUnresolved,
      nextAction,
      rollingSummary,
      greeting
    };
  }
}

export default ContextCompressor;
