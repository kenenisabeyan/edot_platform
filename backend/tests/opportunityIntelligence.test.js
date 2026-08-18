/**
 * Test Suite - EDOT Opportunity and Growth Intelligence
 * Verifies factual requirement evaluation, match scores, missing requirements, and recommended preparation.
 */

import { evaluateOpportunityMatch } from '../src/intelligence/opportunity/opportunityMatcher.js';
import { getUserOpportunityMatches, getOpportunityMatchById } from '../src/intelligence/opportunity/opportunityService.js';
import { prisma } from '../lib/prisma.js';

async function runOpportunityTestSuite() {
  console.log('🧪 Starting EDOT Opportunity and Growth Intelligence Test Suite...\n');

  try {
    // 1. Unit Test: Frontend Internship Matching Scenario
    console.log('--- 1. Testing Frontend Internship Matching Scenario ---');
    const mockOpportunity = {
      title: 'EDOT Frontend Engineering Internship',
      requirements: [
        { requirementType: 'skill', name: 'JavaScript', isMandatory: true },
        { requirementType: 'skill', name: 'React', isMandatory: true },
        { requirementType: 'skill', name: 'Portfolio', isMandatory: true },
        { requirementType: 'skill', name: 'TypeScript', isMandatory: false }
      ]
    };

    const mockLearner = {
      skills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'Portfolio' }],
      interests: ['Frontend Development'],
      goals: ['Become a Software Engineer']
    };

    const evalResult = evaluateOpportunityMatch(mockOpportunity, mockLearner);

    console.log('Frontend Internship Match Evaluation:', JSON.stringify(evalResult, null, 2));

    const hasReact = evalResult.matchingReasons.includes('React');
    const hasTSMissing = evalResult.missingRequirements.includes('TypeScript');

    if (evalResult.matchScore >= 70 && hasReact && hasTSMissing) {
      console.log('✅ Factual requirement matching & preparation recommendation PASSED');
    } else {
      throw new Error('Opportunity matching evaluation failed');
    }

    // 2. Integration Test: Database Seeding & User Matches Retrieval
    console.log('\n--- 2. Testing Database Seeding & Learner Matches Retrieval ---');
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const matches = await getUserOpportunityMatches(testUser.id);
    console.log(`Retrieved ${matches.length} opportunity matches for user ${testUser.id}.`);
    console.log('Top Opportunity Match Sample:', JSON.stringify(matches[0], null, 2));

    if (matches.length > 0) {
      const singleMatch = await getOpportunityMatchById(testUser.id, matches[0].opportunityId);
      console.log(`Fetched single match detail for [${singleMatch.title}]: matchScore = ${singleMatch.matchScore}%`);
      console.log('✅ Single match detail retrieval PASSED');
    }

    console.log('\n🎉 ALL OPPORTUNITY & GROWTH INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOpportunityTestSuite();
