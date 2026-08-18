/**
 * Test Suite - EDOT Verifiable Skill Passport Share Kit & LinkedIn 1-Click Embeds
 * Verifies LinkedIn Add-to-Profile URL generation, embeddable badge HTML/Markdown snippets,
 * and JSON-LD credential schema.
 */

import { generatePassportShareKit, getLearnerSkillPassport } from '../src/intelligence/passport/passportService.js';
import { prisma } from '../lib/prisma.js';

async function runSkillPassportShareTestSuite() {
  console.log('🧪 Starting EDOT Verifiable Skill Passport Share Kit Test Suite...\n');

  try {
    // 1. Unit Test: Share Kit Generation
    console.log('--- 1. Testing Share Kit URL & Snippet Generation ---');
    const shareKit = generatePassportShareKit('Kenenisa Beyan', 'edot-pass-998877665544', 88.5, 6);

    console.log('Generated Share Kit:', JSON.stringify(shareKit, null, 2));

    if (
      shareKit.linkedIn.addToProfileUrl.includes('linkedin.com/profile/add') &&
      shareKit.linkedIn.addToProfileUrl.includes('edot-pass-998877665544') &&
      shareKit.embeds.html.includes('edot-verified-passport-badge') &&
      shareKit.embeds.markdown.includes('shields.io/badge') &&
      shareKit.jsonLd['@type'] === 'EducationalOccupationalCredential'
    ) {
      console.log('✅ Share Kit URL & Snippet Generation PASSED');
    } else {
      throw new Error('Share Kit generation failed');
    }

    // 2. Integration Test: Retrieve Learner Passport with Share Kit
    console.log('\n--- 2. Testing Learner Passport with Embedded Share Kit ---');
    const testStudent = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const passport = await getLearnerSkillPassport(testStudent.id);
    console.log('Retrieved Passport Learner:', passport.learnerName);
    console.log('Passport ShareKit Verification URL:', passport.shareKit?.verificationUrl);

    if (passport.shareKit && passport.shareKit.linkedIn && passport.shareKit.embeds) {
      console.log('✅ Learner Passport Embedded Share Kit PASSED');
    } else {
      throw new Error('Embedded Share Kit test failed');
    }

    console.log('\n🎉 ALL SKILL PASSPORT SHARE KIT TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSkillPassportShareTestSuite();
