/**
 * EDOT Intelligence Domain - Course Onboarding & Intelligence Management Router
 * Exposes Admin & Instructor APIs for course intelligence status, backfills,
 * skill approvals, and on-demand reprocessing.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import { prisma } from '../../../lib/prisma.js';
import {
  onboardSingleCourse,
  backfillAllExistingCourses,
  getAuthorizedCourseKnowledgeContext
} from './courseOnboardingPipeline.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN INTELLIGENCE MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /intelligence/onboarding/admin/overview
router.get('/admin/overview', protect, authorize('admin'), async (req, res, next) => {
  try {
    const [totalCourses, statuses] = await Promise.all([
      prisma.course.count(),
      prisma.courseIntelligenceStatus.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 50
      })
    ]);

    const readyCount = statuses.filter(s => s.status === 'READY').length;
    const processingCount = statuses.filter(s => s.status === 'PROCESSING').length;
    const failedCount = statuses.filter(s => s.status === 'FAILED').length;
    const needsRefreshCount = statuses.filter(s => s.status === 'NEEDS_REFRESH').length;

    res.json({
      success: true,
      data: {
        totalCourses,
        intelligenceReadyCourses: readyCount,
        processingCourses: processingCount,
        failedCourses: failedCount,
        needsRefreshCourses: needsRefreshCount,
        recentStatuses: statuses
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/onboarding/admin/backfill
router.post('/admin/backfill', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { batchSize = 25, offset = 0 } = req.body;
    const result = await backfillAllExistingCourses({ batchSize, offset });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/onboarding/courses/:courseId/reprocess
router.post('/courses/:courseId/reprocess', protect, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // If instructor, verify ownership
    if (req.user.role === 'instructor') {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { instructorId: true } });
      if (!course || course.instructorId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized to reprocess another instructor\'s course' });
      }
    }

    const result = await onboardSingleCourse(courseId, { forceRefresh: true });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// PUT /intelligence/onboarding/courses/:courseId/toggle-ai
router.put('/courses/:courseId/toggle-ai', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { aiEnabled } = req.body;

    const updated = await prisma.courseIntelligenceStatus.update({
      where: { courseId },
      data: { aiEnabled: Boolean(aiEnabled) }
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR INTELLIGENCE CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

// GET /instructor/intelligence/courses
router.get('/instructor/courses', protect, authorize('instructor'), async (req, res, next) => {
  try {
    const instructorCourses = await prisma.course.findMany({
      where: { instructorId: req.user.id },
      select: {
        id: true,
        title: true,
        mainCategory: true,
        level: true,
        totalStudents: true,
        createdAt: true
      }
    });

    const courseIds = instructorCourses.map(c => c.id);
    const statuses = await prisma.courseIntelligenceStatus.findMany({
      where: { courseId: { in: courseIds } }
    });

    const statusMap = {};
    statuses.forEach(s => { statusMap[s.courseId] = s; });

    const enriched = instructorCourses.map(c => ({
      ...c,
      intelligenceStatus: statusMap[c.id] || { status: 'PENDING', aiEnabled: true, knowledgeChunkCount: 0 }
    }));

    res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/intelligence/courses/:courseId/context (Knowledge Inspection)
router.get('/courses/:courseId/context', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { lessonId } = req.query;

    const context = await getAuthorizedCourseKnowledgeContext(req.user.id, courseId, lessonId);
    res.json({
      success: true,
      data: context
    });
  } catch (error) {
    next(error);
  }
});

export default router;
