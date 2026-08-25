/**
 * EDOT Intelligence Domain - Global Error Contract & Response Formatting
 * Standardizes API error responses: { error: { code, message, requestId, retryable } }
 * and prevents stack trace or credential leakage.
 */

/**
 * Formats a standardized error object.
 */
export function formatStandardError(code, message, requestId = null, retryable = false) {
  return {
    error: {
      code,
      message,
      requestId: requestId || 'req-isolated',
      retryable
    }
  };
}

/**
 * Express error boundary middleware enforcing global error contract.
 */
export function globalErrorContractMiddleware(err, req, res, next) {
  const requestId = req.requestId || 'req-system';
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const safeMessage = statusCode >= 500 ? 'An internal error occurred. Please try again.' : err.message;

  res.status(statusCode).json(formatStandardError(errorCode, safeMessage, requestId, statusCode >= 500));
}
