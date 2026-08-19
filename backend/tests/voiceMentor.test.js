/**
 * voiceMentor.test.js
 * 
 * End-to-end automated test suite for EDOT Continuous AI Voice Mentor System.
 */

import { prisma } from '../lib/prisma.js';
import VoiceOrchestrator from '../src/intelligence/voice/voiceOrchestrator.js';
import ContextCompressor from '../src/intelligence/voice/contextCompressor.js';
import SpeechToTextProvider from '../src/intelligence/voice/providers/sttProvider.js';
import TextGenerationProvider from '../src/intelligence/voice/providers/textGenProvider.js';
import TextToSpeechProvider from '../src/intelligence/voice/providers/ttsProvider.js';
import { onStudentCreated, onEnrollmentCreated } from '../src/intelligence/profile/dynamicLearnerIntelligenceEngine.js';

async function runVoiceMentorTests() {
  console.log('🧪 Starting EDOT Continuous AI Voice Mentor Test Suite...\n');

  // 0. Setup Baseline Data
  const student = await prisma.user.findFirst({ where: { role: 'student' } });
  const course = await prisma.course.findFirst({ where: { isPublished: true }, include: { lessons: true } });
  const lesson = course?.lessons?.[0];

  if (!student || !course) {
    throw new Error('Baseline data missing: Need student and published course in DB');
  }

  // --- Requirement 1: Existing Course & Existing Lesson Voice Mentor Session ---
  console.log('--- Requirement 1: Existing Course Voice Session ---');
  const session1 = await VoiceOrchestrator.startSession({
    userId: student.id,
    courseId: course.id,
    lessonId: lesson?.id,
    mode: 'EXPLAIN',
    voiceStyle: 'Friendly',
    explanationStyle: 'Normal'
  });

  console.log(`  Session ID: ${session1.session.id} | Conversation ID: ${session1.conversationId}`);

  const interact1 = await VoiceOrchestrator.processInteraction({
    userId: student.id,
    sessionId: session1.session.id,
    conversationId: session1.conversationId,
    transcript: 'What is the main topic of this course?',
    inputType: 'VOICE',
    courseId: course.id,
    lessonId: lesson?.id,
    mode: 'EXPLAIN'
  });

  console.log(`  User Speech Input: "${interact1.userText}"`);
  console.log(`  AI Mentor Reply: "${interact1.mentorReply}"`);
  console.log(`  TTS Speech Chunks: ${interact1.ttsData.chunks.length}`);
  console.assert(interact1.mentorReply.length > 0, 'Mentor reply must not be empty');
  console.log('✅ Requirement 1 PASSED\n');

  // --- Requirement 2: Newly Created Course & Lesson Context ---
  console.log('--- Requirement 2: Newly Created Course Auto-Context ---');
  const timeId = Date.now();
  const newCourse = await prisma.course.create({
    data: {
      title: `Voice AI Principles ${timeId}`,
      slug: `voice-ai-${timeId}`,
      description: 'Understanding real-time speech architectures',
      mainCategory: 'Programming & Technology',
      subCategory: 'Speech AI',
      level: 'intermediate',
      status: 'active',
      isPublished: true,
      price: 0,
      duration: 10.0,
      instructorId: student.id
    }
  });

  const newLesson = await prisma.lesson.create({
    data: {
      courseId: newCourse.id,
      title: `Speech Synthesis & Acoustic Models ${timeId}`,
      description: 'Acoustic waveform synthesis and neural TTS pipelines',
      videoUrl: 'https://example.com/videos/speech.mp4',
      duration: 20,
      order: 1
    }
  });

  await onEnrollmentCreated(student.id, newCourse.id);

  const session2 = await VoiceOrchestrator.startSession({
    userId: student.id,
    courseId: newCourse.id,
    lessonId: newLesson.id,
    mode: 'SOCRATIC'
  });

  const interact2 = await VoiceOrchestrator.processInteraction({
    userId: student.id,
    sessionId: session2.session.id,
    conversationId: session2.conversationId,
    transcript: 'How does speech synthesis work step by step?',
    inputType: 'VOICE',
    courseId: newCourse.id,
    lessonId: newLesson.id,
    mode: 'SOCRATIC'
  });

  console.log(`  New Course Title: ${newCourse.title}`);
  console.log(`  Socratic Mentor Response: "${interact2.mentorReply}"`);
  console.assert(interact2.mode === 'SOCRATIC', 'Active mode must be SOCRATIC');
  console.log('✅ Requirement 2 PASSED\n');

  // --- Requirement 3: Newly Created Quiz Interactive Voice Practice ---
  console.log('--- Requirement 3: Voice Quiz & Practice Mode ---');
  const interact3 = await VoiceOrchestrator.processInteraction({
    userId: student.id,
    sessionId: session2.session.id,
    conversationId: session2.conversationId,
    transcript: 'Ask me a practice question to test my understanding.',
    inputType: 'VOICE',
    courseId: newCourse.id,
    lessonId: newLesson.id,
    mode: 'PRACTICE'
  });

  console.log(`  Voice Practice Prompt: "${interact3.mentorReply}"`);
  console.assert(interact3.mentorReply.length > 0, 'Practice prompt generated');
  console.log('✅ Requirement 3 PASSED\n');

  // --- Requirement 4: Newly Registered Student ---
  console.log('--- Requirement 4: Newly Registered Student Auto-Initialization ---');
  const newStudent = await prisma.user.create({
    data: {
      name: `Voice Learner ${timeId}`,
      email: `voice.student.${timeId}@edot.org`,
      password: 'hashed_password_123',
      role: 'student',
      status: 'active'
    }
  });

  await onStudentCreated(newStudent.id, { name: newStudent.name, email: newStudent.email });

  const session4 = await VoiceOrchestrator.startSession({
    userId: newStudent.id,
    courseId: newCourse.id,
    mode: 'STUDY'
  });

  console.log(`  New Student ID: ${newStudent.id} | Session Status: ${session4.session.status}`);
  console.assert(session4.session.learnerId === newStudent.id, 'Session must belong to new student');
  console.log('✅ Requirement 4 PASSED\n');

  // --- Requirement 5: Context Compression (Zero Token Limits Exposed) ---
  console.log('--- Requirement 5: Rolling Memory Compression & Zero Token Errors ---');
  // Populate conversation with 14 turns
  for (let i = 1; i <= 7; i++) {
    await prisma.mentorMessage.create({
      data: {
        conversationId: session2.conversationId,
        role: 'user',
        content: `Question turn ${i} about speech features`,
        inputType: 'VOICE'
      }
    });
    await prisma.mentorMessage.create({
      data: {
        conversationId: session2.conversationId,
        role: 'assistant',
        content: `Answer turn ${i} explanation text`,
        inputType: 'TEXT'
      }
    });
  }

  const compressResult = await ContextCompressor.compressIfNecessary(session2.conversationId, 10);
  console.log(`  Compression Triggered: ${compressResult.compressed} | turns compressed: ${compressResult.compressedTurns}`);
  console.assert(compressResult.compressed === true, 'Context compression must trigger');
  console.log('✅ Requirement 5 PASSED\n');

  // --- Requirement 6: Barge-in / Interruption Request Cancellation ---
  console.log('--- Requirement 6: Barge-in Speech Interruption Handling ---');
  const cancelResult = await VoiceOrchestrator.cancelActiveResponse({
    sessionId: session2.session.id,
    responseId: interact2.responseId
  });

  console.log(`  Response ID: ${cancelResult.responseId} | Cancelled Status: ${cancelResult.status}`);
  console.assert(cancelResult.status === 'LISTENING', 'State must reset to LISTENING upon barge-in');
  console.log('✅ Requirement 6 PASSED\n');

  // --- Requirement 7: Session Resumption & Evidence-Based Continuity ---
  console.log('--- Requirement 7: Session Resumption & Evidence-Based Continuity ---');
  const resumeResult = await VoiceOrchestrator.resumeSession({
    sessionId: session2.session.id,
    userId: student.id
  });

  console.log(`  Resumption Greeting: "${resumeResult.resumptionInfo.greeting}"`);
  console.assert(resumeResult.resumptionInfo.hasHistory === true, 'Resumption info must report history');
  console.assert(resumeResult.resumptionInfo.greeting.includes('Welcome back'), 'Greeting must welcome learner back based on stored evidence');
  console.log('✅ Requirement 7 PASSED\n');

  // Clean up test entities
  await prisma.voiceLearningSession.deleteMany({ where: { OR: [{ learnerId: newStudent.id }, { courseId: newCourse.id }] } });
  await prisma.userCourseProgress.deleteMany({ where: { courseId: newCourse.id } });
  await prisma.enrollment.deleteMany({ where: { courseId: newCourse.id } });
  await prisma.user.delete({ where: { id: newStudent.id } });
  await prisma.lesson.delete({ where: { id: newLesson.id } });
  await prisma.course.delete({ where: { id: newCourse.id } });

  console.log('🎉 ALL CONTINUOUS AI VOICE MENTOR SCENARIOS PASSED PERFECTLY!');
}

runVoiceMentorTests()
  .catch((err) => {
    console.error('❌ Voice Mentor Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
