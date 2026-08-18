/**
 * EDOT Intelligence Domain - Validation Layer
 */

import { ValidationError } from './errors.js';
import { EventTypes } from './contracts.js';

export function validateEventPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Event payload must be a non-empty object');
  }

  const { eventType, userId } = payload;

  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('userId is required and must be a valid string identifier');
  }

  if (!eventType || !Object.values(EventTypes).includes(eventType)) {
    throw new ValidationError(
      `Invalid or missing eventType. Must be one of: ${Object.values(EventTypes).join(', ')}`,
      { received: eventType }
    );
  }

  return true;
}

export function validateMentorChatPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Mentor chat payload is missing');
  }

  if (!payload.message || typeof payload.message !== 'string' || !payload.message.trim()) {
    throw new ValidationError('A non-empty message string is required');
  }

  return true;
}

export function validateRecommendationFeedbackPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Feedback payload is missing');
  }

  const { targetTitle, actionType } = payload;
  const allowedActions = ['enrolled', 'viewed', 'dismissed', 'completed'];

  if (!targetTitle || typeof targetTitle !== 'string') {
    throw new ValidationError('targetTitle is required');
  }

  if (!actionType || !allowedActions.includes(actionType)) {
    throw new ValidationError(`actionType must be one of: ${allowedActions.join(', ')}`);
  }

  return true;
}
