/**
 * intelligenceRoutes.js
 *
 * EDOT Intelligence Core API — additive endpoint layer.
 * All routes are new; no existing routes are modified or removed.
 *
 * Wave 1:  (no new endpoints — handled via recommendationRoutes + profileSyncService)
 * Wave 2:  POST /api/intelligence/quiz-attempts   — per-question quiz attempt logging
 * Wave 3:  POST /api/intelligence/sessions/start  — start a learning session
 *          POST /api/intelligence/sessions/end    — end a learning session
 * Wave 4:  GET  /api/intelligence/analytics/me   — student analytics report
 *          GET  /api/admin/intelligence/at-risk   — (in adminRoutes, not here)
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { publishLearningEvent } from '../src/intelligence/events/learningEventService.js';
import {
  getStudentLearningSummary,
  getCourseLearningSummary,
  calculateRecentActivity
} from '../src/intelligence/analytics/learningAnalyticsService.js';
import { resolveActiveLearningContext } from '../src/intelligence/context/courseContextResolver.js';
import { resolveNextBestAction } from '../src/intelligence/recommendations/nextBestActionResolver.js';
import { detectAndRegisterMisconceptions } from '../src/intelligence/understanding/misconceptionEngine.js';
import { generateAdaptiveSequence } from '../src/intelligence/adaptive/adaptiveSequencer.js';
import { syncLearnerProfile } from '../src/intelligence/profile/profileService.js';

const router = express.Router();

// ─── WAVE 2: Per-question quiz attempt tracking ───────────────────────────────

/**
 * POST /api/intelligence/quiz-attempts
 *
 * Record a single question attempt. Called from the frontend QuizViewer
 * on each answer submission. Auto-updates LearnerWeakness if the topic
 * has ≥3 incorrect answers.
 *
 * Body:
 *   courseId, lessonId?, quizId?, questionIndex, question,
 *   selectedAnswer, correctAnswer, isCorrect, topic?, timeSpentSeconds?
 */
router.post('/quiz-attempts', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      courseId,
      lessonId,
      quizId,
      questionIndex,
      question,
      selectedAnswer,
      correctAnswer,
      isCorrect,
      topic,
      timeSpentSeconds
    } = req.body;

    if (!courseId || question === undefined || selectedAnswer === undefined || correctAnswer === undefined || isCorrect === undefined) {
      return res.status(400).json({
        success: false,
        message: 'courseId, question, selectedAnswer, correctAnswer, and isCorrect are required'
      });
    }

    // Count previous attempts for this exact question in this course
    const previousAttempts = await prisma.quizAttempt.count({
      where: { userId, courseId, question }
    });

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        courseId,
        lessonId: lessonId || null,
        quizId: quizId || null,
        questionIndex: Number(questionIndex) || 0,
        question,
        selectedAnswer,
        correctAnswer,
        isCorrect: Boolean(isCorrect),
        topic: topic || null,
        timeSpentSeconds: Number(timeSpentSeconds) || 0,
        attemptNumber: previousAttempts + 1
      }
    });

    // Auto-detect weakness: if topic is given and this question was wrong,
    // check if ≥3 wrong answers exist for this topic → upsert LearnerWeakness
    if (topic && !isCorrect) {
      const wrongCount = await prisma.quizAttempt.count({
        where: { userId, courseId, topic, isCorrect: false }
      });

      if (wrongCount >= 3) {
        const profile = await prisma.learnerProfile.findUnique({ where: { userId } });
        if (profile) {
          await prisma.learnerWeakness.upsert({
            where: { profileId_topic: { profileId: profile.id, topic } },
            update: {
              impactScore: Math.min(100, wrongCount * 5),
              lastObservedAt: new Date(),
              severity: wrongCount >= 6 ? 'high' : 'medium'
            },
            create: {
              profileId: profile.id,
              topic,
              category: 'Quiz Performance',
              severity: wrongCount >= 6 ? 'high' : 'medium',
              impactScore: Math.min(100, wrongCount * 5),
              lastObservedAt: new Date()
            }
          });
        }
      }
    }

    // Fire-and-forget: publish learning event to dynamic learner intelligence
    publishLearningEvent({
      userId,
      courseId,
      lessonId: lessonId || null,
      quizId: quizId || null,
      eventType: isCorrect ? 'QUIZ_PASSED' : 'QUIZ_FAILED',
      score: isCorrect ? 100 : 0,
      metadata: {
        topic: topic || question,
        question,
        questionIndex,
        selectedAnswer,
        correctAnswer,
        timeSpentSeconds,
        isCorrect: Boolean(isCorrect)
      }
    }).catch(() => {});

    return res.json({ success: true, data: attempt });
  } catch (error) {
    console.error('Quiz attempt error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record quiz attempt' });
  }
});

/**
 * GET /api/intelligence/quiz-attempts/:courseId
 *
 * Return quiz attempt history for the current user in a specific course.
 * Useful for the frontend to show per-topic accuracy breakdown.
 */
router.get('/quiz-attempts/:courseId', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, courseId },
      orderBy: { createdAt: 'asc' }
    });

    // Aggregate by topic
    const topicStats = attempts.reduce((acc, a) => {
      const key = a.topic || 'general';
      if (!acc[key]) acc[key] = { topic: key, total: 0, correct: 0 };
      acc[key].total += 1;
      if (a.isCorrect) acc[key].correct += 1;
      return acc;
    }, {});

    const topicBreakdown = Object.values(topicStats).map((t) => ({
      ...t,
      accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
    }));

    return res.json({
      success: true,
      data: {
        attempts,
        topicBreakdown,
        totalAttempts: attempts.length,
        overallAccuracy: attempts.length > 0
          ? Math.round((attempts.filter((a) => a.isCorrect).length / attempts.length) * 100)
          : 0
      }
    });
  } catch (error) {
    console.error('Quiz attempts fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch quiz attempts' });
  }
});

// ─── WAVE 3: Learning session tracking ───────────────────────────────────────

/**
 * POST /api/intelligence/sessions/start
 *
 * Start a learning session. Returns sessionId to be stored by the client
 * and passed to /sessions/end on unmount.
 *
 * Body: { courseId?, lessonId?, pageContext?, deviceType? }
 */
router.post('/sessions/start', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, lessonId, pageContext, deviceType } = req.body;

    const session = await prisma.learningSession.create({
      data: {
        userId,
        courseId: courseId || null,
        lessonId: lessonId || null,
        pageContext: pageContext || 'lesson',
        deviceType: deviceType || null,
        startedAt: new Date()
      }
    });

    return res.json({ success: true, data: { sessionId: session.id } });
  } catch (error) {
    console.error('Session start error:', error);
    return res.status(500).json({ success: false, message: 'Failed to start learning session' });
  }
});

/**
 * POST /api/intelligence/sessions/end
 *
 * Mark a session as ended and record duration.
 *
 * Body: { sessionId, durationSeconds }
 */
router.post('/sessions/end', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, durationSeconds } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    // Only allow the owning user to end their session
    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const endedAt = new Date();
    const computedDuration = session.startedAt
      ? Math.round((endedAt - new Date(session.startedAt)) / 1000)
      : Number(durationSeconds) || 0;

    const updated = await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        durationSeconds: Number(durationSeconds) || computedDuration
      }
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Session end error:', error);
    return res.status(500).json({ success: false, message: 'Failed to end learning session' });
  }
});

// ─── WAVE 4: Student analytics report ────────────────────────────────────────

/**
 * GET /api/intelligence/analytics/me
 *
 * Return the learner's analytics report including risk level,
 * engagement score, consistency score, and momentum.
 * Falls back to derived values if no stored report exists yet.
 */
router.get('/analytics/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const userId = req.user.id;

    const [storedReport, profile, progressLogs, sessions] = await Promise.all([
      prisma.learnerAnalyticsReport.findUnique({ where: { userId } }),
      prisma.learnerProfile.findUnique({ where: { userId } }),
      prisma.progressLog.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 30
      }),
      prisma.learningSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 14 // last 2 weeks of sessions
      })
    ]);

    if (storedReport) {
      return res.json({ success: true, data: storedReport });
    }

    // Derive on-the-fly if no stored report
    const totalSessions = sessions.length;
    const recentSessions = sessions.filter((s) => {
      const dayAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(s.startedAt) > dayAgo;
    });

    const consistencyScore = Math.min(100, Math.round(progressLogs.length * 4));
    const engagementScore = Math.min(
      100,
      Math.round(
        (recentSessions.length / Math.max(totalSessions, 1)) * 100 * 0.5 +
        (profile?.studyConsistencyScore || 0) * 0.5
      )
    );
    const quizAvg = profile?.quizAverage || 0;
    const momentumScore = Math.min(
      100,
      Math.round(consistencyScore * 0.4 + engagementScore * 0.3 + quizAvg * 0.3)
    );

    // Risk classification
    let riskLevel = 'low';
    const riskFactors = [];
    if (progressLogs.length === 0) { riskLevel = 'high'; riskFactors.push('No progress logged'); }
    else if (consistencyScore < 25) { riskLevel = 'medium'; riskFactors.push('Low study consistency'); }
    if (quizAvg < 40 && quizAvg > 0) { riskLevel = riskLevel === 'low' ? 'medium' : riskLevel; riskFactors.push('Quiz average below 40%'); }
    if (recentSessions.length === 0 && totalSessions > 0) {
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      riskFactors.push('No activity in past 7 days');
    }

    const derivedReport = {
      userId,
      riskLevel,
      riskFactors,
      engagementScore,
      consistencyScore,
      momentumScore,
      predictedCompletion: null,
      generatedAt: new Date()
    };

    return res.json({ success: true, data: derivedReport });
  } catch (error) {
    console.error('Analytics report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load analytics report' });
  }
});

/**
 * GET /api/intelligence/analytics/admin/at-risk
 *
 * Admin-only: List students whose derived risk level is medium or higher.
 */
router.get('/analytics/admin/at-risk', protect, authorize('admin'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    // Get stored at-risk reports
    const storedReports = await prisma.learnerAnalyticsReport.findMany({
      where: { riskLevel: { in: ['medium', 'high', 'critical'] } },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, createdAt: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });

    if (storedReports.length > 0) {
      return res.json({ success: true, data: storedReports });
    }

    // Fall back: derive from learner profiles with low scores
    const profiles = await prisma.learnerProfile.findMany({
      where: {
        OR: [
          { studyConsistencyScore: { lt: 25 } },
          { quizAverage: { lt: 40, gt: 0 } }
        ]
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, createdAt: true } }
      },
      take: limit
    });

    const derivedRisk = profiles.map((p) => ({
      userId: p.userId,
      user: p.user,
      riskLevel: p.studyConsistencyScore < 15 || p.quizAverage < 30 ? 'high' : 'medium',
      riskFactors: [
        ...(p.studyConsistencyScore < 25 ? ['Low consistency score'] : []),
        ...(p.quizAverage < 40 && p.quizAverage > 0 ? ['Low quiz average'] : [])
      ],
      engagementScore: Math.round(p.studyConsistencyScore),
      consistencyScore: Math.round(p.studyConsistencyScore),
      momentumScore: Math.round((p.studyConsistencyScore + p.quizAverage) / 2),
      generatedAt: p.lastUpdatedAt
    }));

    return res.json({ success: true, data: derivedRisk });
  } catch (error) {
    console.error('At-risk report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load at-risk report' });
  }
});

// ─── PHASE 1: Learning Data Foundation APIs ─────────────────────────────────

/**
 * GET /api/intelligence/learning-context/me
 * Resolves current active learning context.
 */
router.get('/learning-context/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const context = await resolveActiveLearningContext(req.user.id);
    return res.json({ success: true, data: context });
  } catch (error) {
    console.error('Learning context error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/learning-summary/me
 * Computes empirical overall student learning summary.
 */
router.get('/learning-summary/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const summary = await getStudentLearningSummary(req.user.id);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Learning summary error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/learning-summary/me/courses/:courseId
 * Computes course-level empirical learning summary.
 */
router.get('/learning-summary/me/courses/:courseId', protect, checkNotBlocked, async (req, res) => {
  try {
    const summary = await getCourseLearningSummary(req.user.id, req.params.courseId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Course learning summary error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/learning-activity/me
 * Retrieves recent telemetry events.
 */
router.get('/learning-activity/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const activities = await calculateRecentActivity(req.user.id, limit);
    return res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Learning activity error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PHASE 2: Learner Intelligence APIs ──────────────────────────────────────

/**
 * GET /api/intelligence/learner-profile/me
 * Computes 18-dimension Learner Digital Twin.
 */
router.get('/learner-profile/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const profile = await syncLearnerProfile(req.user.id);
    const recentEvents = await calculateRecentActivity(req.user.id, 1);
    const dataStatus = recentEvents.length > 0 ? 'SUFFICIENT' : 'INSUFFICIENT';

    return res.json({
      success: true,
      data: {
        sourceType: 'LEARNER_DIGITAL_TWIN',
        studentId: req.user.id,
        generatedAt: new Date(),
        confidence: dataStatus === 'SUFFICIENT' ? 0.95 : 0.2,
        dataStatus,
        profile
      }
    });
  } catch (error) {
    console.error('Learner profile error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/next-action/me
 * Resolves single, explainable Next Best Action.
 */
router.get('/next-action/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const nextAction = await resolveNextBestAction(req.user.id);
    return res.json({ success: true, data: nextAction });
  } catch (error) {
    console.error('Next Best Action error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/misconceptions/me
 * Detects conceptual misconceptions from quiz attempts.
 */
router.get('/misconceptions/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const misconceptions = await detectAndRegisterMisconceptions(req.user.id);
    return res.json({ success: true, data: misconceptions });
  } catch (error) {
    console.error('Misconceptions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/adaptive-path/me
 * Generates non-destructive adaptive learning sequence recommendations.
 */
router.get('/adaptive-path/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const courseId = req.query.courseId || null;
    const adaptivePath = await generateAdaptiveSequence(req.user.id, courseId);
    return res.json({ success: true, data: adaptivePath });
  } catch (error) {
    console.error('Adaptive path error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
