import { prisma } from '../lib/prisma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const leftScore = (left.toLowerCase().includes(normalizedQuestion) ? 3 : 0) + (left.toLowerCase().split(/\s+/).filter((word) => normalizedQuestion.includes(word)).length * 2);
    const rightScore = (right.toLowerCase().includes(normalizedQuestion) ? 3 : 0) + (right.toLowerCase().split(/\s+/).filter((word) => normalizedQuestion.includes(word)).length * 2);
    return rightScore - leftScore;
  });
}

async function callGemini(systemInstruction, promptText) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
    throw new Error('Gemini API key is not configured.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', systemInstruction });
  const result = await model.generateContent(promptText);
  const response = await result.response;
  return response.text().trim();
}

function cleanJsonString(str) {
  let cleaned = (str || '').trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

async function processCourseContent({ courseId, lessonId, content, title, type = 'lesson' }) {
  if (!content || !content.trim()) throw new Error('Content is required');

  const chunks = chunkContent(content, 1400);

  const systemInstruction = 'You are EDOT Course Intelligence. Extract educational structure from uploaded content and return concise, structured JSON.';
  const prompt = `Create learning assets from the following educational content.\nTitle: ${title || 'Untitled'}\nType: ${type}\nContent:\n${content}\n\nReturn JSON with fields: summary, keyConcepts, flashcards, quizQuestions, learningPath.`;

  const raw = await callGemini(systemInstruction, prompt);
  const cleaned = cleanJsonString(raw);
  let parsed = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    parsed = {
      summary: raw,
      keyConcepts: [],
      flashcards: [],
      quizQuestions: [],
      learningPath: []
    };
  }

  const document = await prisma.courseIntelligenceDocument.create({
    data: {
      courseId,
      lessonId,
      title: title || 'Untitled intelligence asset',
      contentType: type,
      contentText: content,
      summary: parsed.summary || '',
      keyConcepts: parsed.keyConcepts || [],
      flashcards: parsed.flashcards || [],
      quizQuestions: parsed.quizQuestions || [],
      learningPath: parsed.learningPath || [],
      chunkCount: chunks.length,
      status: 'processed'
    }
  });

  await prisma.courseIntelligenceChunk.createMany({
    data: chunks.map((chunk, index) => ({
      documentId: document.id,
      chunkIndex: index,
      content: chunk,
      metadata: { sourceType: type, title }
    }))
  });

  return document;
}

async function answerCourseQuestion({ courseId, question, lessonId }) {
  const document = await prisma.courseIntelligenceDocument.findFirst({
    where: { courseId, ...(lessonId ? { lessonId } : {}) },
    orderBy: { createdAt: 'desc' }
  });

  if (!document) {
    throw new Error('No course intelligence content is available for this course.');
  }

  const chunks = await prisma.courseIntelligenceChunk.findMany({
    where: { documentId: document.id },
    orderBy: { chunkIndex: 'asc' }
  });

  const rankedChunks = rankRelevantChunks(question, chunks.map((chunk) => chunk.content));
  const relevantContext = rankedChunks.slice(0, 4).join('\n\n');

  const systemInstruction = 'You are EDOT Course Intelligence. Answer using only the provided educational material and be explicit when the answer is not in the source.';
  const prompt = `Question: ${question}\n\nCourse material:\n${relevantContext}`;

  return callGemini(systemInstruction, prompt);
}

export { chunkContent, rankRelevantChunks, processCourseContent, answerCourseQuestion };
