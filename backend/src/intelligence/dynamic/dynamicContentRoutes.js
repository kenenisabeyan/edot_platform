/**
 * EDOT Intelligence Domain - Dynamic Content Intelligence Router
 * Endpoints for universal lifecycle triggers, dynamic indexing, and context inspection.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  dynamicallyIndexAllExistingContent,
  onCategoryCreated,
  onCourseCreated,
  onSectionCreated,
  onLessonCreated,
  onQuizCreated,
  onAssignmentCreated,
  onContentUpdated,
  onContentDeleted,
  UniversalIntelligenceContext
} from './dynamicContentIntelligenceEngine.js';

const router = express.Router();

// POST /intelligence/dynamic/index-all
router.post('/index-all', protect, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const result = await dynamicallyIndexAllExistingContent();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/dynamic/lifecycle-event
router.post('/lifecycle-event', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { eventType, payload } = req.body;
    let result = null;

    switch (eventType) {
      case 'CATEGORY_CREATED':
        result = await onCategoryCreated(payload);
        break;
      case 'COURSE_CREATED':
        result = await onCourseCreated(payload);
        break;
      case 'SECTION_CREATED':
        result = await onSectionCreated(payload);
        break;
      case 'LESSON_CREATED':
        result = await onLessonCreated(payload);
        break;
      case 'QUIZ_CREATED':
        result = await onQuizCreated(payload);
        break;
      case 'ASSIGNMENT_CREATED':
        result = await onAssignmentCreated(payload);
        break;
      case 'CONTENT_UPDATED':
        result = await onContentUpdated(payload);
        break;
      case 'CONTENT_DELETED':
        result = await onContentDeleted(payload);
        break;
      default:
        return res.status(400).json({ success: false, message: `Unknown lifecycle event: ${eventType}` });
    }

    res.json({
      success: true,
      eventType,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/dynamic/context-template
router.get('/context-template', (req, res) => {
  const sample = new UniversalIntelligenceContext({
    userId: 'user-uuid',
    categoryId: 'category-uuid',
    courseId: 'course-uuid',
    sectionId: 'section-uuid',
    lessonId: 'lesson-uuid',
    resourceType: 'VIDEO',
    resourceId: 'resource-uuid',
    metadata: { difficulty: 'intermediate' }
  });

  res.json({
    success: true,
    data: sample
  });
});

export default router;
