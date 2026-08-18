/**
 * EDOT Intelligence Domain - AI Mentor Prompt Orchestrator & Response Validator
 */

const HUMAN_SUPPORT_KEYWORDS = [
  /talk to an instructor/i,
  /talk to my teacher/i,
  /connect me with a human/i,
  /need human help/i,
  /contact support/i,
  /completely lost and frustrated/i,
  /help from instructor/i
];

/**
 * Checks if student message expresses need for human/instructor intervention.
 */
export function detectHumanSupportNeed(message) {
  if (!message || typeof message !== 'string') return false;
  return HUMAN_SUPPORT_KEYWORDS.some(pattern => pattern.test(message));
}

/**
 * Prepares system instructions for the AI Provider adapter.
 */
export function buildMentorSystemInstruction(context) {
  return `You are EDOT's Senior AI Academic Mentor and Practice Coach.

YOUR RULES:
1. Explain concepts clearly, encouragingly, and at the learner's academic level (${context.academicLevel || 'Intermediate'}).
2. Ground your explanations in authorized course knowledge: "${context.currentCourseTitle || 'Course'}" - "${context.currentLessonTitle || 'Lesson'}".
3. STRICT MANDATE: Do NOT invent or fabricate course information. If course knowledge is unavailable or not present in the context, explicitly state: "This information could not be verified from available course material."
4. Adapt explanations to help address identified weak skills: ${JSON.stringify(context.identifiedWeakSkills || [])}.
5. Output your response ONLY as valid JSON formatted as follows:
{
  "answer": "Your clear, helpful, and encouraging explanation",
  "sources": ["${context.currentCourseTitle || 'Course'}"],
  "suggestedNextActions": ["Step 1 action", "Step 2 action"],
  "confidence": 0.95,
  "needsHumanSupport": false
}`;
}

/**
 * Parses and validates raw LLM output text into a clean DTO.
 */
export function parseAndValidateMentorResponse(rawText, fallbackContext = {}) {
  try {
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      return {
        answer: parsed.answer || 'Here is an explanation based on your course materials.',
        sources: Array.isArray(parsed.sources) ? parsed.sources : fallbackContext.sources || [],
        suggestedNextActions: Array.isArray(parsed.suggestedNextActions) ? parsed.suggestedNextActions : ['Review lesson notes'],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.92,
        needsHumanSupport: Boolean(parsed.needsHumanSupport)
      };
    }
  } catch {
    // Graceful fallback parse
  }

  return {
    answer: rawText.replace(/```json/g, '').replace(/```/g, '').trim(),
    sources: fallbackContext.sources || [],
    suggestedNextActions: ['Review current module notes'],
    confidence: 0.88,
    needsHumanSupport: false
  };
}
