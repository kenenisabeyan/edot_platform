/**
 * EDOT Intelligence Domain - Learning Events Router
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import { recordLearningEvent, getLearningEvents } from './eventService.js';

const router = express.Router();

// POST /api/v2/intelligence/events - Record learning event
router.post('/', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.id
    };

    const event = await recordLearningEvent(payload);
    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/events/history - Retrieve user's learning event stream
router.get('/history', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { limit, eventType } = req.query;
    const events = await getLearningEvents(req.user.id, limit, eventType);
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    next(error);
  }
});

export default router;
