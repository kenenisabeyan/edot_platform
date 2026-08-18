/**
 * EDOT Intelligence Domain - Skill Graph Router
 * Endpoints for learner skill graph, verified strengths, weak skills, missing prerequisites, and evidence detail.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  getLearnerSkillGraph,
  getLearnerStrengths,
  getLearnerWeaknesses,
  getMissingPrerequisites,
  getSkillEvidenceDetail
} from './skillGraphService.js';

const router = express.Router();

// GET /intelligence/skills/graph/me
router.get('/graph/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const graph = await getLearnerSkillGraph(req.user.id);
    res.json({
      success: true,
      data: graph
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/skills/strengths/me
router.get('/strengths/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const strengths = await getLearnerStrengths(req.user.id);
    res.json({
      success: true,
      count: strengths.length,
      data: strengths
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/skills/weaknesses/me
router.get('/weaknesses/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const weaknesses = await getLearnerWeaknesses(req.user.id);
    res.json({
      success: true,
      count: weaknesses.length,
      data: weaknesses
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/skills/prerequisites/missing
router.get('/prerequisites/missing', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const missingPrereqs = await getMissingPrerequisites(req.user.id);
    res.json({
      success: true,
      count: missingPrereqs.length,
      data: missingPrereqs
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/skills/:skillId/evidence
router.get('/:skillId/evidence', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const evidenceDetail = await getSkillEvidenceDetail(req.user.id, req.params.skillId);
    res.json({
      success: true,
      data: evidenceDetail
    });
  } catch (error) {
    next(error);
  }
});

export default router;
