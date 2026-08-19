/**
 * voiceOrchestrator.js
 * 
 * Core Voice Learning Orchestrator.
 * Manages the real-time learning loop, dynamic context assembly, understanding checkpoints,
 * barge-in cancellation tracking, and voice learning sessions.
 */

import { prisma } from '../../lib/prisma.js';
import SpeechToTextProvider from './providers/sttProvider.js';
import TextGenerationProvider from './providers/textGenProvider.js';
import TextToSpeechProvider from './providers/ttsProvider.js';
import ContextCompressor from './contextCompressor.js';
import { publishLearningEvent } from '../events/learningEventService.js';

export class VoiceOrchestrator {
  /**
   * Start or resume a Voice Learning Session.
   */
  static async startSession({
    userId,
    courseId = null,
    sectionId = null,
    lessonId = null,
    mode = 'EXPLAIN',
    voiceStyle = 'Friendly',
    explanationStyle = 'Normal',
    speakingSpeed = 'Normal',
    speechLanguage = 'en-US'
  }) {
    // 1. Resolve or create mentor conversation
    let conversation = await prisma.mentorConversation.findFirst({
      where: { userId, contextCourseId: courseId },
      orderBy: { updatedAt: 'desc' }
    });

    if (!conversation) {
      conversation = await prisma.mentorConversation.create({
        data: {
          userId,
          contextCourseId: courseId,
          contextLessonId: lessonId,
          title: 'Voice Learning Session',
          topic: 'Interactive Voice Mentorship'
        }
      });
    }

    // 2. Create Voice Learning Session
    const session = await prisma.voiceLearningSession.create({
      data: {
        learnerId: userId,
        conversationId: conversation.id,
        courseId,
        sectionId,
        lessonId,
        mode,
        status: 'ACTIVE',
        voiceStyle,
        explanationStyle,
        speakingSpeed,
        speechLanguage
      }
    });

    // 3. Ingest session start event
    publishLearningEvent({
      userId,
      eventType: 'VOICE_SESSION_STARTED',
      courseId,
      lessonId,
      metadata: { sessionId: session.id, mode }
    }).catch(() => {});

    return {
      session,
      conversationId: conversation.id
    };
  }

  /**
   * Process incoming voice or text interaction turn.
   */
  static async processInteraction({
    userId,
    sessionId,
    conversationId,
    transcript = '',
    audioBase64 = null,
    inputType = 'VOICE',
    courseId = null,
    lessonId = null,
    mode = 'EXPLAIN',
    voiceStyle = 'Friendly',
    explanationStyle = 'Normal',
    speakingSpeed = 'Normal',
    speechLanguage = 'en-US'
  }) {
    const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Transcribe speech if inputType is VOICE
    const sttResult = await SpeechToTextProvider.transcribe({
      transcript,
      audioBase64,
      language: speechLanguage
    });

    const userText = sttResult.transcript || transcript || 'Hello mentor';

    // 2. Save user message to mentor conversation
    await prisma.mentorMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: userText,
        inputType,
        outputType: 'TEXT',
        courseId,
        lessonId,
        responseId
      }
    });

    // 3. Compress older context turns if threshold exceeded
    await ContextCompressor.compressIfNecessary(conversationId, 10);

    // 4. Retrieve dynamic context & rolling memory
    const [learnerProfile, course, lesson, learnerSkills, learnerWeaknesses, rollingMemory] = await Promise.all([
      prisma.learnerProfile.findUnique({ where: { userId } }),
      courseId ? prisma.course.findUnique({ where: { id: courseId } }) : null,
      lessonId ? prisma.lesson.findUnique({ where: { id: lessonId } }) : null,
      prisma.learnerSkill.findMany({ where: { userId }, orderBy: { masteryScore: 'desc' }, take: 5 }),
      prisma.learnerWeakness.findMany({ where: { OR: [{ userId }, { profile: { userId } }] }, take: 4 }),
      ContextCompressor.getRollingMemory(conversationId)
    ]);

    const systemContext = [
      `Course: ${course?.title || 'General EDOT Learning'}`,
      `Lesson: ${lesson?.title || 'General Discussion'}`,
      `Learner Goal: ${learnerProfile?.learningGoals?.[0] || 'Skill Mastery'}`,
      `Verified Skills: ${learnerSkills.map((s) => `${s.name} (${Math.round(s.masteryScore)}%)`).join(', ') || 'Initial'}`,
      `Weakness Areas: ${learnerWeaknesses.map((w) => w.topic).join(', ') || 'None detected'}`
    ].join('\n');

    // 5. Generate AI Mentor response via TextGenerationProvider
    const mentorReply = await TextGenerationProvider.generateMentorResponse({
      mode,
      voiceStyle,
      explanationStyle,
      systemContext,
      rollingMemorySummary: rollingMemory.rollingSummary,
      recentTurns: rollingMemory.shortTermMessages,
      userMessage: userText
    });

    // 6. Generate TTS Chunk Metadata
    const ttsData = TextToSpeechProvider.synthesize({
      text: mentorReply,
      voiceStyle,
      speakingSpeed,
      language: speechLanguage
    });

    // 7. Save mentor response message
    await prisma.mentorMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: mentorReply,
        inputType: 'TEXT',
        outputType: inputType,
        courseId,
        lessonId,
        responseId
      }
    });

    // 8. Update Voice Session durations & status
    if (sessionId) {
      await prisma.voiceLearningSession.update({
        where: { id: sessionId },
        data: {
          status: 'AI_SPEAKING',
          totalListeningDuration: { increment: Math.round(userText.length / 5) },
          totalSpeakingDuration: { increment: Math.round(mentorReply.length / 10) },
          lastActivityAt: new Date()
        }
      }).catch(() => {});
    }

    return {
      responseId,
      userText,
      mentorReply,
      ttsData,
      mode,
      status: 'AI_SPEAKING'
    };
  }

  /**
   * Cancel active response for barge-in / speech interruption.
   */
  static async cancelActiveResponse({ sessionId, responseId }) {
    if (sessionId) {
      await prisma.voiceLearningSession.update({
        where: { id: sessionId },
        data: { status: 'LISTENING', lastActivityAt: new Date() }
      }).catch(() => {});
    }

    return {
      cancelled: true,
      responseId,
      status: 'LISTENING'
    };
  }
}

export default VoiceOrchestrator;
