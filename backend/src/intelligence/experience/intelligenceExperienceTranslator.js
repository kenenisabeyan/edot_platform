/**
 * EDOT Intelligence Domain - Human-Friendly Intelligence Translator
 * Converts raw internal scores, confidence metrics, and technical terminology into encouraging,
 * human-centered student language.
 *
 * ABSOLUTE AUDIT CONTRACT:
 * NEVER expose internal IDs, raw score floats, KnowledgeNode names, closed-loop algorithm names,
 * confidence percentages, or AI chain-of-thought to the student UX.
 */

/**
 * Translates raw concept mastery scores into human UI status labels.
 */
export function translateMasteryStatus(score) {
  const numericScore = typeof score === 'number' ? score : 0;
  if (numericScore >= 0.8) return { label: 'Strong', code: 'STRONG', text: 'You have a strong understanding of this concept.' };
  if (numericScore >= 0.6) return { label: 'Good progress', code: 'GOOD_PROGRESS', text: 'You are making steady progress.' };
  if (numericScore > 0) return { label: 'Keep practicing', code: 'KEEP_PRACTICING', text: 'A little more practice here will strengthen your understanding.' };
  return { label: 'Not started', code: 'NOT_STARTED', text: 'Ready to explore when you are.' };
}

/**
 * Translates skill evidence confidence into human UI skill status.
 */
export function translateSkillStatus(evidenceCount = 0, isVerified = false) {
  if (isVerified || evidenceCount >= 3) {
    return { label: 'Demonstrated', code: 'DEMONSTRATED', explanation: 'You\'ve demonstrated this skill through your learning and project work.' };
  }
  if (evidenceCount >= 2) {
    return { label: 'Advancing', code: 'ADVANCING', explanation: 'You\'re continuing to build practical capability in this skill.' };
  }
  if (evidenceCount >= 1) {
    return { label: 'Developing', code: 'DEVELOPING', explanation: 'You\'re currently working on foundational concepts for this skill.' };
  }
  return { label: 'Building', code: 'BUILDING', explanation: 'Ready to build evidence through lessons and practice projects.' };
}

/**
 * Translates opportunity alignment categories into human-friendly explanations.
 */
export function translateOpportunityAlignment(alignmentCategory) {
  switch (alignmentCategory) {
    case 'STRONG_ALIGNMENT':
      return 'This opportunity strongly matches your demonstrated skills and portfolio projects.';
    case 'PROMISING':
      return 'This opportunity may be relevant to your current skills and career goals.';
    case 'DEVELOPING_ALIGNMENT':
      return 'Building additional project evidence in missing areas will prepare you for this opportunity.';
    case 'EXPLORATORY':
    default:
      return 'Exploring this opportunity can help guide your future learning choices.';
  }
}

/**
 * Translates adaptive learning events into encouraging student messages.
 */
export function translateAdaptiveAction(actionType, targetName = 'lesson') {
  switch (actionType) {
    case 'REVIEW_CONCEPT':
    case 'REVIEW_PREREQUISITE':
      return {
        actionLabel: 'Review Concept',
        code: 'REVIEW',
        message: `Taking a moment to review ${targetName} will help make the next topic easier.`
      };
    case 'PRACTICE_CONCEPT':
      return {
        actionLabel: 'Practice Concept',
        code: 'PRACTICE',
        message: `A quick practice session on ${targetName} will strengthen your understanding.`
      };
    case 'RETRY_ALLOWED_ASSESSMENT':
      return {
        actionLabel: 'Try Again',
        code: 'TRY_AGAIN',
        message: 'You can retry this practice assessment when you\'re ready.'
      };
    case 'ADVANCE_TO_NEXT_LESSON':
    case 'CONTINUE_CURRENT_LESSON':
    default:
      return {
        actionLabel: 'Continue Learning',
        code: 'CONTINUE',
        message: `Continue with ${targetName} to keep your progress moving forward.`
      };
  }
}

/**
 * Translates requirement gap status into constructive next steps.
 */
export function translateGapStatus(gapStatus) {
  switch (gapStatus) {
    case 'READY_TO_EXPLORE':
      return 'Your capability evidence strongly aligns. Review requirements and consider applying.';
    case 'DEVELOPING':
      return 'Completing a practical project challenge will help strengthen missing skill areas.';
    case 'EARLY_STAGE':
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return 'Completing core lessons and building portfolio work samples will help prepare you.';
  }
}

/**
 * Generates encouraging, non-punitive greeting headers.
 */
export function generateStudentGreeting(studentName = 'Learner', streakDays = 0) {
  const name = studentName.split(' ')[0] || 'Learner';
  if (streakDays > 3) {
    return `Great consistency, ${name}! You're making steady progress on your learning path.`;
  }
  return `Welcome back, ${name}! Here's the best place to continue your learning journey today.`;
}
