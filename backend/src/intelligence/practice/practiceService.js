/**
 * EDOT Intelligence Domain - Practice Service
 * Manages session persistence, adaptive evaluation, and instructor review capability.
 */

import { prisma } from '../../../lib/prisma.js';
import { generatePracticeQuestions, evaluateAnswersAndAdapt } from './practiceGenerator.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Creates a new AI-generated practice session.
 */
export async function createPracticeSession(userId, {
  courseId = null,
  lessonId = null,
  skillName = 'Web Development',
  practiceType = 'APPLICATION',
  difficulty = 'INTERMEDIATE'
}) {
  const questions = generatePracticeQuestions({ skillName, practiceType, difficulty });

  const session = await prisma.aIPracticeSession.create({
    data: {
      userId,
      courseId,
      lessonId,
      skillName,
      practiceType,
      difficulty,
      isAiGenerated: true,
      instructorApproved: false,
      status: 'ACTIVE',
      questions
    }
  });

  return {
    sessionId: session.id,
    skillName: session.skillName,
    practiceType: session.practiceType,
    difficulty: session.difficulty,
    isAiGenerated: session.isAiGenerated,
    status: session.status,
    questions: questions.map(q => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      difficulty: q.difficulty,
      isAiGenerated: q.isAiGenerated
    })),
    createdAt: session.createdAt
  };
}

/**
 * Evaluates student answers for a practice session and updates adaptive state.
 */
export async function evaluatePracticeSession(sessionId, answers = []) {
  const session = await prisma.aIPracticeSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Practice session not found');
  }

  const evaluation = evaluateAnswersAndAdapt(session.questions, answers);

  const updated = await prisma.aIPracticeSession.update({
    where: { id: sessionId },
    data: {
      score: evaluation.scorePercent,
      feedback: evaluation.adaptiveFeedback,
      adaptiveAdjustment: evaluation.adaptiveAdjustment,
      status: 'COMPLETED'
    }
  });

  return {
    sessionId: updated.id,
    scorePercent: evaluation.scorePercent,
    adaptiveAdjustment: evaluation.adaptiveAdjustment,
    adaptiveFeedback: evaluation.adaptiveFeedback,
    itemResults: evaluation.itemResults,
    isOfficialAssessment: false,
    label: 'AI-Generated Practice Evaluation',
    completedAt: updated.updatedAt
  };
}

/**
 * Retrieves a practice session by ID.
 */
export async function getPracticeSession(sessionId) {
  const session = await prisma.aIPracticeSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Practice session not found');
  }
  return session;
}

/**
 * Instructor review capability to approve/reject generated practice items.
 */
export async function reviewPracticeSessionByInstructor(sessionId, instructorId, approved = true, notes = '') {
  const session = await prisma.aIPracticeSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Practice session not found');
  }

  const updated = await prisma.aIPracticeSession.update({
    where: { id: sessionId },
    data: {
      instructorApproved: approved,
      status: approved ? 'REVIEWED' : 'PENDING_REVIEW',
      feedback: notes ? `Instructor Notes: ${notes}` : session.feedback
    }
  });

  return {
    sessionId: updated.id,
    instructorApproved: updated.instructorApproved,
    status: updated.status,
    reviewedBy: instructorId,
    updatedAt: updated.updatedAt
  };
}
