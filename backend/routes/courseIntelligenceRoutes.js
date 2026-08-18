import express from 'express';
import { protect, authorize, checkNotBlocked } from '../middleware/auth.js';
import { processCourseContent, answerCourseQuestion } from '../services/courseIntelligenceService.js';

const router = express.Router();

router.post('/process', protect, authorize('admin', 'teacher', 'instructor'), checkNotBlocked, async (req, res) => {
  try {
    const { courseId, lessonId, content, title, type } = req.body;
    if (!courseId || !content) {
      return res.status(400).json({ success: false, message: 'courseId and content are required' });
    }

    const document = await processCourseContent({ courseId, lessonId, content, title, type });
    return res.json({ success: true, data: document });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to process course content' });
  }
});

router.post('/ask', protect, checkNotBlocked, async (req, res) => {
  try {
    const { courseId, lessonId, question } = req.body;
    if (!courseId || !question) {
      return res.status(400).json({ success: false, message: 'courseId and question are required' });
    }

    const answer = await answerCourseQuestion({ courseId, lessonId, question });
    return res.json({ success: true, data: { answer } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to answer question' });
  }
});

export default router;
