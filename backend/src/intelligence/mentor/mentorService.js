/**
 * EDOT Intelligence — Phase 23
 * AI Mentor Service (Full Pipeline & Multimodal Real Persistence)
 * mentorService.js
 *
 * Orchestrates the complete AI Mentor response cycle for Text, Voice, and Video turns:
 *   Student Input (Text/Voice/Video)
 *     → Client Idempotency Check (clientMessageId)
 *     → Authorization & Ownership Check
 *     → Immediate Student Message Database Persistence
 *     → Intent Detection
 *     → Authorized Learning Context Resolution
 *     → Context Window History Load
 *     → AI Provider Call with Safe Error Boundaries
 *     → AI Response Database Persistence (status = ACTIVE or FAILED)
 *     → Closed-Loop Event Dispatch
 *     → DTO Return
 */

import { prisma } from '../../../lib/prisma.js';
import { buildStudentLearningContext } from './contextBuilder.js';
import { detectIntent, isLearnerMetaIntent } from './intentDetector.js';
import {
  detectHumanSupportNeed,
  buildMentorSystemInstruction,
  parseAndValidateMentorResponse
} from './promptOrchestrator.js';
import { defaultAIProvider } from './providerAdapter.js';
import { resolveAndValidateActions, normalizeAISuggestions } from './mentorActionResolver.js';
import {
  createConversation,
  getConversations,
  getConversationWithMessages,
  addStudentMessage,
  addMentorMessage,
  buildContextWindowHistory,
  updateConversationSummary,
  assertConversationOwnership,
  archiveConversation,
  restoreConversation,
  deleteConversation,
  deleteMessage,
  updateConversationTitle
} from './conversationService.js';
import { updateDurableLearnerMemory } from '../context/contextMemoryService.js';
import { eventBus } from '../shared/eventBus.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../shared/errors.js';

// Re-export conversation management APIs
export {
  createConversation,
  getConversations,
  getConversationWithMessages,
  archiveConversation,
  restoreConversation,
  deleteConversation,
  deleteMessage,
  updateConversationTitle
};

// ── Core Chat Execution ───────────────────────────────────────────────────────

/**
 * Executes a context-aware AI Mentor chat turn within a conversation.
 *
 * @param {string} userId
 * @param {string} message
 * @param {object} [options]
 * @param {string} [options.courseId]
 * @param {string} [options.lessonId]
 * @param {string} [options.conversationId] — continues existing thread
 * @param {string} [options.clientMessageId] — idempotency key
 * @param {string} [options.inputType] — 'TEXT' | 'VOICE' | 'VIDEO'
 * @returns {Promise<object>} Mentor response DTO
 */
export async function executeMentorChat(userId, message, options = {}) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ValidationError('message string is required for AI Mentor chat');
  }

  const { courseId, lessonId, clientMessageId, inputType = 'TEXT' } = options;
  let { conversationId } = options;

  // ── Step 1: Idempotency check ──
  if (conversationId && clientMessageId) {
    await assertConversationOwnership(userId, conversationId);
    const existingMsg = await prisma.mentorMessage.findFirst({
      where: { conversationId, clientMessageId }
    });
    if (existingMsg) {
      // Find associated mentor response if already generated
      const existingAiMsg = await prisma.mentorMessage.findFirst({
        where: { conversationId, responseId: existingMsg.id }
      });
      return {
        conversationId,
        messageId: existingMsg.id,
        answer: existingAiMsg?.content || 'Your message was saved.',
        groundingStatus: existingAiMsg?.groundingStatus || 'COURSE_GROUNDED',
        suggestedActions: existingAiMsg?.suggestedActions || [],
        isDuplicateResult: true
      };
    }
  }

  // ── Step 2: Resolve or Create Conversation ──
  if (conversationId) {
    await assertConversationOwnership(userId, conversationId);
  } else {
    const newConvo = await createConversation(userId, {
      courseId,
      lessonId,
      title: `Chat: ${message.trim().slice(0, 50)}`
    });
    conversationId = newConvo.id;
  }

  // Asynchronously extract long-term goals & preferences without blocking
  updateDurableLearnerMemory(userId, message.trim()).catch(() => {});
  eventBus.publish('AI_EXPLANATION_REQUESTED', { userId, conversationId, message: message.trim() });

  // ── Step 3: Immediately Persist Student Message (DB is source of truth) ──
  const studentMsg = await addStudentMessage(conversationId, message.trim(), {
    clientMessageId,
    courseId,
    lessonId,
    inputType,
    messageType: inputType === 'VOICE' ? 'VOICE' : (inputType === 'VIDEO' ? 'VIDEO' : 'TEXT')
  });

  // ── Step 4: Intent Detection & Human Support Check ──
  const { intent, confidence: intentConfidence } = detectIntent(message);
  const humanSupportSignal = detectHumanSupportNeed(message);

  // ── Step 5: Build Authorized Learning Context & Window History ──
  const learningContext = await buildStudentLearningContext(userId, { courseId, lessonId });
  const conversationHistory = await buildContextWindowHistory(userId, conversationId);
  learningContext.systemInstruction = buildMentorSystemInstruction(learningContext, intent, conversationHistory);

  // ── Step 6: Meta Intent Fast Path (deterministic) ──
  if (isLearnerMetaIntent(intent) && intent === 'WHAT_SHOULD_I_DO_NEXT') {
    return _buildNextActionResponse(userId, conversationId, learningContext, intent, courseId, lessonId);
  }

  // ── Step 7: AI Provider Call with Safe Error Handling ──
  let aiResult;
  try {
    aiResult = await defaultAIProvider.chat(message.trim(), learningContext);
  } catch (err) {
    console.error('[MentorService] AI Provider call failed:', err.message);

    // Save failed state AI message so student message is NEVER lost
    const failedAiMsg = await addMentorMessage(conversationId, 'Your message was saved, but the AI response could not be completed. Click Retry to generate a response.', {
      courseId,
      lessonId,
      intentType: intent,
      status: 'FAILED'
    });

    return {
      conversationId,
      studentMessageId: studentMsg.id,
      mentorMessageId: failedAiMsg.id,
      intent,
      answer: failedAiMsg.content,
      isFailed: true,
      canRetry: true
    };
  }

  // ── Step 8: Parse & Validate AI Response ──
  const validated = parseAndValidateMentorResponse(aiResult.rawText, learningContext);
  if (humanSupportSignal) {
    validated.needsHumanSupport = true;
    validated.suggestedNextActions.unshift('Connect with your course instructor or EDOT support');
  }

  // ── Step 9: Server-Side Action Resolution ──
  let resolvedActions;
  const rawActions = Array.isArray(validated.suggestedNextActions) ? validated.suggestedNextActions : [];
  try {
    resolvedActions = await resolveAndValidateActions(userId, rawActions, courseId);
  } catch {
    resolvedActions = normalizeAISuggestions(rawActions);
  }

  if (Array.isArray(resolvedActions) && resolvedActions.length > 3) {
    resolvedActions = resolvedActions.slice(0, 3);
  }

  // ── Step 10: Persist AI Response Message ──
  const mentorMsg = await addMentorMessage(conversationId, validated.answer, {
    courseId,
    lessonId,
    intentType: intent,
    groundingStatus: validated.groundingStatus,
    suggestedActions: resolvedActions,
    sources: validated.sources
  });

  if (validated.conversationSummary) {
    await updateConversationSummary(conversationId, validated.conversationSummary);
  }

  await _persistLegacySession(userId, courseId, lessonId, message, validated, aiResult);

  return {
    conversationId,
    studentMessageId: studentMsg.id,
    mentorMessageId: mentorMsg.id,
    intent,
    intentConfidence,
    answer: validated.answer,
    groundingStatus: validated.groundingStatus,
    sources: validated.sources,
    suggestedActions: resolvedActions,
    confidence: validated.confidence,
    needsHumanSupport: validated.needsHumanSupport,
    provider: aiResult.provider || 'unknown'
  };
}

// ── Multimodal Voice Turn Execution ──────────────────────────────────────────

/**
 * Executes a Voice Mentor turn within a conversation.
 */
export async function executeVoiceMentorTurn(userId, params = {}) {
  const { conversationId, audioUrl, transcript, prompt, clientMessageId, courseId, lessonId } = params;
  const userText = transcript || prompt || 'Voice input session';

  let convoId = conversationId;
  if (!convoId) {
    const convo = await createConversation(userId, {
      courseId,
      lessonId,
      title: `Voice Session: ${userText.slice(0, 40)}`,
      conversationType: 'VOICE'
    });
    convoId = convo.id;
  }

  // Execute mentor chat turn with VOICE inputType
  return executeMentorChat(userId, userText, {
    conversationId: convoId,
    clientMessageId,
    courseId,
    lessonId,
    inputType: 'VOICE'
  });
}

// ── Multimodal Video Turn Execution ──────────────────────────────────────────

/**
 * Executes a Video Mentor turn within a conversation.
 */
export async function executeVideoMentorTurn(userId, params = {}) {
  const { conversationId, videoUrl, transcript, prompt, clientMessageId, courseId, lessonId } = params;
  const userText = transcript || prompt || 'Video interaction session';

  let convoId = conversationId;
  if (!convoId) {
    const convo = await createConversation(userId, {
      courseId,
      lessonId,
      title: `Video Session: ${userText.slice(0, 40)}`,
      conversationType: 'VIDEO'
    });
    convoId = convo.id;
  }

  return executeMentorChat(userId, userText, {
    conversationId: convoId,
    clientMessageId,
    courseId,
    lessonId,
    inputType: 'VIDEO'
  });
}

// ── Conversation Management Wrapper Functions ─────────────────────────────────

export async function startConversation(userId, options = {}) {
  return createConversation(userId, options);
}

export async function listConversations(userId, options = {}) {
  return getConversations(userId, options);
}

export async function getConversation(userId, conversationId, messageLimit = 50) {
  return getConversationWithMessages(userId, conversationId, messageLimit);
}

// ── Legacy Session History ────────────────────────────────────────────────────

export async function getMentorSessions(userId, limit = 20) {
  return prisma.mentorSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 20, 50)
  });
}

export async function getMentorSessionById(userId, sessionId) {
  const session = await prisma.mentorSession.findFirst({
    where: { sessionId, userId }
  });
  if (!session) {
    throw new NotFoundError(`Mentor session [${sessionId}] not found`);
  }
  return session;
}

export async function submitSessionFeedback(userId, sessionId, feedbackScore, feedbackComment) {
  if (feedbackScore === undefined || isNaN(Number(feedbackScore))) {
    throw new ValidationError('feedbackScore number is required');
  }

  const session = await prisma.mentorSession.findFirst({
    where: { sessionId, userId }
  });

  if (!session) {
    throw new NotFoundError(`Mentor session [${sessionId}] not found`);
  }

  return prisma.mentorSession.update({
    where: { id: session.id },
    data: {
      feedbackScore: Number(feedbackScore),
      feedbackComment: feedbackComment ? String(feedbackComment).trim() : null
    }
  });
}

// ── Private Helpers ───────────────────────────────────────────────────────────

async function _buildNextActionResponse(userId, conversationId, context, intent, courseId, lessonId) {
  const nextAction = context.recommendedNextAction || {
    actionType: 'CONTINUE_CURRENT_LESSON',
    explanation: `Continue working through ${context.currentLessonTitle || 'your current lesson'}.`
  };

  let answer = `Based on your current learning progress in **${context.currentCourseTitle || 'your course'}**, `;
  answer += `your recommended next step is: **${nextAction.actionType.replace(/_/g, ' ')}**.\n\n`;
  answer += nextAction.explanation || '';

  const suggestedActions = [
    { type: nextAction.actionType, label: nextAction.explanation || nextAction.actionType, verified: true },
    { type: 'GENERIC', label: 'Review your Personal Learning Plan', verified: true }
  ];

  await addMentorMessage(conversationId, answer, {
    courseId,
    lessonId,
    intentType: intent,
    groundingStatus: 'EDOT_KNOWLEDGE_GROUNDED',
    suggestedActions,
    sources: [context.currentCourseTitle || 'EDOT Learning Engine']
  });

  return {
    conversationId,
    intent,
    intentConfidence: 0.95,
    answer,
    groundingStatus: 'EDOT_KNOWLEDGE_GROUNDED',
    sources: [context.currentCourseTitle || 'EDOT Learning Engine'],
    suggestedActions,
    confidence: 0.95,
    needsHumanSupport: false,
    provider: 'edot-personal-learning-engine'
  };
}

async function _persistLegacySession(userId, courseId, lessonId, message, validated, aiResult) {
  try {
    await prisma.mentorSession.create({
      data: {
        userId,
        courseId: courseId || null,
        lessonId: lessonId || null,
        promptSummary: message.trim().slice(0, 300),
        responseSummary: validated.answer.slice(0, 400),
        contextVersion: 'v3.0-phase23',
        sources: validated.sources,
        suggestedNextActions: validated.suggestedNextActions,
        confidenceScore: validated.confidence,
        needsHumanSupport: validated.needsHumanSupport,
        tokenCount: aiResult?.tokenCount || 100
      }
    });
  } catch (err) {
    console.warn('[MentorService] Legacy session persist failed (non-critical):', err.message);
  }
}
