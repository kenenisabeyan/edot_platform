/**
 * EDOT Intelligence — Phase 11
 * AI Mentor Prompt Orchestrator & Response Validator (Enhanced)
 *
 * Builds intent-aware system prompts and validates AI responses.
 * The orchestrator knows what the student asked (intent), what their
 * learning context is, and what the AI is allowed to say.
 */

// ── Human Support Signals ────────────────────────────────────────────────────

const HUMAN_SUPPORT_KEYWORDS = [
  /talk to an instructor/i,
  /talk to my teacher/i,
  /connect me with a human/i,
  /need human help/i,
  /contact support/i,
  /completely lost and frustrated/i,
  /help from instructor/i,
  /i give up/i,
  /this is too hard/i,
  /i need real help/i,
];

/**
 * Checks if student message expresses need for human/instructor intervention.
 * @param {string} message
 * @returns {boolean}
 */
export function detectHumanSupportNeed(message) {
  if (!message || typeof message !== 'string') return false;
  return HUMAN_SUPPORT_KEYWORDS.some(pattern => pattern.test(message));
}

// ── Intent-Specific Instruction Inserts ─────────────────────────────────────

const INTENT_INSTRUCTIONS = {
  EXPLAIN_CONCEPT: `Your primary task: Explain the concept clearly.
- Use simple, accurate language appropriate for the learner's academic level.
- Ground your explanation in the authorized course content below.
- Structure: brief intro → core explanation → how it fits in the course.`,

  SIMPLIFY: `Your primary task: Provide a simplified explanation.
- Use analogies, plain English, and short sentences.
- Avoid jargon unless you immediately define it.
- Check if the learner's identified weak skills are related, and address them.`,

  GIVE_EXAMPLE: `Your primary task: Provide a concrete, relevant example.
- Ground the example in the current course context if possible.
- Use real-world, relatable scenarios where applicable.
- After the example, briefly explain what it illustrates.`,

  STEP_BY_STEP_GUIDANCE: `Your primary task: Provide a clear step-by-step walkthrough.
- Number each step.
- Explain the purpose of each step, not just the action.
- Flag any prerequisite knowledge needed before proceeding.`,

  REVIEW_TOPIC: `Your primary task: Provide a structured review/recap.
- Summarise the key points of the topic concisely.
- Highlight what the learner should already know vs. what to reinforce.
- Connect the review to what comes next in the learning journey.`,

  PRACTICE_REQUEST: `Your primary task: Provide a relevant practice question or exercise.
- Match difficulty to the learner's mastery state and quiz performance.
- Do NOT give the answer immediately — present the problem first.
- After presentation, offer a hint if appropriate.`,

  WHAT_SHOULD_I_DO_NEXT: `Your primary task: Give a clear, personalized next learning action.
- Use the Personal Learning Plan and Recommended Next Action from the context below.
- Explain WHY this is the right next step based on their mastery and progress.
- Be specific: name the lesson, concept, or activity to do next.`,

  WHAT_IS_MY_PROGRESS: `Your primary task: Give a clear, honest progress summary.
- Use the mastery states, quiz performance, and completed lessons from the context.
- Highlight strengths and specific areas for improvement.
- Be encouraging but accurate — do not inflate progress.`,

  COMPARE_CONCEPTS: `Your primary task: Compare and contrast the requested concepts.
- Use a clear structure: similarities → differences → when to use which.
- Relate the comparison to content in the current course.`,

  GENERAL_EDUCATIONAL: `Your primary task: Provide a helpful educational response.
- Ground your answer in the course knowledge if related.
- If the question is outside the course, provide general educational context.`,

  UNKNOWN: `Your primary task: Understand and address the student's learning need.
- Try to identify what they are asking.
- Respond helpfully based on their current course context.`,
};

// ── System Prompt Builder ─────────────────────────────────────────────────────

/**
 * Builds an intent-aware, context-rich system instruction for the AI provider.
 *
 * @param {object} context — from contextBuilder.buildStudentLearningContext
 * @param {string} intent — from intentDetector.detectIntent
 * @param {Array<{role: string, content: string}>} [conversationHistory] — trimmed prior turns
 * @returns {string} System instruction string
 */
export function buildMentorSystemInstruction(context, intent = 'UNKNOWN', conversationHistory = []) {
  const intentInstruction = INTENT_INSTRUCTIONS[intent] || INTENT_INSTRUCTIONS.UNKNOWN;

  const masteryBlock = context.masteryStates?.length > 0
    ? `\nMastery States:\n${context.masteryStates.slice(0, 8).map(m => `  - ${m}`).join('\n')}`
    : '';

  const prerequisiteBlock = context.prerequisiteGaps?.length > 0
    ? `\nPrerequisite Gaps Detected:\n${context.prerequisiteGaps.slice(0, 5).map(g => `  - ${g.nodeName || g}`).join('\n')}`
    : '';

  const weakSkillsBlock = context.identifiedWeakSkills?.length > 0
    ? `\nIdentified Weak Skills: ${context.identifiedWeakSkills.slice(0, 5).join(', ')}`
    : '';

  const nextActionBlock = context.recommendedNextAction
    ? `\nRecommended Next Action: ${context.recommendedNextAction.actionType} — ${context.recommendedNextAction.explanation || ''}`
    : '';

  const pulseBlock = context.pulse?.isFatigued
    ? '\n⚠ FATIGUE SIGNAL: The student shows signs of cognitive fatigue. Keep your response concise and supportive.'
    : '';

  const knowledgeBlock = context.groundedKnowledge
    ? `\n\n[AUTHORIZED COURSE KNOWLEDGE]\n${context.groundedKnowledge.slice(0, 3000)}`
    : '\n\n[No specific course knowledge available for this query — provide general educational guidance]';

  const historyBlock = conversationHistory.length > 0
    ? `\n\n[RECENT CONVERSATION CONTEXT]\n${conversationHistory.map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content.slice(0, 300)}`).join('\n')}`
    : '';

  return `You are EDOT's AI Academic Mentor — a deeply knowledgeable, encouraging, and honest educator.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STUDENT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Student Name: ${context.learnerName || 'Student'}
Academic Level: ${context.academicLevel || 'Intermediate'}
Current Course: ${context.currentCourseTitle || 'General Curriculum'}
Current Lesson: ${context.currentLessonTitle || 'Current Module'}
Completed Lessons: ${context.completedLessonsCount || 0}
Quiz Performance: ${context.recentQuizPerformance?.accuracyPercent ?? 'N/A'}% accuracy over ${context.recentQuizPerformance?.attempts ?? 0} attempts
Goals: ${(context.goals || []).join(', ')}${masteryBlock}${prerequisiteBlock}${weakSkillsBlock}${nextActionBlock}${pulseBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTENT DETECTED: ${intent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${intentInstruction}
${knowledgeBlock}${historyBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NEVER fabricate course-specific facts. If the authorized course knowledge above does not confirm something, say: "This could not be verified from available course material."
2. NEVER expose other students' data or internal system data.
3. NEVER give manipulative encouragement. Be honest and constructive.
4. Adapt language to the student's academic level.
5. If the student clearly needs instructor support, set needsHumanSupport: true.
6. Output ONLY valid JSON matching the exact schema below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT FORMAT (JSON ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "answer": "Your clear, educational, honest response",
  "groundingStatus": "COURSE_GROUNDED | EDOT_KNOWLEDGE_GROUNDED | GENERAL_EDUCATIONAL | LIMITED_CONTEXT",
  "sources": ["Source name or lesson title"],
  "suggestedNextActions": ["Action 1", "Action 2"],
  "confidence": 0.0–1.0,
  "needsHumanSupport": false,
  "conversationSummary": "One-sentence summary of this exchange"
}`;
}

// ── Response Parser & Validator ───────────────────────────────────────────────

/**
 * Valid grounding status values.
 */
const VALID_GROUNDING_STATUS = new Set([
  'COURSE_GROUNDED',
  'EDOT_KNOWLEDGE_GROUNDED',
  'GENERAL_EDUCATIONAL',
  'LIMITED_CONTEXT'
]);

/**
 * Parses and validates raw LLM output into a clean, safe response DTO.
 *
 * @param {string} rawText — raw AI provider output
 * @param {object} fallbackContext — used for graceful degradation
 * @returns {object} Validated response DTO
 */
export function parseAndValidateMentorResponse(rawText, fallbackContext = {}) {
  try {
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);

      const groundingStatus = VALID_GROUNDING_STATUS.has(parsed.groundingStatus)
        ? parsed.groundingStatus
        : (fallbackContext.groundedKnowledge ? 'COURSE_GROUNDED' : 'GENERAL_EDUCATIONAL');

      return {
        answer: String(parsed.answer || 'Here is guidance based on your course materials.').slice(0, 5000),
        groundingStatus,
        sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 5) : (fallbackContext.sources || []),
        suggestedNextActions: Array.isArray(parsed.suggestedNextActions)
          ? parsed.suggestedNextActions.slice(0, 5)
          : ['Review current module notes'],
        confidence: typeof parsed.confidence === 'number'
          ? Math.min(Math.max(parsed.confidence, 0), 1)
          : 0.88,
        needsHumanSupport: Boolean(parsed.needsHumanSupport),
        conversationSummary: typeof parsed.conversationSummary === 'string'
          ? parsed.conversationSummary.slice(0, 300)
          : null
      };
    }
  } catch {
    // Intentional fallthrough
  }

  // Graceful string fallback
  const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return {
    answer: cleanText.slice(0, 5000) || 'I am here to help with your learning. Please try asking again.',
    groundingStatus: fallbackContext.groundedKnowledge ? 'COURSE_GROUNDED' : 'GENERAL_EDUCATIONAL',
    sources: fallbackContext.sources || [],
    suggestedNextActions: ['Review current module notes'],
    confidence: 0.75,
    needsHumanSupport: false,
    conversationSummary: null
  };
}
