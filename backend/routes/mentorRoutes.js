import express from 'express';
import { protect, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

function cleanJsonString(str) {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  return cleaned.trim();
}

async function callGemini(systemInstruction, promptText) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
    throw new Error('Gemini API key is not configured.');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction
  });

  const result = await model.generateContent(promptText);
  const response = await result.response;
  return response.text().trim();
}

async function getLearnerContext(userId) {
  const [profile, enrollments, historyEvents, weaknessEntries] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.userCourseProgress.findMany({ where: { userId }, include: { course: true } }),
    prisma.learningHistoryEvent.findMany({ where: { userId }, orderBy: { occurredAt: 'desc' }, take: 8 }),
    prisma.learnerWeakness.findMany({ where: { profile: { userId } }, orderBy: { impactScore: 'desc' }, take: 5 })
  ]);

  return { profile, enrollments, historyEvents, weaknessEntries };
}

router.post('/chat', protect, checkNotBlocked, async (req, res) => {
  try {
    const { message, courseId, lessonId, conversationId } = req.body;

    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const learnerContext = await getLearnerContext(req.user.id);
    const profile = learnerContext.profile;
    const activeCourses = learnerContext.enrollments.map((entry) => entry.course?.title).filter(Boolean);
    const recentHistory = learnerContext.historyEvents.map((entry) => `${entry.eventType}: ${entry.title}`).join(' | ');
    const weakAreas = learnerContext.weaknessEntries.map((entry) => entry.topic).join(', ');

    let conversation = null;
    if (conversationId) {
      conversation = await prisma.mentorConversation.findUnique({ where: { id: conversationId } });
    }

    if (!conversation) {
      conversation = await prisma.mentorConversation.create({
        data: {
          userId: req.user.id,
          contextCourseId: courseId || null,
          contextLessonId: lessonId || null,
          topic: courseId ? 'Course Support' : 'Learning Guidance',
          title: 'Mentor Session'
        }
      });
    }

    const previousMessages = await prisma.mentorMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 12
    });

    const conversationPrompt = previousMessages.length > 0
      ? previousMessages.map((item) => `${item.role === 'user' ? 'Student' : 'Mentor'}: ${item.content}`).join('\n')
      : 'No previous messages.';

    const systemInstruction = `You are EDOT Mentor AI, a personal teacher for this learner. You should act like an encouraging, insightful tutor.
    Learner profile: academicLevel=${profile?.academicLevel || 'Intermediate'}, goals=${JSON.stringify(profile?.learningGoals || [])}, strengths=${JSON.stringify(profile?.strengths || [])}, weaknesses=${JSON.stringify(profile?.weaknesses || [])}, studyHabits=${JSON.stringify(profile?.studyHabits || {})}.
    Current courses: ${activeCourses.join(', ') || 'No active course data'}.
    Recent learning history: ${recentHistory || 'No recent learning history'}.
    Weak areas: ${weakAreas || 'No major weak areas detected'}.

    Respond in a warm, structured, and educational way. Use short paragraphs, bullet points when helpful, and examples. Focus on explaining concepts clearly, simplifying difficulty, and recommending next steps. Do not use horizontal lines.`;

    const prompt = `Conversation history:\n${conversationPrompt}\n\nStudent message: ${message}`;
    const reply = await callGemini(systemInstruction, prompt);

    await prisma.$transaction([
      prisma.mentorMessage.create({
        data: { conversationId: conversation.id, role: 'user', content: message }
      }),
      prisma.mentorMessage.create({
        data: { conversationId: conversation.id, role: 'assistant', content: reply }
      }),
      prisma.mentorInteraction.create({
        data: {
          userId: req.user.id,
          interactionType: 'chat',
          topic: courseId ? 'course_support' : 'general_support',
          courseId: courseId || null,
          lessonId: lessonId || null,
          requestPreview: message,
          responsePreview: reply,
          confidence: 0.9
        }
      })
    ]);

    await prisma.mentorConversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: (conversation.messageCount || 0) + 2,
        lastMessageAt: new Date(),
        summary: reply.slice(0, 240)
      }
    });

    return res.json({ success: true, data: { conversationId: conversation.id, reply } });
  } catch (error) {
    console.error('Mentor chat error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate mentor response' });
  }
});

router.get('/conversations', protect, checkNotBlocked, async (req, res) => {
  try {
    const conversations = await prisma.mentorConversation.findMany({
      where: { userId: req.user.id },
      orderBy: { lastMessageAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 8 } }
    });

    return res.json({ success: true, data: conversations });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load mentor history' });
  }
});

router.post('/practice-questions', protect, checkNotBlocked, async (req, res) => {
  try {
    const { topic, level, courseTitle } = req.body;
    const learnerContext = await getLearnerContext(req.user.id);

    const systemInstruction = 'You are an adaptive learning coach. Create concise practice questions that help a learner improve understanding and confidence.';
    const prompt = `Create 5 practice questions for the topic: ${topic || 'the current lesson'}. Course context: ${courseTitle || 'General learning'}. Learner level: ${level || learnerContext.profile?.academicLevel || 'Intermediate'}. Include a short explanation for each. Return JSON with a field "questions" containing an array of objects with fields question, answer, explanation.`;

    const raw = await callGemini(systemInstruction, prompt);
    const cleaned = cleanJsonString(raw);
    const parsed = JSON.parse(cleaned);

    await prisma.mentorInteraction.create({
      data: {
        userId: req.user.id,
        interactionType: 'practice_questions',
        topic: topic || 'general',
        requestPreview: prompt,
        responsePreview: JSON.stringify(parsed),
        confidence: 0.88
      }
    });

    return res.json({ success: true, data: parsed });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate practice questions' });
  }
});

router.post('/next-steps', protect, checkNotBlocked, async (req, res) => {
  try {
    const { topic } = req.body;
    const learnerContext = await getLearnerContext(req.user.id);

    const systemInstruction = 'You are a learning strategist. Recommend a next-best learning step for the user based on their current progress and weak areas.';
    const prompt = `Recommend 4 practical next steps for the learner. Topic: ${topic || 'current learning'}.
    Learner level: ${learnerContext.profile?.academicLevel || 'Intermediate'}.
    Weak areas: ${learnerContext.weaknessEntries.map((entry) => entry.topic).join(', ') || 'No weak areas detected'}.
    Return JSON with a field "steps" as an array of strings.`;

    const raw = await callGemini(systemInstruction, prompt);
    const cleaned = cleanJsonString(raw);
    const parsed = JSON.parse(cleaned);

    return res.json({ success: true, data: parsed });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate next steps' });
  }
});

export default router;
