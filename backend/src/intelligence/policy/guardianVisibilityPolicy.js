/**
 * EDOT Intelligence Domain - Guardian Visibility Policy
 * 
 * Centralized privacy policy regulating what information guardians are authorized to view.
 * Strictly hides private AI Mentor dialogues, instructor private notes, and internal AI reasoning.
 */

export function sanitizeForGuardian(intelligenceData) {
  if (!intelligenceData || typeof intelligenceData !== 'object') return intelligenceData;

  const sanitized = JSON.parse(JSON.stringify(intelligenceData));

  // Strip private AI Mentor conversations and internal reasoning
  delete sanitized.mentorConversations;
  delete sanitized.aiChainOfThought;
  delete sanitized.internalScoreCalculations;
  delete sanitized.instructorPrivateNotes;
  delete sanitized.adminPrivateNotes;
  delete sanitized.otherStudentProfiles;

  // Sanitize nested objects if present
  if (sanitized.courses && Array.isArray(sanitized.courses)) {
    sanitized.courses = sanitized.courses.map(c => {
      delete c.instructorPrivateNotes;
      delete c.internalRiskScore;
      return c;
    });
  }

  return sanitized;
}
