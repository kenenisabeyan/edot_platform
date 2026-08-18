/**
 * EDOT Intelligence Domain - Learning Event Validation & Sanitization Layer
 */

import { ValidationError } from '../shared/errors.js';

// Keys to recursively sanitize from metadata and context
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /apiKey/i,
  /api_key/i,
  /authorization/i,
  /bearer/i,
  /creditCard/i,
  /ssn/i,
  /promptText/i,
  /rawPrompt/i,
  /systemInstruction/i
];

/**
 * Recursively sanitizes sensitive information from nested objects
 */
export function sanitizePayload(obj, maxDepth = 4, currentDepth = 0) {
  if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item, maxDepth, currentDepth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value, maxDepth, currentDepth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Validates a single LearningEvent payload and asserts user authorization
 * 
 * @param {object} payload 
 * @param {object} authUser 
 * @returns {object} Normalized, validated, and sanitized event data
 */
export function validateAndNormalizeLearningEvent(payload, authUser = null) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Event payload must be a non-empty JSON object');
  }

  const {
    idempotencyKey,
    userId,
    eventType,
    courseId,
    sectionId,
    lessonId,
    quizId,
    assignmentId,
    timestamp,
    duration,
    score,
    progress,
    metadata,
    context
  } = payload;

  // 1. Resolve & validate userId
  const effectiveUserId = userId || authUser?.id;
  if (!effectiveUserId || typeof effectiveUserId !== 'string') {
    throw new ValidationError('userId is required and must be a valid string identifier');
  }

  // 2. Authorization rule: users can only record events for themselves unless admin
  if (authUser && authUser.id !== effectiveUserId && authUser.role !== 'admin') {
    throw new ValidationError('Unauthorized: You cannot record learning events on behalf of other users');
  }

  // 3. Validate eventType
  if (!eventType || typeof eventType !== 'string' || !eventType.trim()) {
    throw new ValidationError('eventType is required and must be a non-empty string');
  }
  const normalizedEventType = eventType.trim().toUpperCase();

  // 4. Validate timestamp
  let parsedTimestamp = new Date();
  if (timestamp) {
    parsedTimestamp = new Date(timestamp);
    if (isNaN(parsedTimestamp.getTime())) {
      throw new ValidationError('Invalid timestamp provided. Must be a valid ISO 8601 date string');
    }
  }

  // 5. Validate numbers
  let parsedDuration = null;
  if (duration !== undefined && duration !== null) {
    parsedDuration = Number(duration);
    if (isNaN(parsedDuration) || parsedDuration < 0) {
      throw new ValidationError('duration must be a non-negative number');
    }
  }

  let parsedScore = null;
  if (score !== undefined && score !== null) {
    parsedScore = Number(score);
    if (isNaN(parsedScore)) {
      throw new ValidationError('score must be a valid number');
    }
  }

  let parsedProgress = null;
  if (progress !== undefined && progress !== null) {
    parsedProgress = Number(progress);
    if (isNaN(parsedProgress) || parsedProgress < 0 || parsedProgress > 100) {
      throw new ValidationError('progress must be a number between 0 and 100');
    }
  }

  // 6. Validate Idempotency Key
  let cleanIdempotencyKey = null;
  if (idempotencyKey) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length > 255) {
      throw new ValidationError('idempotencyKey must be a string with maximum 255 characters');
    }
    cleanIdempotencyKey = idempotencyKey.trim();
  }

  return {
    idempotencyKey: cleanIdempotencyKey,
    userId: effectiveUserId,
    eventType: normalizedEventType,
    courseId: courseId ? String(courseId) : null,
    sectionId: sectionId ? String(sectionId) : null,
    lessonId: lessonId ? String(lessonId) : null,
    quizId: quizId ? String(quizId) : null,
    assignmentId: assignmentId ? String(assignmentId) : null,
    timestamp: parsedTimestamp,
    duration: parsedDuration,
    score: parsedScore,
    progress: parsedProgress,
    metadata: metadata ? sanitizePayload(metadata) : {},
    context: context ? sanitizePayload(context) : {}
  };
}
