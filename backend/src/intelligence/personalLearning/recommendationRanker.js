/**
 * EDOT Intelligence Domain - Recommendation Ranker (Phase 10)
 * 
 * Ranks candidate actions into primary and secondary recommendations without overwhelming learners.
 */

export function rankRecommendations(candidateActions) {
  if (!candidateActions || candidateActions.length === 0) {
    return { primary: null, secondary: [] };
  }

  // Sort descending by priorityScore
  const sorted = [...candidateActions].sort((a, b) => b.priorityScore - a.priorityScore);

  const primary = sorted[0];
  const secondary = sorted.slice(1, 3); // Max 2 secondary recommendations to prevent fatigue

  return {
    primary,
    secondary
  };
}
