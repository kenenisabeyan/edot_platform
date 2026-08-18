/**
 * EDOT Intelligence Domain - Human + AI Support Escalation Evaluator
 * Evaluates triggers (repeated failure, misunderstanding, explicit request, low AI confidence)
 * and generates human support recommendations with explicit privacy consent prompts.
 */

/**
 * Evaluates triggers and returns escalation recommendation.
 * 
 * @param {object} params
 */
export function evaluateEscalationTriggers({
  failedAttempts = 0,
  repeatedMisunderstandings = false,
  explicitHelpRequested = false,
  aiConfidence = 0.95
}) {
  let shouldEscalate = false;
  let triggerReason = 'NONE';
  let confidenceScore = aiConfidence;

  if (explicitHelpRequested) {
    shouldEscalate = true;
    triggerReason = 'EXPLICIT_REQUEST';
  } else if (failedAttempts >= 3) {
    shouldEscalate = true;
    triggerReason = 'REPEATED_FAILURE';
  } else if (repeatedMisunderstandings) {
    shouldEscalate = true;
    triggerReason = 'REPEATED_MISUNDERSTANDING';
  } else if (aiConfidence < 0.65) {
    shouldEscalate = true;
    triggerReason = 'LOW_AI_CONFIDENCE';
  }

  const privacyConsentPrompt = `If you request human instructor support, the following will be shared: Course progress, Quiz error topics, and Target skill gaps. Private AI chat logs will NOT be shared without your explicit consent.`;

  return {
    shouldEscalate,
    triggerReason,
    confidenceScore,
    suggestedRole: shouldEscalate ? 'Course Instructor / Teaching Assistant' : null,
    privacyConsentPrompt,
    userConsentRequired: true
  };
}
