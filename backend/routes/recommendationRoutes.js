/**
 * recommendationRoutes.js
 *
 * Wave 1 upgrade:
 *  - GET /api/recommendations/me   — now uses real Course DB lookup with live scoring
 *  - POST /api/recommendations/feedback — new: records whether a recommendation was acted on
 */

import express from 'express';
import { protect, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { buildLiveRecommendationBundle, buildRecommendationBundle } from '../services/recommendationEngineService.js';

const router = express.Router();

// ─── GET /api/recommendations/me ─────────────────────────────────────────────

router.get('/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;

    const [profile, progressRecords, historyEvents, enrollments, publishedCourses] = await Promise.all([
      prisma.learnerProfile.findUnique({ where: { userId } }),
      prisma.userCourseProgress.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true, mainCategory: true } } },
        take: 12,
        orderBy: { enrolledAt: 'desc' }
      }),
      prisma.learningHistoryEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        take: 8
      }),
      // IDs of courses the learner is already enrolled in
      prisma.enrollment.findMany({
        where: { studentId: userId },
        select: { courseId: true }
      }),
      // All published courses for live scoring
      prisma.course.findMany({
        where: { status: 'active', isPublished: true },
        select: {
          id: true,
          title: true,
          slug: true,
          mainCategory: true,
          subCategory: true,
          level: true,
          thumbnail: true,
          rating: true,
          totalStudents: true,
          tags: true,
          instructor: { select: { name: true } }
        },
        take: 100,
        orderBy: { totalStudents: 'desc' }
      })
    ]);

    const goals = Array.isArray(profile?.learningGoals) ? profile.learningGoals : [];
    const interests = Array.isArray(profile?.interests) ? profile.interests : [];
    const strengths = Array.isArray(profile?.strengths) ? profile.strengths : [];
    const weaknesses = Array.isArray(profile?.weaknesses) ? profile.weaknesses : [];
    const enrolledCourseIds = enrollments.map((e) => e.courseId);

    const progressSignals = progressRecords.map((e) => ({
      title: e.course?.title || 'Course progress',
      category: e.course?.mainCategory || 'Learning'
    }));

    const context = {
      goals,
      interests,
      strengths,
      weaknesses,
      quizAverage: profile?.quizAverage || 0,
      completedCourses: profile?.completedCourses || 0,
      progressSignals,
      feedback: historyEvents.map((e) => e.title)
    };

    // Use live scoring if we have published courses; fall back to legacy bundle
    const bundle = publishedCourses.length > 0
      ? buildLiveRecommendationBundle(context, publishedCourses, enrolledCourseIds)
      : buildRecommendationBundle(context);

    return res.json({ success: true, data: bundle });
  } catch (error) {
    console.error('Recommendation engine error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load recommendations' });
  }
});

// ─── POST /api/recommendations/feedback ──────────────────────────────────────

/**
 * Record that the learner acted on (or dismissed) a recommendation.
 * Body: { recommendationType, targetId, targetTitle, reason, score, actionType }
 * actionType: 'enrolled' | 'viewed' | 'dismissed'
 */
router.post('/feedback', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;
    const { recommendationType, targetId, targetTitle, reason, score, actionType } = req.body;

    if (!targetTitle || !actionType) {
      return res.status(400).json({ success: false, message: 'targetTitle and actionType are required' });
    }

    const result = await prisma.recommendationResult.create({
      data: {
        userId,
        recommendationType: recommendationType || 'course',
        targetId: targetId || null,
        targetTitle,
        reason: reason || '',
        score: Number(score) || 0,
        wasActedOn: actionType !== 'dismissed',
        actionType,
        actedAt: new Date()
      }
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Recommendation feedback error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record recommendation feedback' });
  }
});

export default router;
