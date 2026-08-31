import express from 'express';
import { protect, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolvePersonalIntelligenceContext } from '../src/intelligence/context/personalIntelligenceContextService.js';
import { updateDurableLearnerMemory, recordConversationFeedback } from '../src/intelligence/context/contextMemoryService.js';
import {
  sanitizeAndValidateUserInput,
  constructSecurePromptPayload,
  validateAndSanitizeAiOutput,
  AiUsageQuotaMonitor
} from '../src/intelligence/security/aiSecurityGuard.js';

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
    model: 'gemini-1.5-flash',
    systemInstruction
  });

  const result = await model.generateContent(promptText);
  const response = await result.response;
  return response.text().trim();
}

/**
 * POST /api/mentor/chat
 * Main AI Mentor chat endpoint powered by Personal Intelligence Context Layer.
 */
router.post('/chat', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { message, courseId, lessonId, conversationId } = req.body;

    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    // 1. AI Security: Input Sanitization & Prompt Injection Protection
    const sanitizedMessage = sanitizeAndValidateUserInput(message);

    // 2. AI Security: Token Quota Check
    AiUsageQuotaMonitor.checkAndRecordTokenUsage(req.user.id, 400);

    // 3. Resolve Role-Authorized, Intent-Routed Personal Intelligence Context
    const personalContext = await resolvePersonalIntelligenceContext({
      authUser: req.user,
      targetUserId: req.user.id,
      message: sanitizedMessage,
      courseId,
      lessonId
    });

    // 4. Update Durable Memory asynchronously (extract goals/style preferences)
    updateDurableLearnerMemory(req.user.id, sanitizedMessage).catch(() => {});

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
      take: 10
    });

    const conversationPrompt = previousMessages.length > 0
      ? previousMessages.map((item) => `${item.role === 'user' ? 'Student' : 'Mentor'}: ${item.content}`).join('\n')
      : 'No previous messages.';

    // 5. System Policy: Human-Centered Tutor (Zero Internal Technical Jargon Leakage)
    const systemInstruction = `You are EDOT Mentor AI, an empathetic expert teacher and capability coach. 
Understand the student's EDOT journey as a whole person. 
Provide thorough, human-like answers with step-by-step clarity.
NEVER reveal database IDs, vector IDs, KnowledgeNode IDs, LearnerConceptMastery scores, confidence metrics, or internal system terminology. Translate all signals into supportive, natural, human language.`;

    const promptPayload = constructSecurePromptPayload({
      systemPolicy: systemInstruction,
      courseContext: { courseId, title: personalContext.humanContext.currentLearningState },
      learnerContext: personalContext.humanContext,
      userInput: `${conversationPrompt}\n\nStudent message: ${sanitizedMessage}`
    });

    const rawReply = await callGemini(systemInstruction, promptPayload);

    // 6. AI Security: Output Validation & Redaction
    const reply = validateAndSanitizeAiOutput(rawReply);

    await prisma.$transaction([
      prisma.mentorMessage.create({
        data: { conversationId: conversation.id, role: 'user', content: sanitizedMessage }
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
          confidence: 0.95
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

    return res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        reply,
        intents: personalContext.meta.detectedIntents
      }
    });
  } catch (error) {
    console.error('Mentor chat error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to generate mentor response' });
  }
});

/**
 * POST /api/mentor/feedback
 * Express explicit feedback ("TOO_DIFFICULT", "ALREADY_KNOW_THIS", "NEED_PRACTICE", "NOT_USEFUL")
 */
router.post('/feedback', protect, checkNotBlocked, async (req, res) => {
  try {
    const { feedbackType, details } = req.body;
    if (!feedbackType) return res.status(400).json({ success: false, message: 'feedbackType is required' });

    await recordConversationFeedback(req.user.id, feedbackType, details);
    return res.json({ success: true, message: 'Feedback recorded successfully. Personalization preferences updated.' });
  } catch (error) {
    console.error('Mentor feedback error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record feedback' });
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
    const personalContext = await resolvePersonalIntelligenceContext({ authUser: req.user, message: topic || '' });

    const systemInstruction = 'You are an adaptive learning coach. Create concise practice questions that help a learner improve understanding and confidence.';
    const prompt = `Create 5 practice questions for topic: ${topic || 'current lesson'}. Context: ${personalContext.humanContext.identitySummary || 'General learning'}. Level: ${level || 'Intermediate'}. Include short explanation for each. Return JSON with field "questions" array of objects with fields question, answer, explanation.`;

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
        confidence: 0.9
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
    const personalContext = await resolvePersonalIntelligenceContext({ authUser: req.user, message: topic || '' });

    const systemInstruction = 'You are a learning strategist. Recommend a next-best learning step for the user based on their current progress and weak areas.';
    const prompt = `Recommend 4 practical next steps. Topic: ${topic || 'current learning'}. Context: ${personalContext.humanContext.conceptMasterySummary || 'Learning progress'}. Return JSON with field "steps" as array of strings.`;

    const raw = await callGemini(systemInstruction, prompt);
    const cleaned = cleanJsonString(raw);
    const parsed = JSON.parse(cleaned);

    return res.json({ success: true, data: parsed });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate next steps' });
  }
});

export default router;
