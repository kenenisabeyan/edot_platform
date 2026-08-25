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
  },
  // Phase 12 — Career Intelligence intents
  {
    intent: 'CAREER_EXPLORATION',
    patterns: [
      /\bwhat career\b/i,
      /\bcareer (can i|should i|could i|options|paths|explore|opportunities)\b/i,
      /\bexplore (careers|career paths|jobs|opportunities)\b/i,
      /\bwhat (jobs?|careers?|roles?) (match|suit|fit|align with) me\b/i,
      /\bcareer (exploration|discovery|guidance)\b/i,
    ]
  },
  {
    intent: 'SKILL_DISCOVERY',
    patterns: [
      /\bwhat skills (am i|have i|do i have|am i developing)\b/i,
      /\bmy (skills|skill (profile|set|development|evidence))\b/i,
      /\bskills? (i am|i'm) (developing|building|learning|gaining)\b/i,
      /\bshow (me )?my skills?\b/i,
      /\bskill (summary|overview|status)\b/i,
    ]
  },
  {
    intent: 'SKILL_GAP_INQUIRY',
    patterns: [
      /\bwhat skills (am i missing|do i (lack|need|still need))\b/i,
      /\bskill (gaps?|deficiencies|weaknesses)\b/i,
      /\bwhat (do|should) i still learn\b/i,
      /\bmissing (skills?|requirements?)\b/i,
      /\bwhat.+?need.+?(career|job|role|path)\b/i,
    ]
  },
  {
    intent: 'CAREER_READINESS',
    patterns: [
      /\bam i ready\b/i,
      /\bcareer readiness\b/i,
      /\breadiness (for|to)\b/i,
      /\b(ready|prepared) (to explore|for internship|for job|for career)\b/i,
      /\binternship readiness\b/i,
      /\bopportunity readiness\b/i,
    ]
  },
  {
    intent: 'ROADMAP_REQUEST',
    patterns: [
      /\b(build|create|make|show|give) (me )?(a )?roadmap\b/i,
      /\blearning (roadmap|path|plan)\b/i,
      /\bcareer (roadmap|plan|path|timeline)\b/i,
      /\bhow (do i|should i|can i) (get to|become|prepare for)\b/i,
      /\bsteps? to (become|achieve|reach|get to)\b/i,
    ]
  },
  // Phase 13 — Project & Portfolio Intelligence intents
  {
    intent: 'PROJECT_IDEAS',
    patterns: [
      /\bwhat project (should|can|could) i (build|make|create|do)\b/i,
      /\bproject (ideas?|suggestions?|challenges?|recommendations?)\b/i,
      /\bhelp me (find|choose|pick) a project\b/i,
      /\bportfolio project (ideas?|suggestions?)\b/i,
    ]
  },
  {
    intent: 'PROJECT_PLANNING',
    patterns: [
      /\bhelp me plan (my|a) project\b/i,
      /\bproject (plan|planning|milestones?|steps?|breakdown)\b/i,
      /\bhow (should|do) i (plan|structure|start) (this|my) project\b/i,
    ]
  },
  {
    intent: 'PROJECT_FEEDBACK_REQUEST',
    patterns: [
      /\b(review|check|evaluate|feedback on) (my|this) project\b/i,
      /\bproject (feedback|review)\b/i,
      /\bhow is my project\b/i,
    ]
  },
  {
    intent: 'MILESTONE_HELP',
    patterns: [
      /\bblocked on (this|a|my) milestone\b/i,
      /\bhelp (me )?with (this|my) milestone\b/i,
      /\bmilestone (is blocked|help|guidance)\b/i,
    ]
  },
  // Phase 14 — Human, Mentorship & Collaborative Intelligence intents
  {
    intent: 'FIND_MENTOR',
    patterns: [
      /\bfind (a )?mentor\b/i,
      /\bneed (a )?mentor\b/i,
      /\bmentor (recommendation|matching|search|help)\b/i,
      /\bconnect (with|to) a mentor\b/i,
    ]
  },
  {
    intent: 'PEER_MATCHING',
    patterns: [
      /\bfind (study )?peers\b/i,
      /\bpeer (matching|learning|study group)\b/i,
      /\bconnect with (other )?students\b/i,
      /\bstudy partner\b/i,
    ]
  },
  {
    intent: 'TEAM_COLLABORATION',
    patterns: [
      /\bfind team members?\b/i,
      /\bproject (collaboration|collaborators?|team)\b/i,
      /\bjoin (a )?team\b/i,
      /\bteam project help\b/i,
    ]
  },
  {
    intent: 'COMMUNITY_SEARCH',
    patterns: [
      /\bfind (a )?community\b/i,
      /\bjoin (a )?community\b/i,
      /\bstudy group\b/i,
      /\bskill community\b/i,
    ]
  },
  {
    intent: 'HUMAN_SUPPORT_REQUEST',
    patterns: [
      /\bconnect me (to|with) a human\b/i,
      /\bspeak (to|with) a (person|human|instructor|mentor)\b/i,
      /\bneed human (help|support|guidance)\b/i,
    ]
  },
  // Phase 15 — Global Opportunity & Ecosystem Intelligence intents
  {
    intent: 'OPPORTUNITY_SEARCH',
    patterns: [
      /\bfind (jobs?|internships?|scholarships?|fellowships?|hackathons?|competitions?)\b/i,
      /\b(job|internship|scholarship|fellowship) (search|list|options?|opportunities?)\b/i,
      /\bwhat opportunities are (available|open)\b/i,
    ]
  },
  {
    intent: 'OPPORTUNITY_MATCHING',
    patterns: [
      /\bmatch me (with|to) opportunities\b/i,
      /\bopportunity (recommendations?|matching|alignment)\b/i,
      /\bwhat (jobs?|internships?) fit my profile\b/i,
    ]
  },
  {
    intent: 'APPLICATION_PREPARATION',
    patterns: [
      /\bhelp me prepare (for|my) (application|interview|job)\b/i,
      /\bapplication (prep|preparation|checklist|plan)\b/i,
      /\bhow (do i|should i) prepare for (this|a) (job|internship|scholarship)\b/i,
    ]
  },
  {
    intent: 'INTERVIEW_PRACTICE',
    patterns: [
      /\bpractice (for my|an) interview\b/i,
      /\binterview (prep|practice|questions?|mock)\b/i,
      /\bmock interview\b/i,
    ]
  },
  {
    intent: 'CONSENT_MANAGEMENT',
    patterns: [
      /\bmanage (my )?consent\b/i,
      /\bprivacy (settings|consent|sharing)\b/i,
      /\bshare (my )?(portfolio|profile) with (partners|employers)\b/i,
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

/**
 * Returns true if the intent is a Phase 12 Career Intelligence query.
 */
export function isCareerIntent(intent) {
  return [
    'CAREER_EXPLORATION',
    'SKILL_DISCOVERY',
    'SKILL_GAP_INQUIRY',
    'CAREER_READINESS',
    'ROADMAP_REQUEST'
  ].includes(intent);
}

/**
 * Returns true if the intent is a Phase 13 Project & Portfolio query.
 */
export function isProjectIntent(intent) {
  return [
    'PROJECT_IDEAS',
    'PROJECT_PLANNING',
    'PROJECT_FEEDBACK_REQUEST',
    'MILESTONE_HELP'
  ].includes(intent);
}

/**
 * Returns true if the intent is a Phase 14 Human, Mentorship & Collaboration query.
 */
export function isCollaborationIntent(intent) {
  return [
    'FIND_MENTOR',
    'PEER_MATCHING',
    'TEAM_COLLABORATION',
    'COMMUNITY_SEARCH',
    'HUMAN_SUPPORT_REQUEST'
  ].includes(intent);
}

/**
 * Returns true if the intent is a Phase 15 Global Opportunity query.
 */
export function isOpportunityIntent(intent) {
  return [
    'OPPORTUNITY_SEARCH',
    'OPPORTUNITY_MATCHING',
    'APPLICATION_PREPARATION',
    'INTERVIEW_PRACTICE',
    'CONSENT_MANAGEMENT'
  ].includes(intent);
}
