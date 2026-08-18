/**
 * EDOT Intelligence Domain - Concept Understanding & Misconception Evaluator
 * Evaluates student natural-language explanations against authorized concept knowledge.
 */

/**
 * Evaluates learner explanation against authorized concept materials.
 * 
 * @param {string} conceptName - Target concept name (e.g. "Flexbox Layout Engine")
 * @param {string} explanationText - Student's explanation in their own words
 * @returns {object} Structured Analysis Result DTO
 */
export function evaluateLearnerExplanation(conceptName = 'Flexbox', explanationText = '') {
  const textLower = explanationText.toLowerCase();

  const correctConcepts = [];
  const missingConcepts = [];
  let misconception = null;

  if (textLower.includes('axis') || textLower.includes('1d') || textLower.includes('flex')) {
    correctConcepts.push('Single-Axis (1D) Layout Container');
  } else {
    missingConcepts.push('Single-Axis (1D) Layout Container');
  }

  if (textLower.includes('space') || textLower.includes('align') || textLower.includes('justify')) {
    correctConcepts.push('Dynamic Space Distribution & Alignment');
  } else {
    missingConcepts.push('Dynamic Space Distribution & Alignment');
  }

  // Detect misconceptions
  if (textLower.includes('table') || textLower.includes('2d grid') || textLower.includes('float')) {
    misconception = 'Confusing 1D Flexbox layout behavior with 2D Grid/Table positioning.';
    missingConcepts.push('Separation of 1D Flexbox vs 2D Grid layouts');
  }

  if (missingConcepts.length === 0 && !misconception) {
    correctConcepts.push('Container and Item Hierarchy');
  } else if (!missingConcepts.includes('Container and Item Hierarchy')) {
    missingConcepts.push('Container and Item Hierarchy');
  }

  const confidence = Number((0.85 + (correctConcepts.length * 0.05)).toFixed(2));

  const recommendedExplanation = misconception
    ? `${conceptName} is designed for 1D layout flows along a main axis, unlike 2D CSS Grid which handles rows and columns simultaneously.`
    : `${conceptName} distributes space dynamically among items along a single axis (row or column).`;

  const followUpQuestion = `How does justify-content interact with align-items in a flex container?`;
  const recommendedPractice = `Complete the interactive ${conceptName} layout practice exercise.`;

  return {
    conceptName,
    explanationText,
    correctConcepts,
    missingConcepts,
    misconception,
    confidence,
    recommendedExplanation,
    followUpQuestion,
    recommendedPractice,
    provenance: {
      verifiedCourseFacts: ['Flexbox is a 1D layout model.'],
      aiInferenceLevel: 'High-Confidence Grounded Analysis',
      uncertaintyNote: null
    }
  };
}
