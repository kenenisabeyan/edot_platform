/**
 * EDOT Intelligence Domain - Project Evidence Engine
 * Creates traceable ProjectEvidence ledger records and flows evidence into Phase 12 Skill Evidence.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './projectAuthorizationService.js';

/**
 * Creates a traceable ProjectEvidence ledger record.
 */
export async function recordProjectEvidence(studentId, {
  projectId,
  submissionId = null,
  skillId = null,
  knowledgeNodeId = null,
  sourceType,
  sourceEntityId = null,
  confidence = 0.8,
  evidenceStrength = 'DEVELOPING',
  metadata = null
}) {
  assertValidUUID(studentId, 'studentId');
  assertValidUUID(projectId, 'projectId');
  if (submissionId) assertValidUUID(submissionId, 'submissionId');

  const evidence = await prisma.projectEvidence.create({
    data: {
      studentId,
      projectId,
      submissionId,
      skillId,
      knowledgeNodeId,
      sourceType,
      sourceEntityId,
      confidence,
      evidenceStrength,
      metadata
    }
  });

  // Flow evidence into Phase 12 LearnerSkill and SkillEvidence if skillId or demonstrated skills exist
  if (skillId) {
    let profile = await prisma.learnerProfile.findUnique({ where: { userId: studentId } });
    if (!profile) {
      profile = await prisma.learnerProfile.create({ data: { userId: studentId } });
    }

    const learnerSkill = await prisma.learnerSkill.findFirst({
      where: { profileId: profile.id, id: skillId }
    });

    if (learnerSkill) {
      await prisma.skillEvidence.create({
        data: {
          userId: studentId,
          skillId: learnerSkill.id,
          evidenceType: sourceType,
          sourceId: evidence.id,
          title: `Project Evidence (${sourceType})`,
          score: confidence * 100,
          verificationLevel: sourceType === 'INSTRUCTOR_EVALUATION' ? 'HUMAN_VERIFIED' : 'AI_REVIEWED',
          metadata: { projectId, submissionId, evidenceStrength }
        }
      });
    }
  }

  return evidence;
}

/**
 * Retrieves all traceable project evidence records for a student.
 */
export async function getStudentProjectEvidences(studentId) {
  assertValidUUID(studentId, 'studentId');

  return prisma.projectEvidence.findMany({
    where: { studentId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          category: true,
          requiredSkills: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}
