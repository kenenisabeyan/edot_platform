/**
 * EDOT Intelligence — Phase 11
 * AI Mentor Service (Full Pipeline)
 *
 * Orchestrates the complete AI Mentor response cycle:
 *   Student Message
 *     → Intent Detection
 *     → Authorization Check
 *     → Secure Context Build (Phases 2, 3, 8, 9, 10)
 *     → Conversation History Load
 *     → Intent-Aware Prompt Build
 *     → AI Provider Call
 *     → Response Parse & Validate
 *     → Action Resolution (Server-Side Validation)
 *     → Persist Student + Mentor Messages
 *     → Return Safe Response DTO
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
  assertConversationOwnership
} from './conversationService.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

// ── Core Chat Execution ───────────────────────────────────────────────────────

/**
 * Executes a full AI Mentor chat turn within a conversation.
 *
 * Supports both:
 * - Multi-turn: client provides an existing conversationId
 * - Single-shot: no conversationId → creates a new conversation
 *
 * @param {string} userId
 * @param {string} message
 * @param {object} [options]
 * @param {string} [options.courseId]
 * @param {string} [options.lessonId]
 * @param {string} [options.conversationId] — if provided, continues existing thread
 * @param {string} [options.inputType] — 'TEXT' | 'VOICE'
 * @returns {Promise<object>} Mentor response DTO
 */
export async function executeMentorChat(userId, message, options = {}) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ValidationError('message string is required for AI Mentor chat');
  }

  const { courseId, lessonId, inputType = 'TEXT' } = options;
  let { conversationId } = options;

  // ── Step 1: Resolve or Create Conversation ──
  if (conversationId) {
    await assertConversationOwnership(userId, conversationId);
  } else {
    const newConvo = await createConversation(userId, {
      courseId,
      lessonId,
      title: `Chat: ${message.trim().slice(0, 60)}`
    });
    conversationId = newConvo.id;
  }

  // ── Step 2: Intent Detection ──
  const { intent, confidence: intentConfidence } = detectIntent(message);

  // ── Step 3: Human Support Check (fast, before AI call) ──
  const humanSupportSignal = detectHumanSupportNeed(message);

  // ── Step 4: Build Secure Learning Context ──
  const learningContext = await buildStudentLearningContext(userId, { courseId, lessonId });

  // ── Step 5: Load Conversation History (trimmed context window) ──
  const conversationHistory = await buildContextWindowHistory(userId, conversationId);

  // ── Step 6: Build Intent-Aware System Prompt ──
  const systemInstruction = buildMentorSystemInstruction(learningContext, intent, conversationHistory);
  learningContext.systemInstruction = systemInstruction;

  // ── Step 7: Persist Student Message ──
  await addStudentMessage(conversationId, message.trim(), {
    courseId,
    lessonId,
    intentType: intent,
    inputType
  });

  // ── Step 8: Handle Learner Meta Intents Without AI (deterministic) ──
  if (isLearnerMetaIntent(intent) && intent === 'WHAT_SHOULD_I_DO_NEXT') {
    return _buildNextActionResponse(userId, conversationId, learningContext, intent, courseId, lessonId);
  }

  // ── Step 9: Call AI Provider ──
  const aiResult = await defaultAIProvider.chat(message.trim(), learningContext);

  // ── Step 10: Parse & Validate Response ──
  const validated = parseAndValidateMentorResponse(aiResult.rawText, learningContext);
  if (humanSupportSignal) {
    validated.needsHumanSupport = true;
    validated.suggestedNextActions.unshift('Connect with your course instructor or EDOT support');
  }

  // ── Step 11: Server-Side Action Resolution ──
  let resolvedActions;
  const rawActions = Array.isArray(validated.suggestedNextActions)
    ? validated.suggestedNextActions
    : [];
  try {
    resolvedActions = await resolveAndValidateActions(userId, rawActions, courseId);
  } catch {
    resolvedActions = normalizeAISuggestions(rawActions);
  }

  // ── Step 12: Persist Mentor Message ──
  await addMentorMessage(conversationId, validated.answer, {
    courseId,
    lessonId,
    intentType: intent,
    groundingStatus: validated.groundingStatus,
    suggestedActions: resolvedActions,
    sources: validated.sources
  });

  // ── Step 13: Update Conversation Summary ──
  if (validated.conversationSummary) {
    await updateConversationSummary(conversationId, validated.conversationSummary);
  }

  // ── Step 14: Persist Legacy MentorSession for analytics ──
  await _persistLegacySession(userId, courseId, lessonId, message, validated, aiResult);

  return {
    conversationId,
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

// ── Conversation Management ───────────────────────────────────────────────────

/**
 * Starts a new mentor conversation and returns the conversation record.
 */
export async function startConversation(userId, options = {}) {
  return createConversation(userId, options);
}

/**
 * Lists all mentor conversations for a student.
 */
export async function listConversations(userId, limit = 20) {
  return getConversations(userId, limit);
}

/**
 * Retrieves a conversation with its messages.
 */
export async function getConversation(userId, conversationId, messageLimit = 50) {
  return getConversationWithMessages(userId, conversationId, messageLimit);
}

// ── Session History (Legacy) ──────────────────────────────────────────────────

/**
 * Retrieves past mentor sessions for a learner.
 */
export async function getMentorSessions(userId, limit = 20) {
  return prisma.mentorSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 20, 50)
  });
}

/**
 * Retrieves a specific mentor session by ID.
 */
export async function getMentorSessionById(userId, sessionId) {
  const session = await prisma.mentorSession.findFirst({
    where: { sessionId, userId }
  });
  if (!session) {
    throw new NotFoundError(`Mentor session [${sessionId}] not found`);
  }
  return session;
}

/**
 * Submits student feedback score and comment for a mentor session.
 */
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

/**
 * Builds a deterministic, non-AI "next action" response from the Personal Learning Plan.
 * Used for WHAT_SHOULD_I_DO_NEXT intent to avoid unnecessary AI calls.
 */
async function _buildNextActionResponse(userId, conversationId, context, intent, courseId, lessonId) {
  const nextAction = context.recommendedNextAction || {
    actionType: 'CONTINUE_CURRENT_LESSON',
    explanation: `Continue working through ${context.currentLessonTitle || 'your current lesson'}.`
  };

  const masteryHighlights = (context.masteryStates || []).slice(0, 3).join('; ');
  const prerequisiteGaps = (context.prerequisiteGaps || []).slice(0, 2).map(g => g.nodeName || g);

  let answer = `Based on your current learning progress in **${context.currentCourseTitle || 'your course'}**, `;
  answer += `your recommended next step is: **${nextAction.actionType.replace(/_/g, ' ')}**.\n\n`;
  answer += nextAction.explanation || '';

  if (masteryHighlights) {
    answer += `\n\nYour current mastery: ${masteryHighlights}.`;
  }
  if (prerequisiteGaps.length > 0) {
    answer += `\n\nPrerequisite areas to reinforce: ${prerequisiteGaps.join(', ')}.`;
  }

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

/**
 * Persists a legacy MentorSession record for analytics dashboards.
 * Silently fails to never break the mentor chat pipeline.
 */
async function _persistLegacySession(userId, courseId, lessonId, message, validated, aiResult) {
  try {
    await prisma.mentorSession.create({
      data: {
        userId,
        courseId: courseId || null,
        lessonId: lessonId || null,
        promptSummary: message.trim().slice(0, 300),
        responseSummary: validated.answer.slice(0, 400),
        contextVersion: 'v3.0-phase11',
        sources: validated.sources,
        suggestedNextActions: validated.suggestedNextActions,
        confidenceScore: validated.confidence,
        needsHumanSupport: validated.needsHumanSupport,
        tokenCount: aiResult.tokenCount || 100
      }
    });
  } catch (err) {
    console.warn('[MentorService] Legacy session persist failed (non-critical):', err.message);
  }
}
