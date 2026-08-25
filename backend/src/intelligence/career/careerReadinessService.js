/**
 * EDOT Intelligence — Phase 12
 * Career Readiness Service
 *
 * Computes evidence-based readiness categories for a student targeting a
 * specific career path.
 *
 * CRITICAL: This system NEVER says "You are 82% ready to become a Software Engineer."
 * It uses evidence CATEGORIES, not deterministic percentages.
 *
 * Readiness Categories:
 *   INSUFFICIENT_EVIDENCE   — not enough EDOT evidence to assess
 *   FOUNDATIONAL_READINESS  — foundational skills show developing evidence
 *   DEVELOPING_READINESS    — multiple skills developing, some gaps remain
 *   EXPANDING_EVIDENCE      — broad evidence across required skill areas
 *
 * The system NEVER claims a student IS ready for a career.
 * It describes current evidence strength.
 */

import { analyzeSkillGap } from './skillGapService.js';

/**
 * Computes career readiness evidence categories for a student.
 *
 * @param {string} userId
 * @param {object} careerPath  — resolved CareerPath with skillRequirements
 * @returns {Promise<{
 *   careerPathId: string,
 *   careerTitle: string,
 *   readinessCategory: string,
 *   currentSkillEvidence: object,
 *   strengths: Array,
 *   gaps: Array,
 *   evidenceCoverage: object,
 *   limitations: string[],
 *   nextSteps: string[],
 *   disclaimer: string
 * }>}
 */
export async function computeCareerReadiness(userId, careerPath) {
  const gapAnalysis = await analyzeSkillGap(userId, careerPath);

  const { strengths, developing, priorityGaps, evidenceCoverage } = gapAnalysis;

  const totalRequired = evidenceCoverage.total;
  const totalCovered = evidenceCoverage.covered;

  // ── Readiness Category Logic ──────────────────────────────────────────────

  let readinessCategory;

  if (totalRequired === 0) {
    readinessCategory = 'INSUFFICIENT_EVIDENCE';
  } else if (strengths.length === 0 && developing.length === 0) {
    readinessCategory = 'INSUFFICIENT_EVIDENCE';
  } else {
    const foundationalRequired = (careerPath.skillRequirements || []).filter(
      r => r.importance === 'FOUNDATIONAL'
    );
    const foundationalCovered = strengths.filter(s =>
      foundationalRequired.some(
        fr => fr.skillName.toLowerCase() === s.skillName.toLowerCase()
      )
    ).length;

    const coverageRatio = totalCovered / totalRequired;
    const strengthRatio = strengths.length / Math.max(totalRequired, 1);

    if (coverageRatio >= 0.70 && strengthRatio >= 0.50) {
      readinessCategory = 'EXPANDING_EVIDENCE';
    } else if (
      coverageRatio >= 0.40 ||
      (foundationalRequired.length > 0 && foundationalCovered >= 1)
    ) {
      readinessCategory = 'DEVELOPING_READINESS';
    } else {
      readinessCategory = 'FOUNDATIONAL_READINESS';
    }
  }

  // ── Build Next Steps ──────────────────────────────────────────────────────

  const nextSteps = [];

  if (priorityGaps.length > 0) {
    const topGap = priorityGaps[0];
    nextSteps.push(
      `Consider exploring courses related to "${topGap.skillName}" — this may help develop foundational evidence.`
    );
  }

  if (developing.length > 0) {
    const topDeveloping = developing[0];
    nextSteps.push(
      `Your evidence for "${topDeveloping.skillName}" is developing. Continued practice and assessment may strengthen it.`
    );
  }

  if (strengths.length > 0) {
    nextSteps.push(
      `You currently show your strongest evidence in: ${strengths
        .slice(0, 3)
        .map(s => s.skillName)
        .join(', ')}.`
    );
  }

  if (readinessCategory === 'INSUFFICIENT_EVIDENCE') {
    nextSteps.push(
      'Begin by exploring courses in this domain to start building learning evidence.'
    );
  }

  // ── Readiness Category Label ──────────────────────────────────────────────

  const categoryDescriptions = {
    INSUFFICIENT_EVIDENCE:
      'Your current EDOT learning profile does not yet have enough evidence to evaluate readiness for this career path.',
    FOUNDATIONAL_READINESS:
      'Based on your current learning evidence, you are beginning to develop evidence in foundational areas for this career path.',
    DEVELOPING_READINESS:
      'Your current profile shows developing evidence across several skills relevant to this career path. Continued learning may strengthen these areas.',
    EXPANDING_EVIDENCE:
      'Your current learning profile shows expanding evidence across multiple skill areas relevant to this career path. You may want to explore related opportunities while continuing to develop.'
  };

  return {
    careerPathId: careerPath.id,
    careerTitle: careerPath.title,
    category: careerPath.category,
    readinessCategory,
    readinessCategoryDescription: categoryDescriptions[readinessCategory],
    currentSkillEvidence: {
      strongEvidenceCount: strengths.length,
      developingCount: developing.length,
      gapCount: priorityGaps.length
    },
    strengths: strengths.map(s => ({
      skillName: s.skillName,
      evidenceState: s.evidenceState,
      explanation: s.explanation
    })),
    gaps: priorityGaps.map(g => ({
      skillName: g.skillName,
      importance: g.importance,
      explanation: g.explanation
    })),
    developing: developing.map(d => ({
      skillName: d.skillName,
      evidenceState: d.evidenceState,
      explanation: d.explanation
    })),
    evidenceCoverage,
    limitations: gapAnalysis.limitations,
    nextSteps,
    disclaimer:
      'Readiness categories reflect EDOT learning evidence only. This is NOT a qualification assessment, employment recommendation, or guarantee of success in this career path. Student choice and individual circumstances are primary factors in any career decision.'
  };
}
