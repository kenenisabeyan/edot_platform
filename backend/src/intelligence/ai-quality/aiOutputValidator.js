/**
 * EDOT Intelligence Domain - AI Output Validator & Sensitive Data Protection Service
 * Validates AI output before delivery, redacting sensitive secrets (passwords, tokens, DB connection strings)
 * and suppressing hidden chain-of-thought internal reasoning traces.
 */

const SECRET_PATTERNS = [
  /password\s*=\s*['"]?[^\s'"]+['"]?/gi,
  /bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*/gi,
  /postgres:\/\/[^\s]+/gi,
  /sk-[a-zA-Z0-9]{20,}/gi,
  /api[_\-]?key\s*[:=]\s*['"]?[^\s'"]+['"]?/gi
];

const HIDDEN_REASONING_PATTERNS = [
  /<thought>[\s\S]*?<\/thought>/gi,
  /chainOfThought/gi,
  /internal_reasoning/gi,
  /system_instruction/gi
];

/**
 * Validates generated output and redacts sensitive data or internal reasoning traces.
 */
export function validateAndSanitizeAIOutput(output) {
  if (!output || typeof output !== 'string') {
    return {
      isValid: false,
      sanitizedOutput: 'I couldn\'t process that response safely. Please try asking in a different way.',
      redactedSecretsCount: 0
    };
  }

  let sanitized = output;
  let redactedSecretsCount = 0;

  // Redact secrets
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(sanitized)) {
      redactedSecretsCount++;
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
  }

  // Strip hidden chain-of-thought reasoning
  for (const pattern of HIDDEN_REASONING_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '');
    }
  }

  sanitized = sanitized.trim();

  return {
    isValid: sanitized.length > 0,
    sanitizedOutput: sanitized.length > 0 ? sanitized : 'I couldn\'t process that response safely. Please try asking in a different way.',
    redactedSecretsCount
  };
}
