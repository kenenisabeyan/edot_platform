/**
 * EDOT Intelligence — Phase 11
 * AI Mentor Conversation Service
 *
 * Manages persistent multi-turn conversation sessions between a student
 * and the EDOT AI Mentor using the MentorConversation / MentorMessage models.
 *
 * Design principles:
 * - Each conversation is strictly scoped to one userId (privacy isolation)
 * - Messages are persisted per-turn for audit and continuity
 * - Conversation context window is managed to prevent overflowing the AI context
 * - NO cross-student data leakage at any point
 */

import { prisma } from '../../../lib/prisma.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

/** Maximum messages to include in AI context window per turn */
const CONTEXT_WINDOW_MESSAGES = 10;

/** Maximum conversation history turns per student */
const MAX_CONVERSATION_MESSAGES = 200;

/**
 * Creates a new mentor conversation session for a student.
 *
 * @param {string} userId
 * @param {object} options
 * @param {string} [options.courseId]
 * @param {string} [options.lessonId]
 * @param {string} [options.title]
 * @param {string} [options.topic]
 * @returns {Promise<object>} Conversation record
 */
export async function createConversation(userId, options = {}) {
  const { courseId, lessonId, title, topic } = options;

  const conversation = await prisma.mentorConversation.create({
    data: {
      userId,
      contextCourseId: courseId || null,
      contextLessonId: lessonId || null,
      title: title || 'Learning Conversation',
      topic: topic || null,
      messageCount: 0,
      lastMessageAt: new Date()
    }
  });

  return conversation;
}

/**
 * Retrieves all mentor conversations for a student (index view).
 *
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array<object>>}
 */
export async function getConversations(userId, limit = 20) {
  return prisma.mentorConversation.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    take: Math.min(Number(limit) || 20, 50),
    select: {
      id: true,
      title: true,
      topic: true,
      contextCourseId: true,
      contextLessonId: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true
    }
  });
}

/**
 * Retrieves a specific conversation with recent messages.
 * Enforces strict ownership check.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @param {number} [messageLimit] — how many most-recent messages to load
 * @returns {Promise<object>}
 */
export async function getConversationWithMessages(userId, conversationId, messageLimit = 20) {
  const conversation = await prisma.mentorConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: Math.min(Number(messageLimit) || 20, 100),
        select: {
          id: true,
          role: true,
          content: true,
          inputType: true,
          outputType: true,
          intentType: true,
          groundingStatus: true,
          suggestedActions: true,
          sources: true,
          courseId: true,
          lessonId: true,
          createdAt: true
        }
      }
    }
  });

  if (!conversation) {
    throw new NotFoundError(`Mentor conversation [${conversationId}] not found`);
  }

  return conversation;
}

/**
 * Persists a student message turn.
 *
 * @param {string} conversationId
 * @param {string} content
 * @param {object} [meta]
 * @returns {Promise<object>}
 */
export async function addStudentMessage(conversationId, content, meta = {}) {
  const { courseId, lessonId, intentType, inputType = 'TEXT' } = meta;

  const message = await prisma.mentorMessage.create({
    data: {
      conversationId,
      role: 'STUDENT',
      content: content.slice(0, 4000), // Limit stored message length
      inputType,
      intentType: intentType || null,
      courseId: courseId || null,
      lessonId: lessonId || null
    }
  });

  await _updateConversationMeta(conversationId);
  return message;
}

/**
 * Persists a mentor (AI) response turn.
 *
 * @param {string} conversationId
 * @param {string} content
 * @param {object} [meta]
 * @returns {Promise<object>}
 */
export async function addMentorMessage(conversationId, content, meta = {}) {
  const {
    courseId,
    lessonId,
    intentType,
    groundingStatus,
    suggestedActions,
    sources,
    outputType = 'TEXT'
  } = meta;

  const message = await prisma.mentorMessage.create({
    data: {
      conversationId,
      role: 'MENTOR',
      content: content.slice(0, 8000),
      outputType,
      intentType: intentType || null,
      groundingStatus: groundingStatus || null,
      suggestedActions: suggestedActions || null,
      sources: sources || null,
      courseId: courseId || null,
      lessonId: lessonId || null
    }
  });

  await _updateConversationMeta(conversationId);
  return message;
}

/**
 * Builds a trimmed conversation history array suitable for AI context.
 * Limits to recent N messages to stay within context window budget.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
export async function buildContextWindowHistory(userId, conversationId) {
  const conversation = await prisma.mentorConversation.findFirst({
    where: { id: conversationId, userId }
  });

  if (!conversation) return [];

  const messages = await prisma.mentorMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_WINDOW_MESSAGES,
    select: { role: true, content: true, intentType: true, createdAt: true }
  });

  // Return chronological order (oldest first) for the AI context
  return messages.reverse().map(m => ({
    role: m.role === 'STUDENT' ? 'user' : 'assistant',
    content: m.content
  }));
}

/**
 * Updates a conversation summary after a full turn.
 *
 * @param {string} conversationId
 * @param {string} summary
 */
export async function updateConversationSummary(conversationId, summary) {
  if (!summary) return;
  await prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { summary: summary.slice(0, 500) }
  }).catch(() => {});
}

/**
 * Ensures the conversation belongs to the given user (authorization guard).
 *
 * @param {string} userId
 * @param {string} conversationId
 * @throws {NotFoundError}
 */
export async function assertConversationOwnership(userId, conversationId) {
  const convo = await prisma.mentorConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true }
  });

  if (!convo) {
    throw new NotFoundError(`Mentor conversation [${conversationId}] not found or not authorized`);
  }
}

/**
 * Internal: bumps messageCount and lastMessageAt on the parent conversation.
 */
async function _updateConversationMeta(conversationId) {
  await prisma.mentorConversation.update({
    where: { id: conversationId },
    data: {
      messageCount: { increment: 1 },
      lastMessageAt: new Date()
    }
  }).catch(() => {});
}
