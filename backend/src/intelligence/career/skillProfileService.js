/**
 * EDOT Intelligence — Phase 12
 * Student Skill Profile Service
 *
 * Builds and returns a dynamic, evidence-aggregated skill profile for a student.
 *
 * The profile is computed from the SkillNode graph intersected with all
 * available skill evidence — it does not invent skills.
 *
 * Profile is returned fresh on every request (no stale caching that misses
 * updates from new courses, lessons, or assessments).
 */

import { prisma } from '../../../lib/prisma.js';
import { computeSkillEvidenceState } from './skillEvidenceEngine.js';

/**
 * Builds the full dynamic skill profile for a student.
 *
 * The profile covers ALL SkillNodes that have either:
 * - A CourseSkillMapping for a course the student is enrolled in, OR
 * - A KnowledgeNodeSkillMapping linked to a KnowledgeNode with mastery evidence
 *
 * For each such SkillNode the evidence engine computes an evidence state.
 * Skills with NO evidence are included with state NOT_STARTED if the skill
 * is in a course the student is enrolled in (so gap analysis works correctly).
 *
 * @param {string} userId
 * @returns {Promise<{
 *   userId: string,
 *   generatedAt: Date,
 *   totalSkills: number,
 *   skills: Array,
 *   summary: {
 *     strongEvidence: number,
 *     demonstrating: number,
 *     developing: number,
 *     exploring: number,
 *     notStarted: number
 *   },
 *   disclaimer: string
 * }>}
 */
export async function getStudentSkillProfile(userId) {
  // 1. Find courses the student is enrolled in
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: userId, status: 'active' },
    select: { courseId: true }
  });
  const enrolledCourseIds = enrollments.map(e => e.courseId);

  // 2. Find SkillNodes linked to enrolled courses
  const courseSkillLinks = enrolledCourseIds.length > 0
    ? await prisma.courseSkillMapping.findMany({
        where: { courseId: { in: enrolledCourseIds } },
        select: { skillId: true },
        distinct: ['skillId']
      })
    : [];
  const courseSkillIds = new Set(courseSkillLinks.map(m => m.skillId));

  // 3. Find SkillNodes linked to knowledge nodes where student has mastery evidence
  const masteredNodeIds = await prisma.learnerConceptMastery.findMany({
    where: {
      userId,
      masteryState: { notIn: ['UNKNOWN'] }
    },
    select: { nodeId: true }
  });
  const masteryNodeIds = masteredNodeIds.map(m => m.nodeId);

  let knowledgeSkillIds = new Set();
  if (masteryNodeIds.length > 0) {
    const knowledgeMappings = await prisma.knowledgeNodeSkillMapping.findMany({
      where: { knowledgeNodeId: { in: masteryNodeIds } },
      select: { skillNodeId: true },
      distinct: ['skillNodeId']
    });
    knowledgeSkillIds = new Set(knowledgeMappings.map(m => m.skillNodeId));
  }

  // 4. Also include SkillNodes from LearnerSkill (legacy path)
  const legacySkills = await prisma.learnerSkill.findMany({
    where: { userId },
    include: { evidences: { take: 3 } }
  });

  // 5. Combine all SkillNode IDs to evaluate
  const allSkillIds = new Set([...courseSkillIds, ...knowledgeSkillIds]);

  // 6. Compute evidence state for each SkillNode
  const skillProfiles = [];

  for (const skillId of allSkillIds) {
    try {
      const evidence = await computeSkillEvidenceState(userId, skillId);
      const skillNode = await prisma.skillNode.findUnique({
        where: { id: skillId },
        select: { id: true, name: true, code: true, domain: true, category: true, level: true }
      });
      if (!skillNode) continue;

      skillProfiles.push({
        skillNodeId: skillNode.id,
        code: skillNode.code,
        name: skillNode.name,
        domain: skillNode.domain,
        category: skillNode.category,
        level: skillNode.level,
        evidenceState: evidence.evidenceState,
        confidence: evidence.confidence,
        evidenceCount: evidence.evidenceCount,
        explanation: evidence.explanation,
        sources: evidence.sources,
        lastUpdated: new Date()
      });
    } catch {
      // Failure isolation: skip this skill, don't crash profile generation
    }
  }

  // 7. Add legacy skills not already in the SkillNode graph
  for (const ls of legacySkills) {
    const alreadyIncluded = skillProfiles.some(
      sp => sp.name.toLowerCase() === ls.name.toLowerCase()
    );
    if (!alreadyIncluded) {
      const state =
        ls.masteryScore >= 80
          ? 'STRONG_EVIDENCE'
          : ls.masteryScore >= 65
          ? 'DEMONSTRATING'
          : ls.masteryScore >= 45
          ? 'DEVELOPING'
          : ls.masteryScore >= 15
          ? 'EXPLORING'
          : 'NOT_STARTED';

      skillProfiles.push({
        skillNodeId: null,
        code: null,
        name: ls.name,
        domain: ls.category || 'General',
        category: ls.category || null,
        level: ls.proficiencyLevel || 'beginner',
        evidenceState: state,
        confidence: ls.masteryScore > 0 ? 0.6 : 0.3,
        evidenceCount: ls.evidences.length,
        explanation: `Based on ${ls.evidences.length} evidence record(s) in your EDOT learning history.`,
        sources: [{ sourceType: 'LEGACY_SKILL_RECORD', masteryScore: ls.masteryScore }],
        lastUpdated: ls.updatedAt
      });
    }
  }

  // 8. Sort by evidence strength
  const STATE_ORDER = {
    STRONG_EVIDENCE: 5,
    DEMONSTRATING: 4,
    DEVELOPING: 3,
    EXPLORING: 2,
    NOT_STARTED: 1
  };
  skillProfiles.sort(
    (a, b) => (STATE_ORDER[b.evidenceState] || 0) - (STATE_ORDER[a.evidenceState] || 0)
  );

  // 9. Build summary
  const summary = {
    strongEvidence: skillProfiles.filter(s => s.evidenceState === 'STRONG_EVIDENCE').length,
    demonstrating: skillProfiles.filter(s => s.evidenceState === 'DEMONSTRATING').length,
    developing: skillProfiles.filter(s => s.evidenceState === 'DEVELOPING').length,
    exploring: skillProfiles.filter(s => s.evidenceState === 'EXPLORING').length,
    notStarted: skillProfiles.filter(s => s.evidenceState === 'NOT_STARTED').length
  };

  return {
    userId,
    generatedAt: new Date(),
    totalSkills: skillProfiles.length,
    skills: skillProfiles,
    summary,
    disclaimer:
      'This skill profile reflects your EDOT learning evidence only. Evidence states are not professional qualifications or employment assessments.'
  };
}

/**
 * Gets the evidence detail for a single skill for a specific student.
 *
 * @param {string} userId
 * @param {string} skillNodeId
 */
export async function getStudentSkillDetail(userId, skillNodeId) {
  // Fetch SkillNode
  const skillNode = await prisma.skillNode.findUnique({
    where: { id: skillNodeId },
    include: {
      knowledgeNodeMappings: {
        include: {
          knowledgeNode: {
            select: { id: true, name: true, type: true }
          }
        }
      },
      courseMappings: {
        include: {
          course: { select: { id: true, title: true } }
        }
      }
    }
  });

  if (!skillNode) {
    return null;
  }

  const evidence = await computeSkillEvidenceState(userId, skillNodeId);

  // Legacy skill evidence records
  const legacySkill = await prisma.learnerSkill.findFirst({
    where: {
      userId,
      name: { contains: skillNode.name, mode: 'insensitive' }
    },
    include: {
      evidences: {
        orderBy: { verifiedAt: 'desc' },
        take: 10
      }
    }
  });

  return {
    skillNodeId: skillNode.id,
    code: skillNode.code,
    name: skillNode.name,
    domain: skillNode.domain,
    category: skillNode.category,
    level: skillNode.level,
    description: skillNode.description,
    evidenceState: evidence.evidenceState,
    confidence: evidence.confidence,
    explanation: evidence.explanation,
    sources: evidence.sources,
    relatedKnowledgeNodes: skillNode.knowledgeNodeMappings.map(m => ({
      nodeId: m.knowledgeNode.id,
      name: m.knowledgeNode.name,
      type: m.knowledgeNode.type,
      evidenceWeight: m.evidenceWeight
    })),
    relatedCourses: skillNode.courseMappings.map(m => ({
      courseId: m.course.id,
      title: m.course.title
    })),
    evidenceRecords: legacySkill?.evidences.map(e => ({
      evidenceType: e.evidenceType,
      title: e.title,
      score: e.score,
      verificationLevel: e.verificationLevel,
      verifiedAt: e.verifiedAt
    })) || [],
    disclaimer:
      'Evidence state reflects your EDOT learning data. It is not a professional skill certification.'
  };
}
