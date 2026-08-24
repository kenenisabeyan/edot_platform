/**
 * EDOT Intelligence Domain - Recommendation Explanation Service (Phase 10)
 * 
 * Generates transparent, student-friendly explanations without exposing AI chain-of-thought
 * or raw score formulas.
 */

export function generateExplanation(action, context) {
  if (!action) return 'No recommendation generated.';

  const actionType = action.actionType;

  switch (actionType) {
    case 'TAKE_BREAK':
      return 'Your recent learning activity shows increased fatigue or difficulty signals. Taking a short break will help refresh your focus before continuing.';
    
    case 'REVIEW_PREREQUISITE':
      return 'Your performance on current topics indicates that reviewing foundational prerequisite concepts will strengthen your understanding and make future lessons easier.';
    
    case 'PRACTICE_CONCEPT':
      return 'Concept retention naturally declines over time. A targeted practice session will reinforce your comprehension and build long-term mastery.';
    
    case 'REVIEW_CONCEPT':
      return 'Evidence suggests developing understanding for this concept. Reviewing the core materials will help turn partial comprehension into proficiency.';
    
    case 'CONTINUE_CURRENT_LESSON':
      return 'You are making steady progress in your enrolled curriculum. Continuing with the next lesson builds momentum toward your learning goals.';
    
    case 'ADVANCE_TO_NEXT_LESSON':
      return 'You have demonstrated strong proficiency across all required course concepts. You are ready to advance to higher-level modules.';
    
    case 'SEEK_INSTRUCTOR_SUPPORT':
      return 'Multiple learning signals suggest that connecting with your instructor or joining a study group will provide helpful guidance.';
    
    default:
      return action.reason || 'Recommended based on your current learning progress.';
  }
}
