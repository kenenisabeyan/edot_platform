/**
 * EDOT Intelligence Domain - Question Intelligence Service (Phase 9)
 * 
 * Analyzes question performance dynamically, computes difficulty signals, and flags
 * quality issues without modifying questions.
 */

import { prisma } from '../../../lib/prisma.js';

export const DIFFICULTY_SIGNALS = [
  'VERY_EASY',
  'EASY',
  'MODERATE',
  'DIFFICULT',
  'VERY_DIFFICULT',
  'UNKNOWN'
];

export const QUALITY_SIGNALS = [
  'REVIEW_RECOMMENDED',
  'NO_CONCERN',
  'INSUFFICIENT_DATA'
];

/**
 * Analyzes question attempt statistics for a specific question in a quiz.
 * 
 * @param {string} courseId 
 * @param {string} quizId 
 * @param {number} questionIndex 
 */
export async function analyzeQuestionPerformance(courseId, quizId, questionIndex) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { courseId, quizId, questionIndex }
  });

  const attemptCount = attempts.length;

  if (attemptCount < 5) {
    return prisma.questionIntelligence.upsert({
      where: { courseId_quizId_questionIndex: { courseId, quizId, questionIndex } },
      create: {
        courseId,
        quizId,
        questionIndex,
        attemptCount,
        correctCount: attempts.filter(a => a.isCorrect).length,
        incorrectCount: attempts.filter(a => !a.isCorrect).length,
        difficultySignal: 'UNKNOWN',
        qualitySignal: 'INSUFFICIENT_DATA',
        lastAnalyzedAt: new Date()
      },
      update: {
        attemptCount,
        correctCount: attempts.filter(a => a.isCorrect).length,
        incorrectCount: attempts.filter(a => !a.isCorrect).length,
        difficultySignal: 'UNKNOWN',
        qualitySignal: 'INSUFFICIENT_DATA',
        lastAnalyzedAt: new Date()
      }
    });
  }

  const correctCount = attempts.filter(a => a.isCorrect).length;
  const incorrectCount = attemptCount - correctCount;
  const correctRatio = correctCount / attemptCount;

  // Compute Difficulty Signal
  let difficultySignal = 'MODERATE';
  if (correctRatio >= 0.90) difficultySignal = 'VERY_EASY';
  else if (correctRatio >= 0.75) difficultySignal = 'EASY';
  else if (correctRatio >= 0.40) difficultySignal = 'MODERATE';
  else if (correctRatio >= 0.20) difficultySignal = 'DIFFICULT';
  else difficultySignal = 'VERY_DIFFICULT';

  // Compute Quality Signal
  let qualitySignal = 'NO_CONCERN';
  if (correctRatio < 0.15 || correctRatio > 0.98) {
    qualitySignal = 'REVIEW_RECOMMENDED';
  }

  return prisma.questionIntelligence.upsert({
    where: { courseId_quizId_questionIndex: { courseId, quizId, questionIndex } },
    create: {
      courseId,
      quizId,
      questionIndex,
      attemptCount,
      correctCount,
      incorrectCount,
      difficultySignal,
      qualitySignal,
      lastAnalyzedAt: new Date()
    },
    update: {
      attemptCount,
      correctCount,
      incorrectCount,
      difficultySignal,
      qualitySignal,
      lastAnalyzedAt: new Date()
    }
  });
}
