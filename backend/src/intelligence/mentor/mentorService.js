/**
 * EDOT Intelligence Domain - AI Mentor Service
 * Context-aware personalized AI tutoring, coaching, and automated practice generation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../../lib/prisma.js';
import { AIServiceUnavailableError } from '../shared/errors.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

function cleanJsonString(str) {
  let cleaned = (str || '').trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

async function executeGeminiPrompt(systemInstruction, promptText) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
    throw new AIServiceUnavailableError('Gemini API Key is not configured on the platform.');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction
    });
    const result = await model.generateContent(promptText);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('[AIMentorService Gemini Error]:', error.message);
    throw new AIServiceUnavailableError(`AI model call failed: ${error.message}`);
  }
}

/**
 * Compiles real-time student context for high-fidelity prompt generation.
 */
async function assembleStudentContext(userId) {
  const [profile, progressRecords, weaknesses, historyEvents] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { title: true, mainCategory: true } } },
      take: 6
    }),
    prisma.learnerWeakness.findMany({
      where: { profile: { userId } },
      orderBy: { impactScore: 'desc' },
      take: 5
    }),
    prisma.learningHistoryEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: 6
    })
  ]);

  return { profile, progressRecords, weaknesses, historyEvents };
}

/**
 * Context-aware chat coaching.
 */
export async function handleMentorChat(userId, { message, courseId, lessonId, conversationId }) {
  const context = await assembleStudentContext(userId);
  const profile = context.profile;
  const activeCourses = context.progressRecords.map(r => r.course?.title).filter(Boolean);
  const weakAreas = context.weaknesses.map(w => w.topic).join(', ');

  let conversation = conversationId
    ? await prisma.mentorConversation.findUnique({ where: { id: conversationId } })
    : null;

  if (!conversation) {
    conversation = await prisma.mentorConversation.create({
      data: {
        userId,
        contextCourseId: courseId || null,
        contextLessonId: lessonId || null,
        topic: courseId ? 'Course Learning Guidance' : 'Personal Growth Mentorship',
        title: 'Mentor Session'
      }
    });
  }

  const previousMessages = await prisma.mentorMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 8
  });

  const historyPrompt = previousMessages.length > 0
    ? previousMessages.map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`).join('\n')
    : 'New conversation session.';

  const systemInstruction = `You are EDOT AI Mentor, an adaptive and empowering tutor.
Student profile: Level=${profile?.academicLevel || 'Intermediate'}, Goals=${JSON.stringify(profile?.learningGoals || [])}, Strengths=${JSON.stringify(profile?.strengths || [])}, Weaknesses=${JSON.stringify(profile?.weaknesses || [])}.
Active courses: ${activeCourses.join(', ') || 'General learning'}.
Detected weakness topics: ${weakAreas || 'None flagged'}.

Respond encouragingly, clearly, and concisely. Break down complex steps simply, use bullet points where helpful, and suggest concrete next practice actions. Avoid generic filler.`;

  const prompt = `Conversation history:\n${historyPrompt}\n\nStudent asks: ${message}`;
  const aiResponse = await executeGeminiPrompt(systemInstruction, prompt);

  // Persist exchange in transaction
  await prisma.$transaction([
    prisma.mentorMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: message }
    }),
    prisma.mentorMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: aiResponse }
    }),
    prisma.mentorInteraction.create({
      data: {
        userId,
        interactionType: 'chat',
        topic: courseId ? 'course_coaching' : 'mentor_guidance',
        courseId: courseId || null,
        lessonId: lessonId || null,
        requestPreview: message.slice(0, 200),
        responsePreview: aiResponse.slice(0, 200),
        confidence: 0.95
      }
    }),
    prisma.mentorConversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: { increment: 2 },
        lastMessageAt: new Date(),
        summary: aiResponse.slice(0, 200)
      }
    })
  ]);

  return {
    conversationId: conversation.id,
    response: aiResponse
  };
}

/**
 * Generate targeted practice questions adapted to student's level and weak topics.
 */
export async function generateAdaptivePractice(userId, { topic, courseTitle }) {
  const context = await assembleStudentContext(userId);
  const level = context.profile?.academicLevel || 'Intermediate';

  const systemInstruction = `You are an adaptive practice generator for EDOT. Generate high-yield practice items designed to test understanding and bridge conceptual gaps.`;
  const prompt = `Create 4 practice questions for topic "${topic || 'Core concepts'}" within course "${courseTitle || 'General'}". Target level: ${level}.
Return JSON only: { "questions": [ { "question": string, "options": string[], "answer": string, "explanation": string } ] }`;

  const raw = await executeGeminiPrompt(systemInstruction, prompt);
  const cleaned = cleanJsonString(raw);
  return JSON.parse(cleaned);
}
