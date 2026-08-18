/**
 * EDOT Intelligence Domain - Skill Passport & Evidence Router
 * Exposes endpoints for learner skill passports, evidence ingestion, and public verification.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { getLearnerSkillPassport, recordSkillEvidence, verifySkillPassportByHash } from './passportService.js';

const router = express.Router();

// GET /intelligence/skill-passport/me
router.get('/me', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const passport = await getLearnerSkillPassport(req.user.id);
    res.json({
      success: true,
      data: passport
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/skill-passport/evidence
router.post('/evidence', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { skillName, evidenceData } = req.body;
    if (!skillName) {
      return res.status(400).json({ success: false, message: 'skillName is required' });
    }
    const result = await recordSkillEvidence(req.user.id, skillName, evidenceData || {});
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/skill-passport/verify/:passportHash (Public Verification Endpoint)
router.get('/verify/:passportHash', async (req, res, next) => {
  try {
    const verifiedPassport = await verifySkillPassportByHash(req.params.passportHash);
    res.json({
      success: true,
      data: verifiedPassport
    });
  } catch (error) {
    next(error);
  }
});

export default router;
