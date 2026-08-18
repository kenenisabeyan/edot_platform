/**
 * Test Suite - EDOT Skill Evidence Ledger & Verifiable Skill Passport
 * Verifies evidence artifact recording, mastery index calculation, and public proof lookup.
 */

import { recordSkillEvidence, getLearnerSkillPassport, verifySkillPassportByHash } from '../src/intelligence/passport/passportService.js';
import { prisma } from '../lib/prisma.js';

async function runSkillPassportTestSuite() {
  console.log('🧪 Starting EDOT Skill Passport & Evidence Ledger Test Suite...\n');

  try {
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    // 1. Record Verifiable Evidence Item
    console.log('--- 1. Testing Skill Evidence Artifact Ingestion ---');
    const evidenceResult = await recordSkillEvidence(testUser.id, 'React Architecture', {
      evidenceType: 'QUIZ_PERFORMANCE',
      title: 'Advanced React Hooks & Context Assessment',
      score: 92,
      verificationLevel: 'AUTOMATED',
      metadata: { quizId: 'quiz-react-99' }
    });

    console.log('Ingested Evidence Output:', JSON.stringify(evidenceResult.evidence, null, 2));

    if (evidenceResult.evidence.id && evidenceResult.skill.name === 'React Architecture') {
      console.log('✅ Skill evidence artifact ingestion PASSED');
    } else {
      throw new Error('Skill evidence artifact ingestion failed');
    }

    // 2. Fetch Learner Skill Passport DTO
    console.log('\n--- 2. Testing Learner Skill Passport Generation ---');
    const passport = await getLearnerSkillPassport(testUser.id);

    console.log('Skill Passport Output:', JSON.stringify(passport, null, 2));

    if (passport.passportHash && passport.verifiedSkillCount >= 1 && passport.masteryIndex > 0) {
      console.log('✅ Skill Passport generation & mastery index calculation PASSED');
    } else {
      throw new Error('Skill Passport generation failed');
    }

    // 3. Public Verification Lookup by Hash
    console.log('\n--- 3. Testing Public Verification Lookup by Passport Hash ---');
    const verifiedData = await verifySkillPassportByHash(passport.passportHash);
    console.log(`Verified Passport Owner: ${verifiedData.learnerName}, Mastery Index: ${verifiedData.masteryIndex}`);

    if (verifiedData.passportHash === passport.passportHash) {
      console.log('✅ Public Skill Passport verification lookup PASSED');
    } else {
      throw new Error('Public Skill Passport verification failed');
    }

    console.log('\n🎉 ALL SKILL PASSPORT & EVIDENCE LEDGER TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSkillPassportTestSuite();
