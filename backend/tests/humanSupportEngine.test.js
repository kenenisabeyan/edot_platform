/**
 * Test Suite - EDOT Human + AI Support Engine
 * Verifies escalation trigger evaluation, user privacy consent prompts, ticket creation,
 * instructor ticket views, and resolution.
 */

import { evaluateEscalationTriggers } from '../src/intelligence/support/supportEscalator.js';
import { createHumanSupportTicket, getInstructorSupportTickets, resolveSupportTicket } from '../src/intelligence/support/supportService.js';
import { prisma } from '../lib/prisma.js';

async function runHumanSupportTestSuite() {
  console.log('🧪 Starting EDOT Human + AI Support Engine Test Suite...\n');

  try {
    // 1. Escalation Trigger Evaluator Unit Test
    console.log('--- 1. Testing Escalation Triggers & Privacy Consent Prompts ---');
    const recommendation = evaluateEscalationTriggers({
      failedAttempts: 3,
      aiConfidence: 0.55
    });

    console.log('Escalation Recommendation Output:', JSON.stringify(recommendation, null, 2));

    if (recommendation.shouldEscalate && recommendation.privacyConsentPrompt && recommendation.userConsentRequired) {
      console.log('✅ Escalation trigger evaluation & privacy prompt PASSED');
    } else {
      throw new Error('Escalation evaluator test failed');
    }

    // 2. Integration Test: Consent-Based Ticket Creation
    console.log('\n--- 2. Testing Consent-Based Ticket Creation ---');
    const testStudent = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const ticket = await createHumanSupportTicket(testStudent.id, {
      triggerReason: 'REPEATED_FAILURE',
      userConsentGiven: true,
      sharedContextSummary: {
        courseTitle: 'CSS Flexbox & Grid',
        progressPct: 35,
        errorTopics: ['Grid template areas']
      }
    });

    console.log(`Created Human Support Ticket [ID: ${ticket.ticketId}], Status: ${ticket.status}`);

    if (ticket.ticketId && ticket.userConsentGiven === true) {
      console.log('✅ Consent-based ticket creation PASSED');
    } else {
      throw new Error('Ticket creation test failed');
    }

    // 3. Instructor Ticket View & Resolution Test
    console.log('\n--- 3. Testing Instructor Ticket View & Resolution ---');
    const instructor = await prisma.user.findFirst({ where: { role: 'instructor' } }) || testStudent;

    const tickets = await getInstructorSupportTickets(instructor.id);
    console.log(`Retrieved ${tickets.length} support tickets for instructor ${instructor.id}.`);

    const resolved = await resolveSupportTicket(ticket.ticketId, instructor.id, 'Provided 1-on-1 explanation of grid template areas.');
    console.log('Ticket Resolution Output:', JSON.stringify(resolved, null, 2));

    if (resolved.status === 'RESOLVED' && resolved.ticketId === ticket.ticketId) {
      console.log('✅ Instructor ticket resolution PASSED');
    } else {
      throw new Error('Ticket resolution test failed');
    }

    console.log('\n🎉 ALL HUMAN + AI SUPPORT ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runHumanSupportTestSuite();
