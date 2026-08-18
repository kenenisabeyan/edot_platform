/**
 * Test Suite - Production-Quality Learning Event Pipeline Demonstration & Verification
 */

import { validateAndNormalizeLearningEvent, sanitizePayload } from '../src/intelligence/events/eventValidator.js';
import { publishLearningEvent, publishLearningEventsBatch, queryLearningEvents } from '../src/intelligence/events/learningEventService.js';
import { eventBus } from '../src/intelligence/shared/eventBus.js';
import { prisma } from '../lib/prisma.js';

async function runPipelineTestSuite() {
  console.log('🧪 Starting EDOT Learning Event Pipeline Test Suite...\n');

  try {
    // 1. Fetch or mock a test user
    const testUser = await prisma.user.findFirst() || {
      id: '00000000-0000-0000-0000-000000000001',
      role: 'student'
    };
    console.log(`👤 Using test user ID: ${testUser.id}`);

    // 2. Test Payload Sanitization
    console.log('\n--- 1. Testing Sensitive Data Sanitization ---');
    const dirtyPayload = {
      userPassword: 'SecretPassword123!',
      apiKey: 'sk-1234567890abcdef',
      promptText: 'System instructions for AI tutor',
      normalField: 'Valid Learning Metadata'
    };
    const sanitized = sanitizePayload(dirtyPayload);
    console.log('Sanitized payload output:', JSON.stringify(sanitized, null, 2));
    if (sanitized.userPassword === '[REDACTED]' && sanitized.apiKey === '[REDACTED]') {
      console.log('✅ Sanitization test PASSED');
    } else {
      throw new Error('Sanitization failed to redact sensitive keys');
    }

    // 3. Test Single Event Ingestion
    console.log('\n--- 2. Testing Single Event Ingestion (LESSON_STARTED) ---');
    const idempotencyKey1 = `test-key-single-${Date.now()}`;
    const singleResult = await publishLearningEvent({
      idempotencyKey: idempotencyKey1,
      userId: testUser.id,
      eventType: 'LESSON_STARTED',
      courseId: 'course-test-101',
      lessonId: 'lesson-test-202',
      duration: 120,
      progress: 10,
      metadata: { topic: 'Data Structures' }
    }, testUser);

    console.log('Single event created:', singleResult.event.id);
    if (!singleResult.isDuplicate && singleResult.event.eventType === 'LESSON_STARTED') {
      console.log('✅ Single event ingestion test PASSED');
    } else {
      throw new Error('Single event ingestion failed');
    }

    // 4. Test Idempotency & Deduplication
    console.log('\n--- 3. Testing Idempotency & Deduplication ---');
    const duplicateResult = await publishLearningEvent({
      idempotencyKey: idempotencyKey1, // Re-using identical key
      userId: testUser.id,
      eventType: 'LESSON_STARTED',
      courseId: 'course-test-101'
    }, testUser);

    console.log('Duplicate ingestion attempt result (isDuplicate):', duplicateResult.isDuplicate);
    if (duplicateResult.isDuplicate && duplicateResult.event.id === singleResult.event.id) {
      console.log('✅ Idempotency & Deduplication test PASSED');
    } else {
      throw new Error('Idempotency check failed to catch duplicate key');
    }

    // 5. Test Batch Event Ingestion
    console.log('\n--- 4. Testing Batch Event Ingestion ---');
    const batchResult = await publishLearningEventsBatch([
      {
        idempotencyKey: `test-batch-1-${Date.now()}`,
        userId: testUser.id,
        eventType: 'VIDEO_STARTED',
        courseId: 'course-test-101',
        lessonId: 'lesson-test-202',
        duration: 0,
        progress: 0
      },
      {
        idempotencyKey: `test-batch-2-${Date.now()}`,
        userId: testUser.id,
        eventType: 'VIDEO_PROGRESS',
        courseId: 'course-test-101',
        lessonId: 'lesson-test-202',
        duration: 300,
        progress: 50
      },
      {
        idempotencyKey: `test-batch-3-${Date.now()}`,
        userId: testUser.id,
        eventType: 'QUIZ_COMPLETED',
        courseId: 'course-test-101',
        quizId: 'quiz-test-303',
        score: 95,
        progress: 100
      }
    ], testUser);

    console.log(`Batch processed: ${batchResult.processedCount} events, duplicates: ${batchResult.duplicatesCount}`);
    if (batchResult.processedCount === 3) {
      console.log('✅ Batch ingestion test PASSED');
    } else {
      throw new Error('Batch ingestion failed');
    }

    // 6. Test Querying Event Store
    console.log('\n--- 5. Testing Indexed Event Store Query ---');
    const queryResults = await queryLearningEvents({
      userId: testUser.id,
      limit: 5
    });

    console.log(`Query returned ${queryResults.events.length} recent events out of ${queryResults.totalCount} total.`);
    if (queryResults.events.length > 0) {
      console.log('✅ Indexed event store query test PASSED');
    } else {
      throw new Error('Query returned 0 events');
    }

    console.log('\n🎉 ALL LEARNING EVENT PIPELINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPipelineTestSuite();
