/**
 * EDOT Intelligence Domain - Error Hierarchy & Handler
 */

export class IntelligenceError extends Error {
  constructor(message, statusCode = 500, code = 'INTELLIGENCE_ERROR', details = null) {
    super(message);
    this.name = 'IntelligenceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends IntelligenceError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends IntelligenceError {
  constructor(message = 'Requested intelligence resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends IntelligenceError {
  constructor(message = 'Access forbidden to requested intelligence resource') {
    super(message, 403, 'FORBIDDEN_ERROR');
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends IntelligenceError {
  constructor(message = 'Authentication required for intelligence resource') {
    super(message, 401, 'UNAUTHORIZED_ERROR');
    this.name = 'UnauthorizedError';
  }
}

export class AIServiceUnavailableError extends IntelligenceError {
  constructor(message = 'AI inference provider is unavailable or rate-limited') {
    super(message, 503, 'AI_SERVICE_UNAVAILABLE');
    this.name = 'AIServiceUnavailableError';
  }
}

export class ExternalServiceError extends IntelligenceError {
  constructor(message = 'External service provider error') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

export function intelligenceErrorHandler(err, req, res, next) {
  if (err instanceof IntelligenceError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Handle generic unexpected errors gracefully
  console.error('[Intelligence Domain Uncaught Error]:', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_INTELLIGENCE_ERROR',
      message: err.message || 'An unexpected error occurred within the intelligence subsystem.'
    }
  });
}
