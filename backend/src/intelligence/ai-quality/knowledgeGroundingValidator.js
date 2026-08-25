/**
 * EDOT Intelligence Domain - Knowledge Grounding & Hallucination Risk Evaluator
 * Evaluates whether generated responses are grounded in authorized Phase 8 knowledge.
 * Classifies hallucination risk into LOW_RISK, MODERATE_RISK, HIGH_RISK, or INSUFFICIENT_EVIDENCE.
 */

export const HALLUCINATION_RISKS = {
  LOW_RISK: 'LOW_RISK',
  MODERATE_RISK: 'MODERATE_RISK',
  HIGH_RISK: 'HIGH_RISK',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
};

/**
 * Evaluates knowledge grounding score and hallucination risk for an AI response.
 */
export function evaluateKnowledgeGrounding(prompt, response, retrievedKnowledge = []) {
  if (!retrievedKnowledge || retrievedKnowledge.length === 0) {
    // Check if the prompt requires course-specific knowledge
    const isCourseSpecific = /lesson|quiz|course|assignment|module/i.test(prompt);
    if (isCourseSpecific) {
      return {
        groundednessScore: 0.2,
        hallucinationRisk: HALLUCINATION_RISKS.INSUFFICIENT_EVIDENCE,
        isGrounded: false,
        fallbackMessage: 'I don\'t have enough verified course information to explain that confidently. I can help you review the lesson, or you can ask your instructor.'
      };
    }
    return {
      groundednessScore: 0.8,
      hallucinationRisk: HALLUCINATION_RISKS.LOW_RISK,
      isGrounded: true,
      fallbackMessage: null
    };
  }

  // Calculate matching overlap between response and retrieved knowledge
  const combinedKnowledgeText = retrievedKnowledge.map(k => (k.content || k.title || '')).join(' ').toLowerCase();
  const words = response.toLowerCase().split(/\s+/).filter(w => w.length > 4);

  let matchCount = 0;
  for (const word of words) {
    if (combinedKnowledgeText.includes(word)) {
      matchCount++;
    }
  }

  const overlapRatio = words.length > 0 ? matchCount / words.length : 1.0;
  let groundednessScore = Math.min(1.0, Math.max(0.0, Math.round((0.5 + overlapRatio * 0.5) * 100) / 100));
  let hallucinationRisk = HALLUCINATION_RISKS.LOW_RISK;

  if (groundednessScore < 0.4) {
    hallucinationRisk = HALLUCINATION_RISKS.HIGH_RISK;
  } else if (groundednessScore < 0.7) {
    hallucinationRisk = HALLUCINATION_RISKS.MODERATE_RISK;
  }

  return {
    groundednessScore,
    hallucinationRisk,
    isGrounded: groundednessScore >= 0.5,
    fallbackMessage: groundednessScore < 0.4
      ? 'I don\'t have enough verified course information to explain that confidently. I can help you review the lesson, or you can ask your instructor.'
      : null
  };
}
