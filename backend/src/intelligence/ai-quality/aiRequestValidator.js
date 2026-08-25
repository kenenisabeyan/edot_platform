/**
 * EDOT Intelligence Domain - AI Request Validator & Prompt Injection Defense Service
 * Classifies requests into NORMAL_REQUEST, SUSPICIOUS_REQUEST, or HIGH_RISK_REQUEST.
 * Server-side security layer preventing system prompt extraction, authorization bypass,
 * and malicious context overrides.
 */

import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';

export const REQUEST_RISK_LEVELS = {
  NORMAL_REQUEST: 'NORMAL_REQUEST',
  SUSPICIOUS_REQUEST: 'SUSPICIOUS_REQUEST',
  HIGH_RISK_REQUEST: 'HIGH_RISK_REQUEST'
};

const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /system prompt/i,
  /reveal (your|the) (instructions|prompt|rules|hidden reasoning)/i,
  /you are now in (dan|developer|override) mode/i,
  /show (me )?all (user|student|quiz|password) data/i,
  /bypass (authorization|privacy|security)/i,
  /as an admin/i
];

/**
 * Validates an incoming AI prompt and classifies injection risk.
 */
export function validateAIRequest(userId, prompt, feature = 'AI_MENTOR') {
  assertValidUUID(userId, 'userId');

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt cannot be empty');
  }

  const sanitizedPrompt = prompt.trim();
  let riskLevel = REQUEST_RISK_LEVELS.NORMAL_REQUEST;
  const matchedPatterns = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitizedPrompt)) {
      matchedPatterns.push(pattern.toString());
    }
  }

  if (matchedPatterns.length >= 2) {
    riskLevel = REQUEST_RISK_LEVELS.HIGH_RISK_REQUEST;
  } else if (matchedPatterns.length === 1) {
    riskLevel = REQUEST_RISK_LEVELS.SUSPICIOUS_REQUEST;
  }

  const isBlocked = riskLevel === REQUEST_RISK_LEVELS.HIGH_RISK_REQUEST;

  return {
    userId,
    feature,
    riskLevel,
    isBlocked,
    matchedPatterns,
    sanitizedPrompt: isBlocked
      ? 'I can only assist with authorized educational learning topics.'
      : sanitizedPrompt
  };
}
