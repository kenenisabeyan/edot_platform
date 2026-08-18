/**
 * EDOT Intelligence Domain - Course Intelligence Engine Router
 * Serves empirical course metrics, drop-off analysis, difficulty scores, and drill-down verification data.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import { getCourseIntelligenceSnapshot } from './courseIntelligenceService.js';
import { ForbiddenError } from '../shared/errors.js';
import { prisma } from '../../../lib/prisma.js';

const router = express.Router();

// GET /instructor/courses/:courseId/intelligence or /api/v2/intelligence/instructor/courses/:courseId/intelligence
router.get('/instructor/courses/:courseId/intelligence', protect, checkNotBlocked, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Authorization check: instructor must own the course unless admin
    if (req.user.role !== 'admin') {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { instructorId: true }
      });
      if (course && course.instructorId !== req.user.id) {
        throw new ForbiddenError('You are not authorized to view intelligence reports for this course');
      }
    }

    const snapshot = await getCourseIntelligenceSnapshot(courseId);
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/courses/:courseId/intelligence or /api/v2/intelligence/admin/courses/:courseId/intelligence
router.get('/admin/courses/:courseId/intelligence', protect, checkNotBlocked, authorize('admin'), async (req, res, next) => {
  try {
    const snapshot = await getCourseIntelligenceSnapshot(req.params.courseId);
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    next(error);
  }
});

export default router;
