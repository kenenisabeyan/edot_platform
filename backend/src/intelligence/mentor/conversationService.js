/**
 * EDOT Intelligence — Phase 23
 * AI Mentor Real Conversation & Multimodal Persistence Service
 * conversationService.js
 *
 * Manages persistent multimodal conversation sessions between a student
 * and the EDOT AI Mentor using the database as the sole source of truth.
 *
 * Architecture Principles:
 * 1. DATABASE SOURCE OF TRUTH: Frontend state is never authoritative. Conversations persist across refreshes, logouts, and restarts.
 * 2. IDEMPOTENCY PROTECTION: Uses clientMessageId to prevent duplicate message creation from double-clicks or retries.
 * 3. MULTIMODAL UNIFIED THREADS: Text, Voice, and Video interactions share one conversation thread without creating separate empty sessions.
 * 4. USER-CONTROLLED SOFT DELETION & ARCHIVE: Conversations & messages can be archived or soft-deleted (status = 'DELETED'). Deleted content is excluded from AI context and search.
 * 5. SERVER-SIDE PRIVACY & AUTHORIZATION: Enforces strict ownership checks; accessing another student's thread returns 403 Forbidden.
 */

import { prisma } from '../../../lib/prisma.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../shared/errors.js';

/** Maximum messages to include in AI context window per turn */
const CONTEXT_WINDOW_MESSAGES = 15;

/**
 * Creates a new mentor conversation session for a student.
 * Note: Defer permanent creation until first interaction if preferred, or create with initial options.
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.courseId]
 * @param {string} [options.lessonId]
 * @param {string} [options.title]
 * @param {string} [options.topic]
 * @param {string} [options.conversationType] — 'TEXT' | 'VOICE' | 'VIDEO' | 'MIXED'
 * @returns {Promise<object>} Conversation record
 */
export async function createConversation(userId, options = {}) {
  const { courseId, lessonId, title, topic, conversationType = 'MIXED' } = options;

  return prisma.mentorConversation.create({
    data: {
      userId,
      contextCourseId: courseId || null,
      contextLessonId: lessonId || null,
      title: title || 'New Learning Conversation',
      topic: topic || null,
      conversationType,
      status: 'ACTIVE',
      messageCount: 0,
      lastMessageAt: new Date()
    }
  });
}

/**
 * Retrieves conversations for a student with filtering, status selection, and search.
 * Excludes DELETED conversations.
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.limit=20]
 * @param {string} [options.status='ACTIVE'] — 'ACTIVE' | 'ARCHIVED' | 'ALL'
 * @param {string} [options.search] — optional search query for title or topic
 * @returns {Promise<Array<object>>}
 */
export async function getConversations(userId, options = {}) {
  const limit = Math.min(Number(options.limit) || 20, 100);
  const statusFilter = options.status === 'ALL'
    ? { in: ['ACTIVE', 'ARCHIVED'] }
    : (options.status || 'ACTIVE');

  const whereClause = {
    userId,
    status: statusFilter
  };

  if (options.search && typeof options.search === 'string') {
    const query = options.search.trim();
    whereClause.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { topic: { contains: query, mode: 'insensitive' } }
    ];
  }

  return prisma.mentorConversation.findMany({
    where: whereClause,
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      topic: true,
      status: true,
      conversationType: true,
      contextCourseId: true,
      contextLessonId: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

/**
 * Retrieves a specific conversation with non-deleted message history.
 * Enforces strict ownership check.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @param {number} [messageLimit=50]
 * @returns {Promise<object>}
 */
export async function getConversationWithMessages(userId, conversationId, messageLimit = 50) {
  const conversation = await prisma.mentorConversation.findFirst({
    where: { id: conversationId, userId, status: { not: 'DELETED' } },
    include: {
      messages: {
        where: { status: { not: 'DELETED' } },
        orderBy: { createdAt: 'asc' },
        take: Math.min(Number(messageLimit) || 50, 200),
        select: {
          id: true,
          clientMessageId: true,
          role: true,
          sender: true,
          content: true,
          messageType: true,
          inputType: true,
          outputType: true,
          audioUrl: true,
          videoUrl: true,
          transcript: true,
          metadata: true,
          intentType: true,
          groundingStatus: true,
          suggestedActions: true,
          sources: true,
          status: true,
          courseId: true,
          lessonId: true,
          createdAt: true
        }
      }
    }
  });

  if (!conversation) {
    throw new NotFoundError(`Mentor conversation [${conversationId}] not found or access denied.`);
  }

  return conversation;
}

/**
 * Persists a student message turn with idempotency protection.
 *
 * @param {string} conversationId
 * @param {string} content
 * @param {object} [meta]
 * @returns {Promise<object>}
 */
export async function addStudentMessage(conversationId, content, meta = {}) {
  const {
    clientMessageId,
    courseId,
    lessonId,
    intentType,
    messageType = 'TEXT',
    inputType = 'TEXT',
    audioUrl,
    videoUrl,
    transcript,
    metadata
  } = meta;

  // Idempotency check: Return existing message if clientMessageId already processed
  if (clientMessageId) {
    const existing = await prisma.mentorMessage.findFirst({
      where: { conversationId, clientMessageId }
    });
    if (existing) return existing;
  }

  const message = await prisma.mentorMessage.create({
    data: {
      conversationId,
      clientMessageId: clientMessageId || null,
      role: 'STUDENT',
      sender: 'STUDENT',
      content: (content || '').slice(0, 8000),
      messageType,
      inputType,
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      transcript: transcript || null,
      metadata: metadata || null,
      intentType: intentType || null,
      courseId: courseId || null,
      lessonId: lessonId || null,
      status: 'ACTIVE'
    }
  });

  // Auto-generate title if conversation is brand new or using default title
  await _autoGenerateTitleIfNeeded(conversationId, content);
  await _updateConversationMeta(conversationId);

  return message;
}

/**
 * Persists a mentor (AI) response turn with idempotency protection.
 *
 * @param {string} conversationId
 * @param {string} content
 * @param {object} [meta]
 * @returns {Promise<object>}
 */
export async function addMentorMessage(conversationId, content, meta = {}) {
  const {
    clientMessageId,
    courseId,
    lessonId,
    intentType,
    groundingStatus,
    suggestedActions,
    sources,
    outputType = 'TEXT',
    messageType = 'TEXT',
    audioUrl,
    videoUrl,
    status = 'ACTIVE'
  } = meta;

  if (clientMessageId) {
    const existing = await prisma.mentorMessage.findFirst({
      where: { conversationId, clientMessageId }
    });
    if (existing) return existing;
  }

  const message = await prisma.mentorMessage.create({
    data: {
      conversationId,
      clientMessageId: clientMessageId || null,
      role: 'MENTOR',
      sender: 'AI',
      content: (content || '').slice(0, 12000),
      messageType,
      outputType,
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      intentType: intentType || null,
      groundingStatus: groundingStatus || null,
      suggestedActions: suggestedActions || null,
      sources: sources || null,
      courseId: courseId || null,
      lessonId: lessonId || null,
      status
    }
  });

  await _updateConversationMeta(conversationId);
  return message;
}

/**
 * Updates a conversation's title.
 */
export async function updateConversationTitle(userId, conversationId, newTitle) {
  await assertConversationOwnership(userId, conversationId);
  if (!newTitle || typeof newTitle !== 'string' || !newTitle.trim()) {
    throw new ValidationError('newTitle string is required');
  }

  return prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { title: newTitle.trim().slice(0, 100) }
  });
}

/**
 * Archives a conversation (hides from active view).
 */
export async function archiveConversation(userId, conversationId) {
  await assertConversationOwnership(userId, conversationId);
  return prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { status: 'ARCHIVED' }
  });
}

/**
 * Restores an archived conversation back to active.
 */
export async function restoreConversation(userId, conversationId) {
  await assertConversationOwnership(userId, conversationId);
  return prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { status: 'ACTIVE' }
  });
}

/**
 * Soft-deletes a conversation and its messages.
 */
export async function deleteConversation(userId, conversationId) {
  await assertConversationOwnership(userId, conversationId);

  const now = new Date();
  await prisma.$transaction([
    prisma.mentorConversation.update({
      where: { id: conversationId },
      data: { status: 'DELETED', deletedAt: now }
    }),
    prisma.mentorMessage.updateMany({
      where: { conversationId },
      data: { status: 'DELETED', deletedAt: now }
    })
  ]);

  return { id: conversationId, status: 'DELETED' };
}

/**
 * Soft-deletes an individual message safely.
 */
export async function deleteMessage(userId, conversationId, messageId) {
  await assertConversationOwnership(userId, conversationId);

  const message = await prisma.mentorMessage.findFirst({
    where: { id: messageId, conversationId }
  });

  if (!message) {
    throw new NotFoundError(`Message [${messageId}] not found in conversation [${conversationId}]`);
  }

  await prisma.mentorMessage.update({
    where: { id: messageId },
    data: { status: 'DELETED', deletedAt: new Date() }
  });

  // Recalculate messageCount
  const activeCount = await prisma.mentorMessage.count({
    where: { conversationId, status: { not: 'DELETED' } }
  });

  await prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { messageCount: activeCount }
  });

  return { id: messageId, status: 'DELETED' };
}

/**
 * Builds context window history for AI system instructions, excluding soft-deleted messages.
 */
export async function buildContextWindowHistory(userId, conversationId) {
  const conversation = await prisma.mentorConversation.findFirst({
    where: { id: conversationId, userId, status: { not: 'DELETED' } }
  });

  if (!conversation) return [];

  const messages = await prisma.mentorMessage.findMany({
    where: { conversationId, status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_WINDOW_MESSAGES,
    select: { role: true, content: true, intentType: true, createdAt: true }
  });

  return messages.reverse().map(m => ({
    role: m.role === 'STUDENT' ? 'user' : 'assistant',
    content: m.content
  }));
}

/**
 * Updates a conversation summary.
 */
export async function updateConversationSummary(conversationId, summary) {
  if (!summary) return;
  await prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { summary: summary.slice(0, 500) }
  }).catch(() => {});
}

/**
 * Strict server-side ownership authorization guard.
 */
export async function assertConversationOwnership(userId, conversationId) {
  if (!userId || !conversationId) {
    throw new ForbiddenError('Authentication and valid conversation ID required');
  }

  const convo = await prisma.mentorConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, userId: true, status: true }
  });

  if (!convo) {
    throw new ForbiddenError(`Forbidden: Access denied to conversation [${conversationId}]`);
  }
}

/**
 * Internal: updates messageCount and lastMessageAt.
 */
async function _updateConversationMeta(conversationId) {
  const activeCount = await prisma.mentorMessage.count({
    where: { conversationId, status: { not: 'DELETED' } }
  });

  await prisma.mentorConversation.update({
    where: { id: conversationId },
    data: {
      messageCount: activeCount,
      lastMessageAt: new Date()
    }
  }).catch(() => {});
}

/**
 * Internal: auto-generates dynamic title from first meaningful user prompt.
 */
async function _autoGenerateTitleIfNeeded(conversationId, firstPrompt) {
  if (!firstPrompt || typeof firstPrompt !== 'string') return;

  try {
    const convo = await prisma.mentorConversation.findUnique({
      where: { id: conversationId },
      select: { title: true, messageCount: true }
    });

    if (convo && (convo.title === 'New Learning Conversation' || convo.messageCount === 0)) {
      const cleanPrompt = firstPrompt.trim().replace(/^(help me|can you|explain|what is|how do i)\s+/i, '');
      const generated = cleanPrompt.charAt(0).toUpperCase() + cleanPrompt.slice(1, 45);
      await prisma.mentorConversation.update({
        where: { id: conversationId },
        data: { title: generated }
      });
    }
  } catch {
    // Non-critical auto-title fallback
  }
}
