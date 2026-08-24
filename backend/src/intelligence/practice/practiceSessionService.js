/**
 * EDOT Intelligence Domain - Practice Session Service (Phase 10)
 * 
 * Manages practice session state lifecycle, answer evaluation, real-time concept mastery updates,
 * and Learning Pulse telemetry integration.
 */

import { prisma } from '../../../lib/prisma.js';
import { generateConceptPracticeSession } from './practiceGeneratorEngine.js';
import { evaluateStudentConceptMastery } from '../mastery/masteryEvaluationEngine.js';
import { recordLearningEvent } from '../events/learningEventService.js';

/**
 * Starts a new concept-grounded practice session for a student.
 * 
 * @param {string} studentId 
 * @param {string} courseId 
 * @param {string} nodeId 
 */
export async function startPracticeSession(studentId, courseId, nodeId) {
  const practiceData = await generateConceptPracticeSession(studentId, courseId, nodeId, 3);

  const session = await prisma.practiceSession.create({
    data: {
      userId: studentId,
      courseId,
      nodeId,
      status: 'IN_PROGRESS',
      score: 0.0,
      questionsCount: practiceData.questionsCount,
      correctCount: 0,
      questionsData: practiceData.questionsData
    },
    include: { node: { select: { id: true, name: true, type: true } } }
  });

  return session;
}

/**
 * Submits an answer for a practice session question, evaluates performance, and updates mastery.
 * 
 * @param {string} sessionId 
 * @param {number} questionIndex 
 * @param {number} selectedOptionIndex 
 */
export async function submitPracticeAnswer(sessionId, questionIndex, selectedOptionIndex) {
  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { node: true }
  });

  if (!session) {
    throw new Error(`PracticeSession ${sessionId} not found.`);
  }

  const questions = session.questionsData || [];
  const targetQuestion = questions[questionIndex];

  if (!targetQuestion) {
    throw new Error(`Question index ${questionIndex} not found in session.`);
  }

  const isCorrect = selectedOptionIndex === targetQuestion.correctOptionIndex;
  const newCorrectCount = isCorrect ? session.correctCount + 1 : session.correctCount;
  const isLastQuestion = questionIndex >= session.questionsCount - 1;

  const newStatus = isLastQuestion ? 'COMPLETED' : 'IN_PROGRESS';
  const newScore = Math.round((newCorrectCount / session.questionsCount) * 100) / 100;

  const updatedSession = await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      correctCount: newCorrectCount,
      score: newScore,
      status: newStatus,
      completedAt: isLastQuestion ? new Date() : null
    }
  });

  // If completed or correct, record learning event & trigger real-time concept mastery update
  if (isCorrect) {
    await recordLearningEvent({
      studentId: session.userId,
      eventType: 'QUIZ_PASSED',
      courseId: session.courseId
    }).catch(() => {});
  }

  if (isLastQuestion) {
    await evaluateStudentConceptMastery(session.userId, session.courseId).catch(() => {});
  }

  return {
    sessionId: session.id,
    questionIndex,
    isCorrect,
    correctOptionIndex: targetQuestion.correctOptionIndex,
    explanation: targetQuestion.explanation,
    sessionStatus: updatedSession.status,
    currentScore: updatedSession.score
  };
}
