/**
 * EDOT Intelligence Domain - Skill Evidence Ledger & Verifiable Skill Passport Service
 * Records verifiable skill evidence artifacts and issues tamper-evident skill passports.
 */

import { prisma } from '../../../lib/prisma.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Records a verifiable skill evidence artifact (quiz result, assignment, project).
 * 
 * @param {string} userId 
 * @param {string} skillName 
 * @param {object} evidenceData 
 */
export async function recordSkillEvidence(userId, skillName, evidenceData) {
  // Ensure profile exists
  let profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.learnerProfile.create({
      data: {
        userId,
        engagementScore: 50,
        consistencyScore: 50,
        learningMomentum: 50,
        confidenceScore: 50
      }
    });
  }

  // Upsert skill record
  const skill = await prisma.learnerSkill.upsert({
    where: {
      profileId_name: {
        profileId: profile.id,
        name: skillName
      }
    },
    update: {
      evidenceCount: { increment: 1 },
      lastPracticedAt: new Date(),
      masteryScore: evidenceData.score ? Math.min(100, (evidenceData.score * 0.7) + 30) : 75
    },
    create: {
      profileId: profile.id,
      userId,
      name: skillName,
      proficiencyLevel: 'intermediate',
      masteryScore: evidenceData.score ? Math.min(100, (evidenceData.score * 0.7) + 30) : 75,
      evidenceCount: 1,
      lastPracticedAt: new Date()
    }
  });

  // Record verifiable evidence item
  const evidence = await prisma.skillEvidence.create({
    data: {
      skillId: skill.id,
      userId,
      evidenceType: evidenceData.evidenceType || 'QUIZ_PERFORMANCE',
      title: evidenceData.title || `${skillName} Practical Evaluation`,
      sourceId: evidenceData.sourceId || null,
      score: evidenceData.score || 85,
      verificationLevel: evidenceData.verificationLevel || 'AUTOMATED',
      metadata: evidenceData.metadata || {}
    }
  });

  // Update or create SkillPassport DTO
  await syncSkillPassport(userId);

  return { skill, evidence };
}

/**
 * Recalculates and updates overall SkillPassport metrics for a learner.
 * 
 * @param {string} userId 
 */
export async function syncSkillPassport(userId) {
  const skills = await prisma.learnerSkill.findMany({
    where: { userId },
    include: { evidences: true }
  });

  const verifiedSkillCount = skills.filter(s => s.evidenceCount > 0).length;
  const avgMastery = skills.length > 0
    ? skills.reduce((sum, s) => sum + s.masteryScore, 0) / skills.length
    : 70.0;

  const passport = await prisma.skillPassport.upsert({
    where: { userId },
    update: {
      verifiedSkillCount,
      masteryIndex: Number(avgMastery.toFixed(1)),
      updatedAt: new Date()
    },
    create: {
      userId,
      verifiedSkillCount,
      masteryIndex: Number(avgMastery.toFixed(1)),
      shareableUrl: `https://edot.org/verify/passport/${userId}`
    }
  });

  return passport;
}

/**
 * Retrieves the comprehensive Verifiable Skill Passport for a learner.
 * 
 * @param {string} userId 
 */
export async function getLearnerSkillPassport(userId) {
  const passport = await syncSkillPassport(userId);
  const skills = await prisma.learnerSkill.findMany({
    where: { userId },
    include: {
      evidences: {
        orderBy: { verifiedAt: 'desc' },
        take: 5
      }
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, avatar: true }
  });

  return {
    passportId: passport.id,
    passportHash: passport.passportHash,
    learnerName: user?.name || 'Learner',
    masteryIndex: passport.masteryIndex,
    verifiedSkillCount: passport.verifiedSkillCount,
    shareableUrl: `https://edot.org/verify/passport/${passport.passportHash}`,
    issuedAt: passport.issuedAt,
    skills: skills.map(s => ({
      skillId: s.id,
      name: s.name,
      proficiencyLevel: s.proficiencyLevel,
      masteryScore: s.masteryScore,
      evidenceCount: s.evidenceCount,
      evidences: s.evidences.map(e => ({
        id: e.id,
        evidenceType: e.evidenceType,
        title: e.title,
        score: e.score,
        verificationLevel: e.verificationLevel,
        verifiedAt: e.verifiedAt
      }))
    }))
  };
}

/**
 * Public verification lookup by passport hash.
 * 
 * @param {string} passportHash 
 */
export async function verifySkillPassportByHash(passportHash) {
  const passport = await prisma.skillPassport.findFirst({
    where: {
      OR: [
        { passportHash },
        { userId: passportHash }
      ]
    }
  });

  if (!passport) {
    throw new NotFoundError(`Verifiable Skill Passport [${passportHash}] not found or invalid`);
  }

  return getLearnerSkillPassport(passport.userId);
}
