/**
 * EDOT Intelligence Domain - Human + AI Support Router
 * Endpoints for evaluating escalation triggers, creating tickets with user consent, instructor ticket view, and resolution.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import {
  evaluateSupportEscalation,
  createHumanSupportTicket,
  getInstructorSupportTickets,
  resolveSupportTicket
} from './supportService.js';

const router = express.Router();

// POST /intelligence/support/evaluate-escalation
router.post('/evaluate-escalation', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const recommendation = await evaluateSupportEscalation(req.user.id, req.body);
    res.json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/support/create-ticket
router.post('/create-ticket', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const ticket = await createHumanSupportTicket(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
});

// GET /instructor/support/tickets
router.get('/instructor/tickets', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const tickets = await getInstructorSupportTickets(req.user.id);
    res.json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    next(error);
  }
});

// PUT /instructor/support/tickets/:id/resolve
router.put('/instructor/tickets/:id/resolve', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;
    const result = await resolveSupportTicket(req.params.id, req.user.id, resolutionNotes);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
