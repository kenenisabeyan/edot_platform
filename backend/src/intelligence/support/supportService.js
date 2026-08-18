/**
 * EDOT Intelligence Domain - Support Escalation Service
 * Manages support ticket creation upon user consent, instructor ticket view, and resolution.
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateEscalationTriggers } from './supportEscalator.js';
import { NotFoundError, ForbiddenError } from '../shared/errors.js';

/**
 * Evaluates support triggers for a user.
 */
export async function evaluateSupportEscalation(userId, contextParams = {}) {
  return evaluateEscalationTriggers(contextParams);
}

/**
 * Creates a human support ticket after explicit user consent.
 */
export async function createHumanSupportTicket(userId, {
  courseId = null,
  lessonId = null,
  triggerReason = 'EXPLICIT_REQUEST',
  userConsentGiven = true,
  sharedContextSummary = {}
}) {
  if (!userConsentGiven) {
    throw new ForbiddenError('User consent is required before sharing learning context with human instructors.');
  }

  // Find assigned instructor if courseId provided
  let assignedInstructorId = null;
  if (courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (course) assignedInstructorId = course.instructorId;
  }

  const ticket = await prisma.humanSupportTicket.create({
    data: {
      userId,
      courseId,
      lessonId,
      triggerReason,
      confidenceScore: 0.5,
      userConsentGiven: true,
      sharedContextSummary,
      status: 'OPEN',
      assignedInstructorId
    }
  });

  return {
    ticketId: ticket.id,
    status: ticket.status,
    triggerReason: ticket.triggerReason,
    assignedInstructorId: ticket.assignedInstructorId,
    userConsentGiven: ticket.userConsentGiven,
    createdAt: ticket.createdAt
  };
}

/**
 * Returns human support tickets assigned to or managed by an instructor.
 */
export async function getInstructorSupportTickets(instructorId) {
  const tickets = await prisma.humanSupportTicket.findMany({
    where: {
      assignedInstructorId: instructorId
    },
    include: {
      user: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return tickets.map(t => ({
    ticketId: t.id,
    studentName: t.user.name,
    studentEmail: t.user.email,
    courseId: t.courseId,
    triggerReason: t.triggerReason,
    status: t.status,
    sharedContextSummary: t.sharedContextSummary,
    createdAt: t.createdAt
  }));
}

/**
 * Resolves a human support ticket.
 */
export async function resolveSupportTicket(ticketId, instructorId, resolutionNotes = '') {
  const ticket = await prisma.humanSupportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new NotFoundError('Support ticket not found');
  }

  const updated = await prisma.humanSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: 'RESOLVED',
      assignedInstructorId: instructorId,
      resolutionNotes
    }
  });

  return {
    ticketId: updated.id,
    status: updated.status,
    resolutionNotes: updated.resolutionNotes,
    resolvedAt: updated.updatedAt
  };
}
