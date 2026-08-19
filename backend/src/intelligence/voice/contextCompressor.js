/**
 * contextCompressor.js
 * 
 * Rolling Conversation Memory Compressor & Context Manager.
 * Ensures long learning conversations remain continuous without exposing token limit errors.
 */

import { prisma } from '../../../lib/prisma.js';

export class ContextCompressor {
  /**
   * Compress old conversation turns when total message count exceeds threshold.
   * @param {string} conversationId 
   * @param {number} threshold - Trigger compression when turns exceed this (default 12)
   */
  static async compressIfNecessary(conversationId, threshold = 12) {
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

    const summaryText = messagesToCompress
      .map((m) => `${m.role === 'user' ? 'Learner' : 'Mentor'}: ${m.content}`)
      .join(' | ')
      .slice(0, 500);

    const keyTakeaways = messagesToCompress
      .filter((m) => m.role === 'user')
      .map((m) => m.content.slice(0, 60));

    await prisma.conversationSummary.create({
      data: {
        conversationId,
        summaryText: `Prior discussion summary: ${summaryText}`,
        keyTakeaways,
        turnRangeStart: 1,
        turnRangeEnd: overflowCount
      }
    });

    // Update conversation summary field
    await prisma.mentorConversation.update({
      where: { id: conversationId },
      data: { summary: summaryText }
    });

    // Update structured learning state
    await prisma.conversationLearningState.upsert({
      where: { conversationId },
      create: {
        conversationId,
        currentTopic: 'Ongoing Learning Discussion',
        learnerUnderstandingLevel: 'developing',
        recommendedNextAction: 'Continue interactive learning steps'
      },
      update: {
        recommendedNextAction: 'Continue active discussion'
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
   * Retrieve structured rolling memory for prompt assembly.
   * @param {string} conversationId 
   * @returns {Promise<{ shortTermMessages: Array, rollingSummary: string, learningState: Object }>}
   */
  static async getRollingMemory(conversationId) {
    if (!conversationId) {
      return { shortTermMessages: [], rollingSummary: '', learningState: null };
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
        take: 3
      }),
      prisma.conversationLearningState.findUnique({
        where: { conversationId }
      })
    ]);

    const rollingSummary = summaries.map((s) => s.summaryText).join('; ');

    return {
      shortTermMessages,
      rollingSummary,
      learningState
    };
  }
}

export default ContextCompressor;
