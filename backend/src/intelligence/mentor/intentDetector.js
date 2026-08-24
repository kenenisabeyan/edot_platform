/**
 * EDOT Intelligence — Phase 11
 * AI Mentor Intent Detector
 *
 * Classifies raw student messages into structured learning intents
 * WITHOUT requiring an LLM call — keeping latency low and cost zero.
 *
 * Intent taxonomy aligned with Phase 11 spec:
 *   EXPLAIN_CONCEPT          — student wants a concept explained
 *   SIMPLIFY                 — student wants a simpler version
 *   GIVE_EXAMPLE             — student wants a concrete example
 *   STEP_BY_STEP_GUIDANCE    — student wants a worked walkthrough
 *   REVIEW_TOPIC             — student wants to revisit prior content
 *   PRACTICE_REQUEST         — student wants a practice question / exercise
 *   WHAT_SHOULD_I_DO_NEXT    — student asking for their next learning action
 *   WHAT_IS_MY_PROGRESS      — student asking about their own learning progress
 *   COMPARE_CONCEPTS         — student wants a comparison between two topics
 *   GENERAL_EDUCATIONAL      — educational but outside above intents
 *   UNKNOWN                  — could not classify reliably
 */

const INTENT_PATTERNS = [
  // COMPARE_CONCEPTS must come before EXPLAIN_CONCEPT because
  // "What is the difference between X and Y?" would otherwise match
  // EXPLAIN_CONCEPT's "what is" pattern.
  {
    intent: 'COMPARE_CONCEPTS',
    patterns: [
      /\bcompare\b/i,
      /\bdifference between\b/i,
      /\bversus\b/i,
      /\bvs\.?\b/i,
      /\bhow is .+? different (from|to|than)\b/i,
      /\bsimilarities and differences\b/i,
    ]
  },
  // SIMPLIFY must come before EXPLAIN_CONCEPT because
  // "Explain this in simpler terms" starts with "explain" and would
  // otherwise be classified as EXPLAIN_CONCEPT.
  {
    intent: 'SIMPLIFY',
    patterns: [
      /\bsimplify\b/i,
      /\bsimpler\b/i,
      /\bin simple(r)? terms\b/i,
      /\blayman'?s terms\b/i,
      /\beasier way\b/i,
      /\bi don'?t understand\b/i,
      /\bcan you make .+? easier\b/i,
    ]
  },
  {
    intent: 'EXPLAIN_CONCEPT',
    patterns: [
      /\bexplain\b/i,
      /\bwhat (is|are|does)\b/i,
      /\bdefine\b/i,
      /\bhow does .+? work/i,
      /\btell me about\b/i,
      /\bcan you explain\b/i,
      /\bhelp me understand\b/i,
      /\bwhat do you mean by\b/i,
    ]
  },
  {
    intent: 'GIVE_EXAMPLE',
    patterns: [
      /\bexample\b/i,
      /\bgive me an example\b/i,
      /\bshow me an example\b/i,
      /\bfor instance\b/i,
      /\bcan you show\b/i,
      /\billustrate\b/i,
      /\breal.?world\b/i,
    ]
  },
  {
    intent: 'STEP_BY_STEP_GUIDANCE',
    patterns: [
      /\bstep.?by.?step\b/i,
      /\bwalk me through\b/i,
      /\bhow (do|can|should) i .+? it\b/i,
      /\bguide me\b/i,
      /\bshow me how\b/i,
      /\bhow to\b/i,
    ]
  },
  {
    intent: 'REVIEW_TOPIC',
    patterns: [
      /\breview\b/i,
      /\brevise\b/i,
      /\bgo back to\b/i,
      /\bremind me about\b/i,
      /\bsummaris(e|ize)\b/i,
      /\bsummarise\b/i,
      /\bsummarize\b/i,
      /\brecap\b/i,
      /\brefresh my memory\b/i,
      /\bwhat (did|have) we (cover|learn)\b/i,
    ]
  },
  {
    intent: 'PRACTICE_REQUEST',
    patterns: [
      /\bpractice\b/i,
      /\bquiz me\b/i,
      /\btest me\b/i,
      /\bgive me (a|some) (question|exercise|problem)\b/i,
      /\bproblem set\b/i,
      /\bpractice question\b/i,
      /\blet me try\b/i,
      /\bexercise\b/i,
    ]
  },
  {
    intent: 'WHAT_SHOULD_I_DO_NEXT',
    patterns: [
      /\bwhat should i (do|study|learn|focus on) next\b/i,
      /\bwhat('?s| is) my next (step|lesson|action)\b/i,
      /\bwhere do i go from here\b/i,
      /\bwhat (do|should) i (work on|study) (next|now)\b/i,
      /\bnext step\b/i,
      /\brecommend.+? (for me|next)\b/i,
    ]
  },
  {
    intent: 'WHAT_IS_MY_PROGRESS',
    patterns: [
      /\bmy progress\b/i,
      /\bhow am i (doing|performing)\b/i,
      /\bwhere am i (in the course|in the lesson)\b/i,
      /\bhow (much|many) (have|did) i (learn|complete|cover)\b/i,
      /\bmy (mastery|performance|score)\b/i,
      /\bam i (ready|on track)\b/i,
    ]
  },
  {
    intent: 'GENERAL_EDUCATIONAL',
    patterns: [
      /\blearn\b/i,
      /\bstudy\b/i,
      /\bunderstand\b/i,
      /\bconcept\b/i,
      /\btopic\b/i,
    ]
  }
];

/**
 * Detects the primary intent of a student message.
 *
 * Evaluation order follows INTENT_PATTERNS priority — the first match wins.
 * This keeps the classifier fast and deterministic.
 *
 * @param {string} message — raw student message text
 * @returns {{ intent: string, confidence: number, raw: string }}
 */
export function detectIntent(message) {
  if (!message || typeof message !== 'string') {
    return { intent: 'UNKNOWN', confidence: 0, raw: '' };
  }

  const cleaned = message.trim();

  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(cleaned)) {
        return {
          intent: entry.intent,
          confidence: entry.intent === 'GENERAL_EDUCATIONAL' ? 0.6 : 0.85,
          raw: cleaned
        };
      }
    }
  }

  return { intent: 'UNKNOWN', confidence: 0.4, raw: cleaned };
}

/**
 * Returns true if the intent is directly course-relevant
 * (i.e., not a meta/navigation intent).
 */
export function isCourseContentIntent(intent) {
  return [
    'EXPLAIN_CONCEPT',
    'SIMPLIFY',
    'GIVE_EXAMPLE',
    'STEP_BY_STEP_GUIDANCE',
    'REVIEW_TOPIC',
    'PRACTICE_REQUEST',
    'COMPARE_CONCEPTS',
    'GENERAL_EDUCATIONAL'
  ].includes(intent);
}

/**
 * Returns true if the intent is a learner meta-query
 * (progress / next action).
 */
export function isLearnerMetaIntent(intent) {
  return ['WHAT_SHOULD_I_DO_NEXT', 'WHAT_IS_MY_PROGRESS'].includes(intent);
}
