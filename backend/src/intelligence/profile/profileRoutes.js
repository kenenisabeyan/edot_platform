/**
 * EDOT Intelligence Domain - Learner Profile Router
 * Routes for retrieving, refreshing, and managing relational learner profiles and multi-level hierarchy context.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getFullLearnerProfile, syncLearnerProfile, upsertSkillNode } from './profileService.js';
import { getMultiLevelLearnerContext } from './dynamicLearnerIntelligenceEngine.js';
import { ValidationError } from '../shared/errors.js';

const router = express.Router();

// GET /intelligence/profile/hierarchy - Multi-level isolated context
router.get('/hierarchy', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { courseId, lessonId, sectionId } = req.query;
    const hierarchy = await getMultiLevelLearnerContext(req.user.id, courseId || null, lessonId || null, sectionId || null);
    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/profile/me or /api/v2/intelligence/profile/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const profile = await getFullLearnerProfile(req.user.id);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/profile/:userId - Enforce authorization (self or admin)
router.get('/:userId', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only view your own learner profile.'
      });
    }

    const profile = await getFullLearnerProfile(userId);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/profile/refresh or /api/v2/intelligence/profile/sync
router.post('/refresh', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const profile = await syncLearnerProfile(req.user.id);
    res.json({
      success: true,
      message: 'Learner profile successfully refreshed using latest learning events.',
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/profile/sync - Alias
router.post('/sync', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const profile = await syncLearnerProfile(req.user.id);
    res.json({
      success: true,
      message: 'Learner profile successfully resynchronized.',
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/profile/skills - Update or add skill node in skill graph
router.post('/skills', protect, checkNotBlocked, async (req, res, next) => {
  try {
    if (!req.body.name) {
      throw new ValidationError('Skill name is required');
    }
    const skill = await upsertSkillNode(req.user.id, req.body);
    res.json({
      success: true,
      data: skill
    });
  } catch (error) {
    next(error);
  }
});

export default router;
