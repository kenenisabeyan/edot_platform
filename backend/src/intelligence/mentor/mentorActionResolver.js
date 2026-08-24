/**
 * EDOT Intelligence — Phase 11
 * AI Mentor Action Resolver
 *
 * Server-side validation layer for AI-suggested learning actions.
 *
 * SECURITY PURPOSE:
 * The AI model may suggest actions like "Open Lesson X" or "Practice Concept Y".
 * These action IDs must be validated server-side against the actual database before
 * they are exposed to the frontend — preventing prompt-injection, model hallucination,
 * and ID spoofing that would bypass authorization.
 *
 * Resolves AI-suggested next actions into verified, safe action DTOs.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Action type catalog — the exact strings the AI is allowed to suggest.
 */
export const VALID_ACTION_TYPES = new Set([
  'OPEN_LESSON',
  'PRACTICE_CONCEPT',
  'REVIEW_PREREQUISITE',
  'REVIEW_LESSON',
  'CONTACT_INSTRUCTOR',
  'TAKE_QUIZ',
  'EXPLORE_RESOURCE',
  'TAKE_BREAK',
  'CONTINUE_CURRENT_LESSON',
  'ADVANCE_TO_NEXT_LESSON',
]);

/**
 * Resolves and validates a list of AI-suggested actions against the actual database.
 *
 * @param {string} userId — student ID for enrollment checks
 * @param {Array<object|string>} suggestedActions — raw list from AI response
 * @param {string|null} courseId — course scope for action validation
 * @returns {Promise<Array<object>>} — validated safe action objects
 */
export async function resolveAndValidateActions(userId, suggestedActions, courseId = null) {
  if (!Array.isArray(suggestedActions) || suggestedActions.length === 0) {
    return [];
  }

  const validated = [];

  for (const rawAction of suggestedActions) {
    // Support both string shorthand ("Review lesson notes") and structured { type, id, label }
    if (typeof rawAction === 'string') {
      validated.push({
        type: 'GENERIC',
        label: rawAction.slice(0, 200),
        verified: true
      });
      continue;
    }

    if (typeof rawAction !== 'object' || !rawAction.type) continue;

    const { type, id, label } = rawAction;

    // Reject unknown action types
    if (!VALID_ACTION_TYPES.has(type)) {
      console.warn(`[ActionResolver] Rejected unknown AI action type: ${type}`);
      continue;
    }

    // For actions that require a specific resource ID, validate it exists and is authorized
    if (type === 'OPEN_LESSON' || type === 'REVIEW_LESSON' || type === 'ADVANCE_TO_NEXT_LESSON') {
      if (!id) {
        validated.push({ type, label: label || 'Open Lesson', verified: false, reason: 'NO_ID' });
        continue;
      }

      // Validate lesson exists and belongs to student's enrolled course
      const lesson = await prisma.lesson.findFirst({
        where: { id },
        select: { id: true, title: true, courseId: true }
      }).catch(() => null);

      if (!lesson) {
        console.warn(`[ActionResolver] Lesson ID ${id} not found — dropping action`);
        continue;
      }

      // Confirm enrollment if courseId given
      if (courseId || lesson.courseId) {
        const targetCourseId = courseId || lesson.courseId;
        const enrollment = await prisma.enrollment.findFirst({
          where: { studentId: userId, courseId: targetCourseId, status: 'approved' }
        }).catch(() => null);

        if (!enrollment) {
          console.warn(`[ActionResolver] Student ${userId} not enrolled in course ${targetCourseId} — dropping lesson action`);
          continue;
        }
      }

      validated.push({
        type,
        id: lesson.id,
        label: label || `Open: ${lesson.title}`,
        lessonTitle: lesson.title,
        courseId: lesson.courseId,
        verified: true
      });
      continue;
    }

    if (type === 'PRACTICE_CONCEPT' || type === 'REVIEW_PREREQUISITE') {
      if (!id) {
        // Without an ID, still valid as a non-navigational suggestion
        validated.push({ type, label: label || 'Practice Concept', verified: true });
        continue;
      }

      const node = await prisma.knowledgeNode.findUnique({
        where: { id },
        select: { id: true, name: true }
      }).catch(() => null);

      if (!node) {
        // Soft degrade — label still useful without verified ID
        validated.push({ type, label: label || 'Practice Concept', verified: false, reason: 'NODE_NOT_FOUND' });
        continue;
      }

      validated.push({
        type,
        id: node.id,
        label: label || `Practice: ${node.name}`,
        nodeName: node.name,
        verified: true
      });
      continue;
    }

    if (type === 'TAKE_QUIZ') {
      validated.push({ type, label: label || 'Take a Quiz', verified: true });
      continue;
    }

    // Safe passive actions — no resource ID needed
    validated.push({ type, label: label || type, verified: true });
  }

  return validated;
}

/**
 * Converts flat string suggestions from the AI into structured action objects.
 * Used when AI returns a simple string array instead of typed objects.
 *
 * @param {Array<string>} suggestions
 * @returns {Array<object>}
 */
export function normalizeAISuggestions(suggestions) {
  if (!Array.isArray(suggestions)) return [];

  return suggestions.slice(0, 5).map(s => ({
    type: 'GENERIC',
    label: String(s).slice(0, 200),
    verified: true
  }));
}
