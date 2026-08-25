/**
 * EDOT Intelligence — Phase 12
 * Skill Gap Service
 *
 * Compares a student's current skill evidence profile against the
 * requirements of a target CareerPath and produces an explainable gap analysis.
 *
 * Uses both the legacy JSON `requiredSkills` blob on CareerPath AND the
 * new relational `CareerPathSkillRequirement` model — whichever has data.
 *
 * Output is never a simple score.  It returns STRENGTHS, DEVELOPING areas,
 * and PRIORITY GAPS with traceable evidence for each.
 */

import { prisma } from '../../../lib/prisma.js';
import { computeSkillEvidenceState } from './skillEvidenceEngine.js';

/**
 * Performs an explainable skill gap analysis for a student against a career path.
 *
 * @param {string} userId
 * @param {import('@prisma/client').CareerPath & { skillRequirements: Array }} careerPath
 * @returns {Promise<{
 *   careerPathId: string,
 *   careerTitle: string,
 *   strengths: Array,
 *   developing: Array,
 *   priorityGaps: Array,
 *   evidenceCoverage: { covered: number, total: number },
 *   limitations: string[],
 *   disclaimer: string
 * }>}
 */
export async function analyzeSkillGap(userId, careerPath) {
  // 1. Build required skill list from both sources
  const requiredSkills = buildRequiredSkillList(careerPath);

  if (requiredSkills.length === 0) {
    return {
      careerPathId: careerPath.id,
      careerTitle: careerPath.title,
      strengths: [],
      developing: [],
      priorityGaps: [],
      evidenceCoverage: { covered: 0, total: 0 },
      limitations: ['This career path has no defined skill requirements yet.'],
      disclaimer: DISCLAIMER
    };
  }

  const strengths = [];
  const developing = [];
  const priorityGaps = [];
  const limitations = [];

  // 2. For each required skill, look up student evidence
  for (const req of requiredSkills) {
    // Attempt to find a SkillNode by name (case-insensitive)
    const skillNode = await prisma.skillNode.findFirst({
      where: {
        OR: [
          { name: { equals: req.skillName, mode: 'insensitive' } },
          { code: { equals: req.skillCode || '', mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true }
    });

    let evidenceState = 'NOT_STARTED';
    let confidence = 0;
    let explanation = 'No EDOT evidence found for this skill.';
    let evidenceSources = [];

    if (skillNode) {
      try {
        const ev = await computeSkillEvidenceState(userId, skillNode.id);
        evidenceState = ev.evidenceState;
        confidence = ev.confidence;
        explanation = ev.explanation;
        evidenceSources = ev.sources;
      } catch {
        limitations.push(`Evidence retrieval failed for skill: ${req.skillName}`);
      }
    } else {
      // Try LearnerSkill text match as fallback
      const legacySkill = await prisma.learnerSkill.findFirst({
        where: {
          userId,
          name: { contains: req.skillName, mode: 'insensitive' }
        },
        include: { evidences: { take: 3 } }
      });
      if (legacySkill && legacySkill.masteryScore > 0) {
        if (legacySkill.masteryScore >= 80) evidenceState = 'STRONG_EVIDENCE';
        else if (legacySkill.masteryScore >= 65) evidenceState = 'DEMONSTRATING';
        else if (legacySkill.masteryScore >= 45) evidenceState = 'DEVELOPING';
        else evidenceState = 'EXPLORING';
        confidence = 0.55;
        explanation = `Based on ${legacySkill.evidences.length} evidence record(s) in your EDOT learning history.`;
        evidenceSources = [{ sourceType: 'LEGACY_SKILL_RECORD', masteryScore: legacySkill.masteryScore }];
      } else {
        limitations.push(
          `Skill "${req.skillName}" is not yet in the EDOT skill graph. Evidence could not be verified.`
        );
      }
    }

    const skillResult = {
      skillName: req.skillName,
      importance: req.importance,
      evidenceState,
      confidence,
      explanation,
      evidenceSources,
      skillNodeId: skillNode?.id || null
    };

    // Classify
    if (
      evidenceState === 'STRONG_EVIDENCE' ||
      (evidenceState === 'DEMONSTRATING' &&
        req.importance !== 'FOUNDATIONAL')
    ) {
      strengths.push(skillResult);
    } else if (
      evidenceState === 'DEVELOPING' ||
      evidenceState === 'EXPLORING' ||
      (evidenceState === 'DEMONSTRATING' && req.importance === 'FOUNDATIONAL')
    ) {
      developing.push(skillResult);
    } else {
      // NOT_STARTED or EXPLORING for FOUNDATIONAL → priority gap
      const isPriority =
        req.importance === 'FOUNDATIONAL' || req.importance === 'IMPORTANT';
      if (isPriority) {
        priorityGaps.push(skillResult);
      } else {
        developing.push(skillResult); // OPTIONAL / ADVANCED gaps are developing, not critical
      }
    }
  }

  const covered = strengths.length + developing.length;

  return {
    careerPathId: careerPath.id,
    careerTitle: careerPath.title,
    category: careerPath.category,
    industry: careerPath.industry || null,
    strengths,
    developing,
    priorityGaps,
    evidenceCoverage: {
      covered,
      total: requiredSkills.length,
      coveredPercentage: Math.round((covered / requiredSkills.length) * 100)
    },
    limitations,
    disclaimer: DISCLAIMER
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes both the legacy JSON `requiredSkills` blob AND the new
 * relational `skillRequirements` records into a single consistent list.
 *
 * @param {object} careerPath
 * @returns {Array<{ skillName: string, skillCode: string|null, importance: string }>}
 */
function buildRequiredSkillList(careerPath) {
  const seen = new Set();
  const result = [];

  // New relational source (priority)
  if (Array.isArray(careerPath.skillRequirements)) {
    for (const req of careerPath.skillRequirements) {
      const key = req.skillName.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          skillName: req.skillName,
          skillCode: null,
          importance: req.importance || 'IMPORTANT'
        });
      }
    }
  }

  // Legacy JSON blob (fallback for paths created before Phase 12)
  const jsonSkills = Array.isArray(careerPath.requiredSkills)
    ? careerPath.requiredSkills
    : [];
  for (const js of jsonSkills) {
    if (!js || !js.name) continue;
    const key = js.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        skillName: js.name,
        skillCode: null,
        importance: importanceFromMinMastery(js.minMastery)
      });
    }
  }

  return result;
}

/**
 * Maps a legacy minMastery numeric value to an importance label.
 */
function importanceFromMinMastery(minMastery) {
  if (!minMastery) return 'IMPORTANT';
  if (minMastery >= 85) return 'FOUNDATIONAL';
  if (minMastery >= 75) return 'IMPORTANT';
  if (minMastery >= 60) return 'ADVANCED';
  return 'OPTIONAL';
}

const DISCLAIMER =
  'Skill gap analysis is based on your current EDOT learning evidence only. ' +
  'It does not constitute professional assessment or employment qualification. ' +
  'Evidence states may change as you continue learning.';
