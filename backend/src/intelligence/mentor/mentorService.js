/**
 * EDOT Intelligence Domain - AI Mentor Service
 * Manages context-aware AI tutor conversations, session auditing, and learner feedback.
 */

import { prisma } from '../../../lib/prisma.js';
import { buildStudentLearningContext } from './contextBuilder.js';
import { detectHumanSupportNeed, buildMentorSystemInstruction, parseAndValidateMentorResponse } from './promptOrchestrator.js';
import { defaultAIProvider } from './providerAdapter.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

/**
 * Executes a context-aware AI Mentor chat query and records audit session in PostgreSQL.
 * 
 * @param {string} userId 
 * @param {string} message 
 * @param {object} [options] 
 * @returns {Promise<object>} Mentor response DTO
 */
export async function executeMentorChat(userId, message, options = {}) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ValidationError('message string is required for AI Mentor chat');
  }

  const { courseId, lessonId } = options;

  // 1. Build secure learning context
  const learningContext = await buildStudentLearningContext(userId, { courseId, lessonId });

  // 2. Check for human support requests
  const needsHumanSupport = detectHumanSupportNeed(message);

  // 3. Assemble prompt system instructions
  const systemInstruction = buildMentorSystemInstruction(learningContext);
  learningContext.systemInstruction = systemInstruction;

  // 4. Query AI Provider
  const aiResult = await defaultAIProvider.chat(message.trim(), learningContext);

  // 5. Parse & validate response
  const validatedResponse = parseAndValidateMentorResponse(aiResult.rawText, learningContext);
  if (needsHumanSupport) {
    validatedResponse.needsHumanSupport = true;
    validatedResponse.suggestedNextActions.unshift('Connect with Course Instructor / Support');
  }

  // 6. Create audit-safe prompt and response summaries (scrubbed)
  const promptSummary = message.trim().slice(0, 300);
  const responseSummary = validatedResponse.answer.slice(0, 400);

  // 7. Persist MentorSession record
  const session = await prisma.mentorSession.create({
    data: {
      userId,
      courseId: courseId || null,
      lessonId: lessonId || null,
      promptSummary,
      responseSummary,
      contextVersion: 'v2.1',
      sources: validatedResponse.sources,
      suggestedNextActions: validatedResponse.suggestedNextActions,
      confidenceScore: validatedResponse.confidence,
      needsHumanSupport: validatedResponse.needsHumanSupport,
      tokenCount: aiResult.tokenCount || 100
    }
  });

  return {
    sessionId: session.sessionId,
    answer: validatedResponse.answer,
    sources: validatedResponse.sources,
    suggestedNextActions: validatedResponse.suggestedNextActions,
    confidence: validatedResponse.confidence,
    needsHumanSupport: validatedResponse.needsHumanSupport,
    createdAt: session.createdAt
  };
}

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
