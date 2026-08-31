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
import { getLivePulseFeed, evaluateLearnerFatigue } from '../src/intelligence/monitoring/learningPulseEngine.js';
import { triggerIntelligentNudges, dismissNudge } from '../src/intelligence/nudges/intelligentNudgeEngine.js';
import {
  getTeachingOverview,
  getCourseHealthSummary,
  getStudentsNeedingSupport,
  getDifficultConcepts,
  getEngagementPerformanceTrends,
  getLearningPulseDistribution
} from '../src/intelligence/instructor/instructorIntelligenceService.js';
import { resolveInstructorContext } from '../src/intelligence/context/instructorContextResolver.js';
import {
  getRecommendedInstructorActions,
  createIntervention,
  updateInterventionStatus,
  getInterventionHistory
} from '../src/intelligence/interventions/interventionService.js';
import {
  getPlatformOverview,
  getCategoryGrowthAnalytics,
  getCourseEngagementCompletionMatrix,
  getStudentGroupsNeedingSupport,
  getCrossCourseLearningProblems,
  getInstructorsNeedingSupport,
  getInstitutionalRecommendations
} from '../src/intelligence/admin/adminIntelligenceService.js';
import {
  getGuardianLinkedStudents,
  getGuardianStudentOverview,
  getGuardianCourseProgress,
  getGuardianImportantChanges,
  getGuardianRecommendations,
  getGuardianNotifications,
  sendEncouragement,
  requestSupport
} from '../src/intelligence/guardian/guardianIntelligenceService.js';
import {
  evaluateClosedLoopEcosystem,
  adaptCurriculumSequencing,
  getEcosystemSummary
} from '../src/intelligence/adaptive/closedLoopAdaptationEngine.js';
import {
  resolveUserRelationships,
  verifyCommunicationPermission,
  verifyIntelligencePermission
} from '../src/intelligence/relationship/relationshipIntelligenceResolver.js';
import { createVoiceCommunicationSession } from '../src/intelligence/communication/voiceCommunicationProvider.js';
import { createVideoSupportSession } from '../src/intelligence/communication/videoCommunicationProvider.js';
import { logAuditEvent } from '../src/intelligence/audit/auditLogService.js';
import {
  processIntelligenceEvent,
  getInstructorTeachingPriorities
} from '../src/intelligence/orchestration/edotIntelligenceOrchestrator.js';
import {
  recordConversationTurn,
  getUnifiedConversationContext
} from '../src/intelligence/memory/conversationIntelligenceMemoryService.js';
import { getRoleIntelligenceOverview } from '../src/intelligence/role/roleIntelligenceExperienceService.js';
import { getStudentIntelligenceStatus } from '../src/intelligence/status/studentStatusIntelligenceService.js';
import { executeRoleAwareAiChat } from '../src/intelligence/ai/roleAssistantService.js';
import { executeClosedLoopAction } from '../src/intelligence/action/closedLoopActionEngine.js';
import { resolveIntelligenceVisibility, assertPrivateAIChatAccess } from '../src/intelligence/privacy/intelligenceVisibilityResolver.js';
import {
  getKnowledgeNodeById,
  getKnowledgeNodes
} from '../src/intelligence/knowledge/knowledgeGraphService.js';
import {
  createKnowledgeRelationship,
  getNodePrerequisites,
  deleteKnowledgeRelationship
} from '../src/intelligence/knowledge/prerequisiteService.js';
import {
  approveContentMapping,
  rejectContentMapping,
  getCourseKnowledgeMap
} from '../src/intelligence/knowledge/contentIntelligenceService.js';
import { processCourseContent } from '../src/intelligence/knowledge/contentProcessingPipeline.js';
import { retrieveAuthorizedKnowledge } from '../src/intelligence/knowledge/knowledgeRetrievalService.js';
import {
  evaluateStudentConceptMastery,
  getStudentConceptMastery
} from '../src/intelligence/mastery/masteryEvaluationEngine.js';
import { identifyConceptGaps } from '../src/intelligence/mastery/masteryGapResolver.js';
import { recordConceptEvidence, getConceptEvidenceSummary } from '../src/intelligence/mastery/conceptEvidenceService.js';
import { resolveMasteryState } from '../src/intelligence/mastery/masteryStateResolver.js';
import { identifyPrerequisiteGaps } from '../src/intelligence/mastery/prerequisiteGapService.js';
import { generateMasteryRecommendations } from '../src/intelligence/mastery/masteryRecommendationService.js';
import { evaluateAssessmentConceptCoverage } from '../src/intelligence/mastery/assessmentIntelligenceService.js';
import { analyzeQuestionPerformance } from '../src/intelligence/mastery/questionIntelligenceService.js';
import { startPracticeSession, submitPracticeAnswer } from '../src/intelligence/practice/practiceSessionService.js';
import { getAuthorizedPracticeHint } from '../src/intelligence/practice/aiPracticeMentorService.js';
import { evaluateNextBestAction } from '../src/intelligence/learningEngine/personalLearningEngine.js';
import { updateStudentLearningPlan, getStudentLearningPlan, completeLearningAction } from '../src/intelligence/learningEngine/adaptiveLearningPlanService.js';
import { resolveLearnerContext } from '../src/intelligence/personalLearning/learnerContextResolver.js';
import { resolveCandidateActions } from '../src/intelligence/personalLearning/nextActionResolver.js';
import { rankRecommendations } from '../src/intelligence/personalLearning/recommendationRanker.js';
import { getOrUpdateLearningPlan } from '../src/intelligence/personalLearning/learningPlanService.js';
import { updateActionLifecycle } from '../src/intelligence/personalLearning/recommendationOutcomeService.js';

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

// ─── PHASE 3: EDOT Learning Pulse APIs ───────────────────────────────────────

/**
 * GET /api/intelligence/pulse/live-activity
 * Retrieves real-time anonymous telemetry stream across active learning sessions.
 */
router.get('/pulse/live-activity', protect, checkNotBlocked, async (req, res) => {
  try {
    const courseId = req.query.courseId || null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const feed = await getLivePulseFeed({ courseId, limit });
    return res.json({ success: true, data: feed });
  } catch (error) {
    console.error('Live pulse feed error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/pulse/fatigue-check/me
 * Evaluates learner study session duration and fatigue level.
 */
router.get('/pulse/fatigue-check/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const fatigue = await evaluateLearnerFatigue(req.user.id);
    return res.json({ success: true, data: fatigue });
  } catch (error) {
    console.error('Fatigue check error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/pulse/nudges/me
 * Retrieves personalized active nudges with anti-fatigue max 2/day enforcement.
 */
router.get('/pulse/nudges/me', protect, checkNotBlocked, async (req, res) => {
  try {
    const nudges = await triggerIntelligentNudges(req.user.id);
    return res.json({ success: true, data: nudges });
  } catch (error) {
    console.error('Intelligent nudges error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/pulse/nudges/:nudgeId/dismiss
 * Dismisses an active nudge and updates anti-fatigue tracking.
 */
router.post('/pulse/nudges/:nudgeId/dismiss', protect, checkNotBlocked, async (req, res) => {
  try {
    await dismissNudge(req.user.id, req.params.nudgeId);
    return res.json({ success: true, message: 'Nudge dismissed successfully' });
  } catch (error) {
    console.error('Dismiss nudge error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PHASE 4: Instructor Intelligence APIs ───────────────────────────────────

/**
 * GET /api/intelligence/instructor/overview
 * Computes high-level Teaching Overview statistics across assigned courses.
 */
router.get('/instructor/overview', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const overview = await getTeachingOverview(req.user.id);
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Teaching overview error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/courses
 * Retrieves authorized assigned courses with Class Learning Health statuses.
 */
router.get('/instructor/courses', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const context = await resolveInstructorContext(req.user.id);
    const coursesWithHealth = await Promise.all(
      context.courses.map(async (c) => {
        const health = await getCourseHealthSummary(req.user.id, c.id);
        return { ...c, health };
      })
    );
    return res.json({ success: true, data: { courses: coursesWithHealth, activeCoursesCount: context.activeCoursesCount } });
  } catch (error) {
    console.error('Instructor courses health error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/courses/:courseId/health
 * Evaluates Class Learning Health and signal breakdown for a specific course.
 */
router.get('/instructor/courses/:courseId/health', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const health = await getCourseHealthSummary(req.user.id, req.params.courseId);
    return res.json({ success: true, data: health });
  } catch (error) {
    console.error('Course health error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/students-needing-support
 * Retrieves prioritized authorized students needing support with explainable evidence.
 */
router.get('/instructor/students-needing-support', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const courseId = req.query.courseId || null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const students = await getStudentsNeedingSupport(req.user.id, { courseId, limit });
    return res.json({ success: true, data: students });
  } catch (error) {
    console.error('Students needing support error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/courses/:courseId/difficult-concepts
 * Detects difficult lessons or concepts using minimum evidence threshold (>=2 students).
 */
router.get('/instructor/courses/:courseId/difficult-concepts', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const concepts = await getDifficultConcepts(req.user.id, req.params.courseId);
    return res.json({ success: true, data: concepts });
  } catch (error) {
    console.error('Difficult concepts error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/courses/:courseId/trends
 * Analyzes engagement and performance trends over time for an assigned course.
 */
router.get('/instructor/courses/:courseId/trends', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const trends = await getEngagementPerformanceTrends(req.user.id, req.params.courseId);
    return res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Instructor trends error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/pulse-distribution
 * Consumes Phase 3 Learning Pulse strictly filtered to authorized students.
 */
router.get('/instructor/pulse-distribution', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const courseId = req.query.courseId || null;
    const distribution = await getLearningPulseDistribution(req.user.id, courseId);
    return res.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Pulse distribution error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/recommended-actions
 * Generates prioritized actionable teaching recommendations.
 */
router.get('/instructor/recommended-actions', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const actions = await getRecommendedInstructorActions(req.user.id);
    return res.json({ success: true, data: actions });
  } catch (error) {
    console.error('Recommended actions error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/instructor/interventions
 * Retrieves human instructor intervention history log.
 */
router.get('/instructor/interventions', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const courseId = req.query.courseId || null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const history = await getInterventionHistory(req.user.id, { courseId, limit });
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error('Intervention history error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/instructor/interventions
 * Creates a human instructor intervention record.
 */
router.post('/instructor/interventions', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const intervention = await createIntervention(req.user.id, req.body);
    return res.json({ success: true, data: intervention });
  } catch (error) {
    console.error('Create intervention error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/intelligence/instructor/interventions/:id
 * Updates status and records outcome of a human intervention.
 */
router.patch('/instructor/interventions/:id', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const updated = await updateInterventionStatus(req.user.id, req.params.id, req.body);
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update intervention error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 5: Admin Intelligence APIs ────────────────────────────────────────

/**
 * GET /api/intelligence/admin/overview
 * Computes macro-level platform intelligence overview metrics.
 */
router.get('/admin/overview', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const overview = await getPlatformOverview();
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Admin platform overview error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/admin/category-growth
 * Retrieves category growth, enrollment distribution, and momentum analytics.
 */
router.get('/admin/category-growth', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const growth = await getCategoryGrowthAnalytics();
    return res.json({ success: true, data: growth });
  } catch (error) {
    console.error('Admin category growth error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/admin/course-health-matrix
 * Maps all platform courses into 4 risk/performance quadrants.
 */
router.get('/admin/course-health-matrix', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const matrix = await getCourseEngagementCompletionMatrix();
    return res.json({ success: true, data: matrix });
  } catch (error) {
    console.error('Admin course health matrix error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/admin/student-groups-support
 * Aggregates student support needs grouped by category/department.
 */
router.get('/admin/student-groups-support', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const groups = await getStudentGroupsNeedingSupport();
    return res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Admin student groups support error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/admin/cross-course-problems
 * Detects learning misconceptions or problems that appear across 2+ distinct courses.
 */
router.get('/admin/cross-course-problems', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const problems = await getCrossCourseLearningProblems();
    return res.json({ success: true, data: problems });
  } catch (error) {
    console.error('Admin cross course problems error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/admin/instructors-needing-support
 * Identifies instructors whose assigned courses exhibit low retention or completion rates.
 */
router.get('/admin/instructors-needing-support', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const instructors = await getInstructorsNeedingSupport();
    return res.json({ success: true, data: instructors });
  } catch (error) {
    console.error('Admin instructors needing support error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/admin/institutional-recommendations
 * Generates macro-level institutional action recommendations for platform administrators.
 */
router.get('/admin/institutional-recommendations', protect, authorize('admin'), checkNotBlocked, async (req, res) => {
  try {
    const recommendations = await getInstitutionalRecommendations();
    return res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Admin institutional recommendations error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 6: Guardian / Parent Intelligence APIs ───────────────────────────────

/**
 * GET /api/intelligence/guardian/students
 * Retrieves authorized active linked students for a guardian.
 */
router.get('/guardian/students', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const students = await getGuardianLinkedStudents(req.user.id);
    return res.json({ success: true, data: students });
  } catch (error) {
    console.error('Guardian linked students error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/guardian/students/:studentId/overview
 * Computes supportive intelligence overview for a target linked student.
 */
router.get('/guardian/students/:studentId/overview', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const overview = await getGuardianStudentOverview(req.user.id, req.params.studentId);
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Guardian student overview error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/guardian/students/:studentId/courses
 * Retrieves per-course progress details for a target linked student.
 */
router.get('/guardian/students/:studentId/courses', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const progress = await getGuardianCourseProgress(req.user.id, req.params.studentId);
    return res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Guardian course progress error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/guardian/students/:studentId/changes
 * Surfaces key milestones or engagement shifts for a linked student.
 */
router.get('/guardian/students/:studentId/changes', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const changes = await getGuardianImportantChanges(req.user.id, req.params.studentId);
    return res.json({ success: true, data: changes });
  } catch (error) {
    console.error('Guardian important changes error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/guardian/students/:studentId/recommendations
 * Returns supportive, non-judgmental recommendations for guardians.
 */
router.get('/guardian/students/:studentId/recommendations', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const recommendations = await getGuardianRecommendations(req.user.id, req.params.studentId);
    return res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Guardian recommendations error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/guardian/notifications
 * Retrieves deduplicated notifications for a guardian.
 */
router.get('/guardian/notifications', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const notifications = await getGuardianNotifications(req.user.id, { studentId, limit });
    return res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Guardian notifications error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/guardian/students/:studentId/encourage
 * Sends a supportive encouragement message to a linked student.
 */
router.post('/guardian/students/:studentId/encourage', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const result = await sendEncouragement(req.user.id, req.params.studentId, req.body.message);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send encouragement error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/guardian/students/:studentId/request-support
 * Submits a learning support request from guardian to course faculty.
 */
router.post('/guardian/students/:studentId/request-support', protect, authorize('parent', 'guardian', 'admin', 'student'), checkNotBlocked, async (req, res) => {
  try {
    const result = await requestSupport(req.user.id, {
      studentId: req.params.studentId,
      courseId: req.body.courseId,
      reason: req.body.reason
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Request support error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 7: Closed-Loop Ecosystem APIs ───────────────────────────────────────

/**
 * GET /api/intelligence/ecosystem/summary
 * Computes platform-wide 4-stage closed-loop ecosystem metrics: DETECT -> SUPPORT -> MONITOR -> ADAPT.
 */
router.get('/ecosystem/summary', protect, checkNotBlocked, async (req, res) => {
  try {
    const summary = await getEcosystemSummary();
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Ecosystem summary error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/ecosystem/closed-loop-outcomes
 * Evaluates active role-based interventions and measures subsequent learning telemetry.
 */
router.get('/ecosystem/closed-loop-outcomes', protect, checkNotBlocked, async (req, res) => {
  try {
    const outcomes = await evaluateClosedLoopEcosystem();
    return res.json({ success: true, data: outcomes });
  } catch (error) {
    console.error('Closed-loop outcomes error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/ecosystem/trigger-adaptation
 * Triggers closed-loop outcome evaluation and adaptive curriculum sequencing.
 */
router.post('/ecosystem/trigger-adaptation', protect, checkNotBlocked, async (req, res) => {
  try {
    const outcomes = await evaluateClosedLoopEcosystem();
    let adaptedSequence = null;
    if (req.body.studentId && req.body.courseId) {
      adaptedSequence = await adaptCurriculumSequencing(req.body.studentId, req.body.courseId);
    }
    return res.json({ success: true, data: { outcomes, adaptedSequence } });
  } catch (error) {
    console.error('Trigger adaptation error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 8: Knowledge & Content Intelligence APIs ────────────────────────────

/**
 * GET /api/intelligence/knowledge/course/:courseId/map
 * Retrieves course knowledge coverage map and mapped KnowledgeNodes.
 */
router.get('/knowledge/course/:courseId/map', protect, checkNotBlocked, async (req, res) => {
  try {
    const mapData = await getCourseKnowledgeMap(req.params.courseId);
    return res.json({ success: true, data: mapData });
  } catch (error) {
    console.error('Course knowledge map error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/knowledge/node/:nodeId
 * Retrieves KnowledgeNode details with outgoing/incoming relationships and content mappings.
 */
router.get('/knowledge/node/:nodeId', protect, checkNotBlocked, async (req, res) => {
  try {
    const node = await getKnowledgeNodeById(req.params.nodeId);
    return res.json({ success: true, data: node });
  } catch (error) {
    console.error('Get knowledge node error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/knowledge/node/:nodeId/prerequisites
 * Retrieves direct prerequisites for a KnowledgeNode.
 */
router.get('/knowledge/node/:nodeId/prerequisites', protect, checkNotBlocked, async (req, res) => {
  try {
    const prereqs = await getNodePrerequisites(req.params.nodeId);
    return res.json({ success: true, data: prereqs });
  } catch (error) {
    console.error('Get node prerequisites error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/knowledge/retrieve
 * Shared authorized knowledge retrieval for AI systems (RAG/Mentor/Practice).
 */
router.get('/knowledge/retrieve', protect, checkNotBlocked, async (req, res) => {
  try {
    const { courseId, lessonId, query } = req.query;
    const result = await retrieveAuthorizedKnowledge({
      userId: req.user.id,
      courseId,
      lessonId,
      query
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Authorized knowledge retrieval error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/knowledge/process-course
 * Asynchronously queues course content processing and concept extraction.
 */
router.post('/knowledge/process-course', protect, checkNotBlocked, async (req, res) => {
  try {
    const result = await processCourseContent(req.body.courseId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Process course content error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/knowledge/mapping/:id/approve
 * Instructor approves a knowledge content mapping.
 */
router.post('/knowledge/mapping/:id/approve', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const result = await approveContentMapping(req.params.id, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Approve content mapping error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/knowledge/mapping/:id/reject
 * Instructor rejects a knowledge content mapping.
 */
router.post('/knowledge/mapping/:id/reject', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const result = await rejectContentMapping(req.params.id, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Reject content mapping error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/knowledge/prerequisite
 * Creates a validated knowledge relationship (with cycle & self-reference checks).
 */
router.post('/knowledge/prerequisite', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const result = await createKnowledgeRelationship({
      sourceNodeId: req.body.sourceNodeId,
      targetNodeId: req.body.targetNodeId,
      relationType: req.body.relationType || 'PREREQUISITE_OF',
      confidence: req.body.confidence || 1.0,
      source: req.body.source || 'INSTRUCTOR_DEFINED',
      reviewStatus: req.body.reviewStatus || 'APPROVED',
      evidenceSummary: req.body.evidenceSummary || null
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Create knowledge prerequisite error:', error);
    const status = error.statusCode || 400;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/intelligence/knowledge/prerequisite/:id
 * Deletes a knowledge relationship.
 */
router.delete('/knowledge/prerequisite/:id', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    await deleteKnowledgeRelationship(req.params.id);
    return res.json({ success: true, message: 'Relationship deleted successfully.' });
  } catch (error) {
    console.error('Delete knowledge prerequisite error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 9: Concept Mastery & Assessment Intelligence APIs ─────────────────

/**
 * GET /api/intelligence/mastery/student/:studentId
 * Retrieves student concept mastery records with authorization checks.
 */
router.get('/mastery/student/:studentId', protect, checkNotBlocked, async (req, res) => {
  try {
    const targetStudentId = req.params.studentId;

    // Authorization
    if (req.user.role === 'student' && req.user.id !== targetStudentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only access their own concept mastery.' });
    }
    if (req.user.role === 'guardian') {
      const link = await prisma.guardianStudent.findFirst({
        where: { guardianId: req.user.id, studentId: targetStudentId, status: 'APPROVED' }
      });
      if (!link) {
        return res.status(403).json({ success: false, message: 'Forbidden: Guardian is not authorized for this student.' });
      }
    }
    if (req.user.role === 'instructor' && req.query.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: req.query.courseId, instructorId: req.user.id }
      });
      if (!course) {
        return res.status(403).json({ success: false, message: 'Forbidden: Instructor does not own this course.' });
      }
    }

    const courseId = req.query.courseId || null;
    const masteries = await getStudentConceptMastery(targetStudentId, courseId);
    return res.json({ success: true, data: masteries });
  } catch (error) {
    console.error('Get student concept mastery error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/mastery/evidence
 * Retrieves concept evidence summary.
 */
router.get('/mastery/evidence', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const { nodeId } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only view their own evidence.' });
    }

    const summary = await getConceptEvidenceSummary(studentId, nodeId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Get concept evidence error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/mastery/prerequisite-gaps
 * Identifies prerequisite gaps using Phase 8 Knowledge Graph.
 */
router.get('/mastery/prerequisite-gaps', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const { nodeId } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const gaps = await identifyPrerequisiteGaps(studentId, nodeId);
    return res.json({ success: true, data: gaps });
  } catch (error) {
    console.error('Identify prerequisite gaps error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/mastery/recommendations
 * Generates mastery recommendations connecting to real EDOT content.
 */
router.get('/mastery/recommendations', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const courseId = req.query.courseId || null;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const recommendations = await generateMasteryRecommendations(studentId, courseId);
    return res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Generate mastery recommendations error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/mastery/assessment/:quizId/coverage
 * Evaluates concept coverage measured by an assessment.
 */
router.get('/mastery/assessment/:quizId/coverage', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const { courseId } = req.query;
    const { quizId } = req.params;

    if (req.user.role === 'instructor') {
      const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: req.user.id } });
      if (!course) return res.status(403).json({ success: false, message: 'Forbidden: Instructor does not own this course.' });
    }

    const coverage = await evaluateAssessmentConceptCoverage(courseId, quizId);
    return res.json({ success: true, data: coverage });
  } catch (error) {
    console.error('Assessment concept coverage error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/mastery/question/intelligence
 * Analyzes question performance and quality signals.
 */
router.get('/mastery/question/intelligence', protect, authorize('instructor', 'admin'), checkNotBlocked, async (req, res) => {
  try {
    const { courseId, quizId, questionIndex } = req.query;

    if (req.user.role === 'instructor') {
      const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: req.user.id } });
      if (!course) return res.status(403).json({ success: false, message: 'Forbidden: Instructor does not own this course.' });
    }

    const qIntel = await analyzeQuestionPerformance(courseId, quizId, parseInt(questionIndex, 10) || 0);
    return res.json({ success: true, data: qIntel });
  } catch (error) {
    console.error('Question intelligence error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 10: Practice & Adaptive Assessment Intelligence APIs ─────────────────

/**
 * POST /api/intelligence/practice/session/start
 * Starts a new concept-grounded practice session for a student.
 */
router.post('/practice/session/start', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.body.studentId || req.user.id;
    const { courseId, nodeId } = req.body;
    const session = await startPracticeSession(studentId, courseId, nodeId);
    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('Start practice session error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/practice/session/submit
 * Submits an answer for a practice question and evaluates performance.
 */
router.post('/practice/session/submit', protect, checkNotBlocked, async (req, res) => {
  try {
    const { sessionId, questionIndex, selectedOptionIndex } = req.body;
    const result = await submitPracticeAnswer(sessionId, questionIndex, selectedOptionIndex);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Submit practice answer error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PERSONAL LEARNING ENGINE & ADAPTIVE PLAN APIS ─────────────────────────────

/**
 * GET /api/intelligence/personal-learning-engine/next-action
 * Evaluates 10 intelligence inputs to resolve Next Best Learning Action.
 */
router.get('/personal-learning-engine/next-action', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const { courseId } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only access their own next action.' });
    }

    const nextAction = await evaluateNextBestAction(studentId, courseId);
    return res.json({ success: true, data: nextAction });
  } catch (error) {
    console.error('Evaluate next best action error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/personal-learning-engine/plan
 * Retrieves active personalized learning plan.
 */
router.get('/personal-learning-engine/plan', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const { courseId } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only access their own learning plan.' });
    }

    const plan = await getStudentLearningPlan(studentId, courseId);
    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get learning plan error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PHASE 10: PERSONAL LEARNING ENGINE APIS ─────────────────────────────

/**
 * GET /api/intelligence/personal-learning/overview
 * Unified overview of student learning context and active plan.
 */
router.get('/personal-learning/overview', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only access their own learning overview.' });
    }

    const context = await resolveLearnerContext(studentId, req.query.courseId);
    const planResult = await getOrUpdateLearningPlan(studentId, context.activeCourseId);

    return res.json({ success: true, data: { context, planResult } });
  } catch (error) {
    console.error('Personal learning overview error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/personal-learning/plan
 * Retrieves active personalized learning plan.
 */
router.get('/personal-learning/plan', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const { courseId } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only access their own learning plan.' });
    }

    const plan = await getOrUpdateLearningPlan(studentId, courseId);
    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get personal learning plan error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/personal-learning/recommendations
 * Retrieves ranked recommendations for active course.
 */
router.get('/personal-learning/recommendations', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user.id;
    const { courseId } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only access their own recommendations.' });
    }

    const context = await resolveLearnerContext(studentId, courseId);
    const actions = await resolveCandidateActions(context);
    const ranked = rankRecommendations(actions);

    return res.json({ success: true, data: ranked });
  } catch (error) {
    console.error('Get recommendations error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/personal-learning/recommendations/:id/start
 * Updates action lifecycle status to STARTED.
 */
router.post('/personal-learning/recommendations/:id/start', protect, checkNotBlocked, async (req, res) => {
  try {
    const actionId = req.params.id;
    const studentId = req.user.id;
    const result = await updateActionLifecycle(actionId, studentId, 'STARTED');
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Start recommendation error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/personal-learning/recommendations/:id/complete
 * Updates action lifecycle status to COMPLETED and triggers feedback loop.
 */
router.post('/personal-learning/recommendations/:id/complete', protect, checkNotBlocked, async (req, res) => {
  try {
    const actionId = req.params.id;
    const studentId = req.user.id;
    const result = await updateActionLifecycle(actionId, studentId, 'COMPLETED', req.body.outcome || null);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Complete recommendation error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/personal-learning/recommendations/:id/dismiss
 * Updates action lifecycle status to DISMISSED.
 */
router.post('/personal-learning/recommendations/:id/dismiss', protect, checkNotBlocked, async (req, res) => {
  try {
    const actionId = req.params.id;
    const studentId = req.user.id;
    const result = await updateActionLifecycle(actionId, studentId, 'DISMISSED');
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Dismiss recommendation error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/personal-learning/recalculate
 * Triggers async recommendation recalculation for a student.
 */
router.post('/personal-learning/recalculate', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.body.studentId || req.user.id;
    const { courseId } = req.body;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Students can only recalculate their own plan.' });
    }

/**
 * GET /api/intelligence/universal-role-hub
 * 
 * EDOT Universal Role Intelligence Ecosystem Endpoint.
 * Resolves role-specific, database-driven, privacy-protected intelligence answering:
 *   1. What is happening? (Clear Status)
 *   2. Why does it matter? (Understandable Explanation)
 *   3. What should I do next? (Recommended Action)
 * 
 * Supports role query parameter for Admin multi-role previews (?role=student|instructor|admin|parent|sponsor).
 */
router.get('/universal-role-hub', protect, checkNotBlocked, async (req, res) => {
  try {
    const requestedRole = req.query.role || null;
    const intelligence = await getUniversalRoleIntelligence(req.user, requestedRole);
    return res.json({ success: true, data: intelligence });
  } catch (error) {
    console.error('Universal Role Intelligence Endpoint Error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Failed to resolve Universal Role Intelligence' });
  }
});

/**
 * GET /api/intelligence/role-overview
 * Orchestrated central role intelligence overview (Part 1).
 */
router.get('/role-overview', protect, checkNotBlocked, async (req, res) => {
  try {
    const requestedRole = req.query.role || req.user.role;
    const overview = await getRoleIntelligenceOverview({ userId: req.user.id, role: requestedRole });
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Role Overview Endpoint Error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/student-status/:studentId
 * Universal student status resolver (Part 7).
 */
router.get('/student-status/:studentId', protect, checkNotBlocked, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const status = await getStudentIntelligenceStatus({
      studentId,
      viewerId: req.user.id,
      viewerRole: req.user.role
    });
    return res.json({ success: true, data: status });
  } catch (error) {
    console.error('Student Status Endpoint Error:', error);
    const status = error.statusCode || 500;
/**
 * POST /api/intelligence/role-ai/chat
 * Role-aware multimodal AI conversation engine endpoint.
 */
router.post('/role-ai/chat', protect, checkNotBlocked, async (req, res) => {
  try {
    const { message, modality, targetStudentId } = req.body;
    const response = await executeRoleAwareAiChat({
      userId: req.user.id,
      role: req.user.role,
      message,
      modality: modality || 'TEXT',
      targetStudentId
    });
    return res.json({ success: true, data: response });
  } catch (error) {
    console.error('Role AI Chat Endpoint Error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Failed to execute Role AI Chat' });
  }
});

/**
 * GET /api/intelligence/relationships
 * Resolves active Admin-managed relationships for current user.
 */
router.get('/relationships', protect, checkNotBlocked, async (req, res) => {
  try {
    const relationships = await resolveUserRelationships(req.user.id);
    return res.json({ success: true, data: relationships });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/communication/verify
 * Verifies communication permission between current user and target receiver.
 */
router.post('/communication/verify', protect, checkNotBlocked, async (req, res) => {
  try {
    const { receiverId, conversationType } = req.body;
    const verification = await verifyCommunicationPermission({
      senderId: req.user.id,
      receiverId,
      conversationType
    });
    return res.json({ success: true, data: verification });
  } catch (error) {
    const status = error.statusCode || 403;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/communication/voice/session
 * Creates an authorized real-time voice call session.
 */
router.post('/communication/voice/session', protect, checkNotBlocked, async (req, res) => {
  try {
    const { receiverId, callType } = req.body;
    const voiceSession = await createVoiceCommunicationSession({
      senderId: req.user.id,
      receiverId,
      callType
    });
    await logAuditEvent({ eventType: 'COMMUNICATION_STARTED', actorId: req.user.id, targetId: receiverId, resource: 'VOICE_SESSION' });
    return res.json({ success: true, data: voiceSession });
  } catch (error) {
    const status = error.statusCode || 403;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/orchestrate/event
 * Central real-time intelligence event trigger endpoint.
 */
router.post('/orchestrate/event', protect, checkNotBlocked, async (req, res) => {
  try {
    const { eventType, courseId, metadata } = req.body;
    const result = await processIntelligenceEvent({
      eventType,
      userId: req.user.id,
      courseId,
      metadata
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/orchestrate/instructor-priorities
 * Teaching priorities endpoint for instructors.
 */
router.get('/orchestrate/instructor-priorities', protect, checkNotBlocked, async (req, res) => {
  try {
    const priorities = await getInstructorTeachingPriorities(req.user.id);
    return res.json({ success: true, data: priorities });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/intelligence/memory/conversation/turn
 * Records a conversation turn across Text, Voice, or Video modalities.
 */
router.post('/memory/conversation/turn', protect, checkNotBlocked, async (req, res) => {
  try {
    const { conversationId, modality, topic, content } = req.body;
    const turn = await recordConversationTurn({
      userId: req.user.id,
      conversationId,
      modality,
      topic,
      content,
      senderRole: (req.user.role || 'STUDENT').toUpperCase()
    });
    return res.json({ success: true, data: turn });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intelligence/memory/conversation/:id
 * Retrieves unified multi-modality conversation memory context.
 */
router.get('/memory/conversation/:id', protect, checkNotBlocked, async (req, res) => {
  try {
    const { targetStudentId } = req.query;
    const context = await getUnifiedConversationContext({
      viewerId: req.user.id,
      viewerRole: req.user.role,
      studentId: targetStudentId || req.user.id,
      conversationId: req.params.id
    });
    return res.json({ success: true, data: context });
  } catch (error) {
    const status = error.statusCode || 403;
    return res.status(status).json({ success: false, message: error.message });
  }
});

export default router;
