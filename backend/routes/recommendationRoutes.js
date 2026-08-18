import express from 'express';
import { protect, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { buildRecommendationBundle } from '../services/recommendationEngineService.js';

const router = express.Router();

router.get('/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const [profile, progressRecords, historyEvents] = await Promise.all([
      prisma.learnerProfile.findUnique({ where: { userId: req.user.id } }),
      prisma.userCourseProgress.findMany({
        where: { userId: req.user.id },
        include: { course: true },
        take: 8,
        orderBy: { enrolledAt: 'desc' }
      }),
      prisma.learningHistoryEvent.findMany({ where: { userId: req.user.id }, orderBy: { occurredAt: 'desc' }, take: 8 })
    ]);

    const goals = Array.isArray(profile?.learningGoals) ? profile.learningGoals : [];
    const interests = Array.isArray(profile?.interests) ? profile.interests : [];
    const strengths = Array.isArray(profile?.strengths) ? profile.strengths : [];
    const weaknesses = Array.isArray(profile?.weaknesses) ? profile.weaknesses : [];

    const progressSignals = progressRecords.map((entry) => ({
      title: entry.course?.title || 'Course progress',
      category: entry.course?.mainCategory || 'Learning'
    }));

    const bundle = buildRecommendationBundle({
      goals,
      interests,
      strengths,
      weaknesses,
      quizAverage: profile?.quizAverage || 0,
      completedCourses: profile?.completedCourses || 0,
      progressSignals,
      feedback: historyEvents.map((event) => event.title)
    });

    return res.json({ success: true, data: bundle });
  } catch (error) {
    console.error('Recommendation engine error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load recommendations' });
  }
});

export default router;
