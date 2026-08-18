/**
 * EDOT Intelligence Domain - Learning Events Router
 * Mounts endpoints for capturing single and batch learning behavior.
 */

import express from 'express';
import { protect, checkNotBlocked } from '../../../middleware/auth.js';
import {
  createEventHandler,
  createBatchEventsHandler,
  listEventsHandler
} from './learningEventController.js';

const router = express.Router();

// POST /api/learning/events or /api/v2/intelligence/events - Ingest single event
router.post('/', protect, checkNotBlocked, createEventHandler);

// POST /api/learning/events/batch or /api/v2/intelligence/events/batch - Ingest batch events
router.post('/batch', protect, checkNotBlocked, createBatchEventsHandler);

// GET /api/learning/events - Filtered learning events stream
router.get('/', protect, checkNotBlocked, listEventsHandler);

// GET /api/learning/events/history - Convenience alias
router.get('/history', protect, checkNotBlocked, listEventsHandler);

export default router;
