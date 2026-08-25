/**
 * EDOT Intelligence — Phase 12
 * Career Intelligence REST API Routes
 *
 * All routes require authentication (protect middleware).
 * All authorization is enforced server-side.
 * URL parameters and body IDs are NEVER trusted without server-side validation.
 */

import express from 'express';
import { prisma } from '../../../lib/prisma.js';
import { protect, authorize } from '../../../middleware/auth.js';
import {
  assertStudentOwnsCareerData,
  assertInstructorCourseAccess,
  assertGuardianStudentLink,
  assertValidUUID,
  resolveCareerPath
} from './careerAuthorizationService.js';
import {
  getCareerPaths,
  createCareerPath,
  getStudentSkillProfile,
  getStudentSkillDetail,
  exploreCareerPaths,
  getCareerIntelligence,
  addCareerInterest,
  getCareerInterests,
  updateCareerInterest,
  createCareerGoal,
  updateCareerGoal,
  getCareerGoals,
  evaluateOpportunityReadiness,
  getOpportunitiesForReadiness,
  evaluatePortfolioReadiness,
  getInstructorSkillInsights,
  getAdminSkillIntelligence
} from './careerIntelligenceService.js';
import { analyzeSkillGap } from './skillGapService.js';
import { buildCareerRoadmap } from './developmentRoadmapService.js';
import { computeCareerReadiness } from './careerReadinessService.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ────────────────────────────────────────────────────────────────────────────────
// STUDENT — Skill Profile
// ────────────────────────────────────────────────────────────────────────────────

/**
 * GET /intelligence/career/skills/me
 */
router.get('/skills/me', async (req, res, next) => {
  try {
    assertStudentOwnsCareerData(req.user.id, req.user.id, req.user.role);
    const profile = await getStudentSkillProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

/**
 * GET /intelligence/career/skills/me/:skillId
 */
router.get('/skills/me/:skillId', async (req, res, next) => {
  try {
    assertStudentOwnsCareerData(req.user.id, req.user.id, req.user.role);
    assertValidUUID(req.params.skillId, 'skillId');
    const detail = await getStudentSkillDetail(req.user.id, req.params.skillId);
    if (!detail) return res.status(404).json({ success: false, message: 'Skill not found' });
    res.json({ success: true, data: detail });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────────
// STUDENT — Career Exploration
// ────────────────────────────────────────────────────────────────────────────────

/**
 * GET /intelligence/career/explore
 */
router.get('/explore', async (req, res, next) => {
  try {
    const recommendations = await exploreCareerPaths(req.user.id);
    res.json({ success: true, data: recommendations });
  } catch (err) { next(err); }
});

/**
 * GET /intelligence/career/paths
 */
router.get('/paths', async (req, res, next) => {
  try {
    const paths = await getCareerPaths();
    res.json({ success: true, data: paths });
  } catch (err) { next(err); }
});

/**
 * POST /intelligence/career/paths  [admin only]
 */
router.post('/paths', authorize('admin'), async (req, res, next) => {
  try {
    const path = await createCareerPath(req.body);
    res.status(201).json({ success: true, data: path });
  } catch (err) { next(err); }
});

/**
 * GET /intelligence/career/paths/:pathId  — full intelligence (gap + readiness + roadmap)
 */
router.get('/paths/:pathId', async (req, res, next) => {
  try {
    assertValidUUID(req.params.pathId, 'pathId');
    const intelligence = await getCareerIntelligence(req.user.id, req.params.pathId);
    res.json({ success: true, data: intelligence });
  } catch (err) { next(err); }
});

/**
 * GET /intelligence/career/paths/:pathId/gap
 */
router.get('/paths/:pathId/gap', async (req, res, next) => {
  try {
    assertValidUUID(req.params.pathId, 'pathId');
    const careerPath = await resolveCareerPath(req.params.pathId);
    const gap = await analyzeSkillGap(req.user.id, careerPath);
    res.json({ success: true, data: gap });
  } catch (err) { next(err); }
});

/**
 * GET /intelligence/career/paths/:pathId/readiness
 */
router.get('/paths/:pathId/readiness', async (req, res, next) => {
  try {
    assertValidUUID(req.params.pathId, 'pathId');
    const careerPath = await resolveCareerPath(req.params.pathId);
    const readiness = await computeCareerReadiness(req.user.id, careerPath);
    res.json({ success: true, data: readiness });
  } catch (err) { next(err); }
});

/**
 * GET /intelligence/career/paths/:pathId/roadmap
 */
router.get('/paths/:pathId/roadmap', async (req, res, next) => {
  try {
    assertValidUUID(req.params.pathId, 'pathId');
    const careerPath = await resolveCareerPath(req.params.pathId);
    const roadmap = await buildCareerRoadmap(req.user.id, careerPath);
    res.json({ success: true, data: roadmap });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────────
// STUDENT — Career Interests
// ────────────────────────────────────────────────────────────────────────────────

router.get('/interests', async (req, res, next) => {
  try {
    const interests = await getCareerInterests(req.user.id);
    res.json({ success: true, data: interests });
  } catch (err) { next(err); }
});

router.post('/interests', async (req, res, next) => {
  try {
    const interest = await addCareerInterest(req.user.id, req.body);
    res.status(201).json({ success: true, data: interest });
  } catch (err) { next(err); }
});

router.patch('/interests/:interestId', async (req, res, next) => {
  try {
    const updated = await updateCareerInterest(req.user.id, req.params.interestId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────────
// STUDENT — Career Goals
// ────────────────────────────────────────────────────────────────────────────────

router.get('/goals', async (req, res, next) => {
  try {
    const goals = await getCareerGoals(req.user.id);
    res.json({ success: true, data: goals });
  } catch (err) { next(err); }
});

router.post('/goals', async (req, res, next) => {
  try {
    const goal = await createCareerGoal(req.user.id, req.body);
    res.status(201).json({ success: true, data: goal });
  } catch (err) { next(err); }
});

router.patch('/goals/:goalId', async (req, res, next) => {
  try {
    const updated = await updateCareerGoal(req.user.id, req.params.goalId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────────
// STUDENT — Opportunity & Portfolio Readiness
// ────────────────────────────────────────────────────────────────────────────────

router.get('/opportunity-readiness', async (req, res, next) => {
  try {
    const readiness = await evaluateOpportunityReadiness(req.user.id);
    const opportunities = await getOpportunitiesForReadiness(req.user.id, readiness.readinessCategory);
    res.json({ success: true, data: { readiness, opportunities } });
  } catch (err) { next(err); }
});

router.get('/portfolio-readiness', async (req, res, next) => {
  try {
    const portfolio = await evaluatePortfolioReadiness(req.user.id);
    res.json({ success: true, data: portfolio });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR — Aggregate Course Skill Insights
// ────────────────────────────────────────────────────────────────────────────────

router.get('/instructor/courses/:courseId/skill-insights',
  authorize('instructor', 'teacher', 'admin'),
  async (req, res, next) => {
    try {
      assertValidUUID(req.params.courseId, 'courseId');
      if (req.user.role !== 'admin') {
        await assertInstructorCourseAccess(req.user.id, req.params.courseId);
      }
      const insights = await getInstructorSkillInsights(req.user.id, req.params.courseId);
      res.json({ success: true, data: insights });
    } catch (err) { next(err); }
  }
);

// ────────────────────────────────────────────────────────────────────────────────
// ADMIN — Institutional Skill Intelligence
// ────────────────────────────────────────────────────────────────────────────────

router.get('/admin/skill-intelligence', authorize('admin'), async (req, res, next) => {
  try {
    const intelligence = await getAdminSkillIntelligence();
    res.json({ success: true, data: intelligence });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────────
// GUARDIAN — Privacy-Safe Career Development Summary
// ────────────────────────────────────────────────────────────────────────────────

router.get('/guardian/students/:studentId/summary', async (req, res, next) => {
  try {
    assertValidUUID(req.params.studentId, 'studentId');
    await assertGuardianStudentLink(req.user.id, req.params.studentId);

    const studentId = req.params.studentId;

    const [skillCount, masteredCount, completedCount] = await Promise.all([
      prisma.learnerSkill.count({ where: { userId: studentId, masteryScore: { gte: 50 } } }),
      prisma.learnerConceptMastery.count({
        where: { userId: studentId, masteryState: { in: ['PROFICIENT', 'MASTERED'] } }
      }),
      prisma.userCourseProgress.count({ where: { userId: studentId, completed: true } })
    ]);

    res.json({
      success: true,
      data: {
        privacyNote: 'This summary contains only aggregate learning evidence. Private information, career interests, and AI conversations are not shared.',
        studentId,
        summary: {
          skillsWithEvidence: skillCount,
          masteredConcepts: masteredCount,
          completedCourses: completedCount
        },
        supportiveMessage: 'Your student is showing continued engagement with learning activities. Skill evidence grows with continued practice and assessment.'
      }
    });
  } catch (err) { next(err); }
});

export default router;
