/**
 * EDOT Intelligence Domain - Course Intelligence Router
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { answerCourseQuestion, getCourseIntelligenceInsights } from './courseIntelligenceService.js';

const router = express.Router();

// POST /api/v2/intelligence/courses/:courseId/qa - Grounded RAG question answering
router.post('/:courseId/qa', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const answer = await answerCourseQuestion(courseId, req.body);
    res.json({
      success: true,
      data: { answer }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/courses/:courseId/insights - Course analytics & drop-off signals
router.get('/:courseId/insights', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const insights = await getCourseIntelligenceInsights(courseId);
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    next(error);
  }
});

export default router;
