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

export class AIServiceUnavailableError extends IntelligenceError {
  constructor(message = 'AI inference provider is unavailable or rate-limited') {
    super(message, 503, 'AI_SERVICE_UNAVAILABLE');
    this.name = 'AIServiceUnavailableError';
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
