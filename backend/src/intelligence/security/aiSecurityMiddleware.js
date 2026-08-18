/**
 * EDOT Intelligence Domain - AI Security Express Middleware
 * Protects AI endpoints against prompt injection, context unauthorized access,
 * token quota overruns, and output leaks.
 */

import {
  sanitizeAndValidateUserInput,
  verifyContextAuthorization,
  validateAndSanitizeAiOutput,
  AiUsageQuotaMonitor
} from './aiSecurityGuard.js';

export function protectAiEndpoint(req, res, next) {
  try {
    const userInput = req.body.message || req.body.userInput || req.body.prompt || '';
    if (userInput) {
      req.body.sanitizedInput = sanitizeAndValidateUserInput(userInput);
    }

    // Verify context target authorization if provided
    if (req.body.targetUserId) {
      verifyContextAuthorization(req.user.id, req.body.targetUserId);
    }

    // Token quota check
    const usage = AiUsageQuotaMonitor.checkAndRecordTokenUsage(req.user.id, 400);
    req.aiTokenUsage = usage;

    // Intercept JSON response to sanitize output
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && body.data && typeof body.data.reply === 'string') {
        body.data.reply = validateAndSanitizeAiOutput(body.data.reply);
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
}
