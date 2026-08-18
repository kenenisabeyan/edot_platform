/**
 * EDOT Intelligence Domain - Feedback-Aware Ranking & Deterministic Adjustment Engine
 * Adjusts recommendation, nudge, and mentor ranking scores based on collected behavioral feedback
 * without automatic uncontrolled model retraining.
 */

/**
 * Calculates deterministic affinity modifier based on historical feedback records.
 * 
 * @param {Array} feedbackHistory 
 * @returns {number} Affinity multiplier offset (-0.5 to +0.5)
 */
export function calculateFeedbackAffinityOffset(feedbackHistory = []) {
  let scoreOffset = 0.0;

  for (const record of feedbackHistory) {
    const type = record.feedbackType.toUpperCase();
    switch (type) {
      case 'ACCEPTED':
      case 'COMPLETED':
      case 'HELPFUL':
        scoreOffset += 0.15;
        break;
      case 'SHOWN':
        scoreOffset += 0.01;
        break;
      case 'IGNORED':
        scoreOffset -= 0.05;
        break;
      case 'DISMISSED':
      case 'NOT_HELPFUL':
        scoreOffset -= 0.20;
        break;
      case 'FAILED':
        scoreOffset -= 0.10;
        break;
      case 'OVERRIDE':
        scoreOffset -= 0.25;
        break;
      default:
        break;
    }
  }

  // Bound adjustment between -0.5 and +0.5 to preserve base relevance logic
  return Math.max(-0.5, Math.min(0.5, scoreOffset));
}

/**
 * Ranks items deterministically applying feedback affinity offsets.
 * 
 * @param {Array} items List of recommendation/nudge items
 * @param {Map} feedbackMap Map of item targetId -> array of feedback items
 * @returns {Array} Re-ranked items sorted by adjusted score
 */
export function rankItemsWithFeedback(items = [], feedbackMap = new Map()) {
  return items.map(item => {
    const targetId = item.id || item.targetId || item.courseId;
    const history = feedbackMap.get(targetId) || [];
    const offset = calculateFeedbackAffinityOffset(history);
    const baseScore = item.relevanceScore || item.matchScore || 0.75;
    const adjustedScore = Math.max(0.0, Math.min(1.0, baseScore + offset));

    return {
      ...item,
      baseScore,
      feedbackOffset: Number(offset.toFixed(2)),
      adjustedScore: Number(adjustedScore.toFixed(2))
    };
  }).sort((a, b) => b.adjustedScore - a.adjustedScore);
}
