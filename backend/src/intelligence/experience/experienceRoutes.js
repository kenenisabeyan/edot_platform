/**
 * EDOT Intelligence Domain - Unified Student Experience Router
 * REST API endpoints exposing humanized, prioritized student experience payloads.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../middleware/auth.js';
import {
  getStudentExperienceOverview,
  getWhyThisExplanation
} from './edotIntelligenceExperienceService.js';
import { getLearnerSkillPassport } from '../career/careerIntelligenceService.js';
import { getLearnerCareerGoals } from '../career/careerIntelligenceService.js';
import { getRecommendedOpportunities } from '../opportunities/opportunityService.js';
import { translateSkillStatus, translateOpportunityAlignment } from './intelligenceExperienceTranslator.js';

const router = express.Router();

// GET /api/v2/intelligence/experience/overview
router.get('/overview', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const overview = await getStudentExperienceOverview(req.user.id);
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/experience/action/why
router.get('/action/why', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { actionId } = req.query;
    const why = await getWhyThisExplanation(actionId, req.user.id);
    res.json({ success: true, data: why });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/experience/skills
router.get('/skills', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const passport = await getLearnerSkillPassport(req.user.id);
    const humanizedSkills = Array.isArray(passport?.skills)
      ? passport.skills.map(s => {
          const status = translateSkillStatus(s.evidenceCount, s.isVerified);
          return {
            name: s.skillName,
            statusLabel: status.label,
            statusCode: status.code,
            explanation: status.explanation
          };
        })
      : [];
    res.json({ success: true, count: humanizedSkills.length, data: humanizedSkills });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/experience/career
router.get('/career', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const goals = await getLearnerCareerGoals(req.user.id);
    const humanizedCareer = {
      title: 'Your Future',
      activeGoals: Array.isArray(goals) ? goals.map(g => ({ title: g.title, status: g.status })) : [],
      summary: goals?.length > 0 ? `You are building practical capability for ${goals[0].title}.` : 'Explore career paths to align your learning.'
    };
    res.json({ success: true, data: humanizedCareer });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/experience/opportunities
router.get('/opportunities', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const opps = await getRecommendedOpportunities(req.user.id);
    const humanizedOpps = Array.isArray(opps)
      ? opps.map(o => ({
          title: o.title,
          organization: o.organization,
          opportunityType: o.opportunityType,
          alignmentText: translateOpportunityAlignment(o.alignmentCategory),
          whyRecommended: o.whyRecommended
        }))
      : [];
    res.json({ success: true, count: humanizedOpps.length, data: humanizedOpps });
  } catch (error) {
    next(error);
  }
});

export default router;
