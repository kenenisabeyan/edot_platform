/**
 * EDOT Intelligence Domain - AI Mentor Router
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { validateMentorChatPayload } from '../shared/validation.js';
import { handleMentorChat, generateAdaptivePractice } from './mentorService.js';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// POST /api/v2/intelligence/mentor/chat - Send message to AI Mentor
router.post('/chat', protect, checkNotBlocked, async (req, res, next) => {
  try {
    validateMentorChatPayload(req.body);
    const result = await handleMentorChat(req.user.id, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/mentor/practice - Request adaptive practice set
router.post('/practice', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const questions = await generateAdaptivePractice(req.user.id, req.body);
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/mentor/conversations - List user's mentor chat sessions
router.get('/conversations', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const conversations = await prisma.mentorConversation.findMany({
      where: { userId: req.user.id },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10
        }
      }
    });

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
});

export default router;
