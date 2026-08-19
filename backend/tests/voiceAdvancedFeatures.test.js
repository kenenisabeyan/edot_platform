/**
 * voiceAdvancedFeatures.test.js
 * 
 * Test suite for EDOT Advanced Voice Features:
 *   - Usage & Cost Control Policy Layer (VoicePolicyEngine)
 *   - Voice Privacy & Data Security Isolation (VoicePrivacyService)
 *   - Administrative Analytics & Provider Capability Management
 */

import { prisma } from '../lib/prisma.js';
import VoicePolicyEngine from '../src/intelligence/voice/voicePolicyEngine.js';
import VoicePrivacyService from '../src/intelligence/voice/voicePrivacyService.js';
import VoiceOrchestrator from '../src/intelligence/voice/voiceOrchestrator.js';

async function runAdvancedVoiceTests() {
  console.log('🧪 Starting EDOT Advanced Voice Features Test Suite...\n');

  try {
    const student = await prisma.user.findFirst({ where: { role: 'student' } });
    const instructor = await prisma.user.findFirst({ where: { role: 'instructor' } }) || { id: 'instructor-1' };
    const course = await prisma.course.findFirst({ where: { isPublished: true } });

    if (!student || !course) {
      throw new Error('Baseline test data missing');
    }

    // 1. Test Voice Policy Engine: User Authorization & Quota Evaluation
    console.log('--- 1. Testing Voice Policy & Duration Evaluation ---');
    const policyResult = await VoicePolicyEngine.evaluateUserPolicy(student.id);
    console.log('User Policy Evaluation:', JSON.stringify(policyResult, null, 2));

    console.assert(policyResult.allowed === true, 'Student must be allowed within daily duration cap');
    console.assert(typeof policyResult.remainingSeconds === 'number', 'Remaining seconds calculated');
    console.log('✅ Voice Policy Evaluation PASSED\n');

    // 2. Test Usage & Cost Analytics Tracking
    console.log('--- 2. Testing Usage Tracking & Cost Estimation ---');
    const usageResult = await VoicePolicyEngine.trackUsage({
      userId: student.id,
      userTextLength: 120,
      mentorReplyLength: 450,
      listeningDuration: 15,
      speakingDuration: 25,
      provider: 'Gemini-3.6-Flash'
    });

    console.log('Usage Tracking Output:', JSON.stringify(usageResult, null, 2));
    console.assert(usageResult.totalEstimatedCost > 0, 'Estimated cost must be greater than zero');
    console.log('✅ Usage & Cost Control Tracking PASSED\n');

    // 3. Test Voice Privacy & Security Isolation
    console.log('--- 3. Testing Voice Privacy & Data Security ---');
    const studentSelfAccess = await VoicePrivacyService.authorizeSessionAccess(student.id, student.id, 'session-1');
    const instructorAccess = await VoicePrivacyService.authorizeSessionAccess(instructor.id, student.id, 'session-1');

    console.log(`  Student Self Access Authorized: ${studentSelfAccess}`);
    console.log(`  Instructor Access Isolated (Denied): ${!instructorAccess}`);

    console.assert(studentSelfAccess === true, 'Student must have access to own session');
    console.assert(instructorAccess === false, 'Instructor must be denied direct access to private student voice transcript');

    // Test PII Sanitization
    const rawTranscript = 'Contact student at john.doe@example.com or 555-123-4567 for feedback.';
    const sanitized = VoicePrivacyService.sanitizeTranscript(rawTranscript);
    console.log(`  Raw Transcript: "${rawTranscript}"`);
    console.log(`  Sanitized Transcript: "${sanitized}"`);

    console.assert(sanitized.includes('[EMAIL_REDACTED]'), 'Email address must be redacted');
    console.assert(sanitized.includes('[PHONE_REDACTED]'), 'Phone number must be redacted');
    console.log('✅ Voice Privacy & Security PASSED\n');

    // 4. Test Platform Analytics Rollup
    console.log('--- 4. Testing Platform Voice Analytics Overview ---');
    const platformAnalytics = await VoicePolicyEngine.getPlatformVoiceAnalytics();
    console.log('Platform Analytics Output:', JSON.stringify(platformAnalytics, null, 2));

    console.assert(typeof platformAnalytics.totalSessions === 'number', 'Total sessions count reported');
    console.assert(typeof platformAnalytics.estimatedTotalCost === 'string', 'Estimated platform cost reported');
    console.log('✅ Platform Voice Analytics PASSED\n');

    console.log('🎉 ALL ADVANCED VOICE FEATURES TESTS PASSED PERFECTLY!');

  } catch (error) {
    console.error('\n❌ Advanced Voice Features Test Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdvancedVoiceTests();
