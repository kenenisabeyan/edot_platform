/**
 * EDOT Intelligence Domain - Course Intelligence Service
 * Course content chunking, automated asset extraction, RAG Q&A, and drop-off analytics.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../../lib/prisma.js';
import { AIServiceUnavailableError, NotFoundError } from '../shared/errors.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

function chunkContent(text, maxChunkSize = 1200) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks = [];
  for (let index = 0; index < normalized.length; index += maxChunkSize) {
    chunks.push(normalized.slice(index, index + maxChunkSize));
  }
  return chunks;
}

function rankRelevantChunks(question, chunks) {
  const normalizedQuestion = (question || '').toLowerCase();
  return [...chunks].sort((left, right) => {
    const leftScore = (left.toLowerCase().includes(normalizedQuestion) ? 3 : 0) +
      (left.toLowerCase().split(/\s+/).filter(w => normalizedQuestion.includes(w)).length * 2);
    const rightScore = (right.toLowerCase().includes(normalizedQuestion) ? 3 : 0) +
      (right.toLowerCase().split(/\s+/).filter(w => normalizedQuestion.includes(w)).length * 2);
    return rightScore - leftScore;
  });
}

/**
 * Answer a student question grounded strictly in course materials (RAG).
 */
export async function answerCourseQuestion(courseId, { question, lessonId }) {
  const document = await prisma.courseIntelligenceDocument.findFirst({
    where: { courseId, ...(lessonId ? { lessonId } : {}) },
    orderBy: { createdAt: 'desc' }
  });

  if (!document) {
    throw new NotFoundError('No course intelligence document indexed for this course yet.');
  }

  const chunks = await prisma.courseIntelligenceChunk.findMany({
    where: { documentId: document.id },
    orderBy: { chunkIndex: 'asc' }
  });

  const ranked = rankRelevantChunks(question, chunks.map(c => c.content));
  const contextText = ranked.slice(0, 4).join('\n\n');

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
    throw new AIServiceUnavailableError('Gemini API key is not configured.');
  }

  const systemInstruction = 'You are EDOT Course Assistant. Answer the question using ONLY the provided course material accurately and concisely.';
  const prompt = `Course Material:\n${contextText}\n\nStudent Question: ${question}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

/**
 * Derives course intelligence insights (drop-off rates, engagement distribution).
 */
export async function getCourseIntelligenceInsights(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, duration: true } }
    }
  });

  if (!course) {
    throw new NotFoundError(`Course ${courseId} not found`);
  }

  const [totalEnrollments, progressLogs, quizAttempts] = await Promise.all([
    prisma.enrollment.count({ where: { courseId, status: 'active' } }),
    prisma.progressLog.findMany({ where: { courseId } }),
    prisma.quizAttempt.findMany({ where: { courseId } })
  ]);

  // Calculate completion per lesson
  const lessonStats = (course.lessons || []).map((lesson) => {
    const completedCount = progressLogs.filter(
      p => p.lessonId === lesson.id && p.isVideoComplete
    ).length;

    const completionRate = totalEnrollments > 0
      ? Math.round((completedCount / totalEnrollments) * 100)
      : 0;

    return {
      lessonId: lesson.id,
      title: lesson.title,
      order: lesson.order,
      completionRate,
      completedCount
    };
  });

  return {
    courseId,
    title: course.title,
    totalEnrollments,
    lessonStats,
    averageQuizAccuracy: quizAttempts.length > 0
      ? Math.round((quizAttempts.filter(q => q.isCorrect).length / quizAttempts.length) * 100)
      : 0
  };
}
