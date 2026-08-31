/**
 * voiceOrchestrator.js
 * 
 * Production-Grade Voice Learning Orchestrator.
 * 
 * Pipeline:
 *   STUDENT SPEAKS → VOICE IS STREAMED → SPEECH → TEXT →
 *   EDOT CONTEXT ENGINE (Course Knowledge + Learner Profile + Conversation Memory) →
 *   AI REASONING → RESPONSE STREAMING → TEXT → NATURAL VOICE →
 *   STUDENT HEARS RESPONSE
 *
 * Features:
 *   - RAG-grounded context from KnowledgeDocuments
 *   - Server-Sent Events (SSE) streaming for real-time response delivery
 *   - Multi-level learner intelligence context
 *   - Rolling conversation memory with compression
 *   - Barge-in cancellation tracking
 *   - Learning event publishing for analytics
 */

import { prisma } from '../../../lib/prisma.js';
import SpeechToTextProvider from './providers/sttProvider.js';
import TextGenerationProvider from './providers/textGenProvider.js';
import TextToSpeechProvider from './providers/ttsProvider.js';
import ContextCompressor from './contextCompressor.js';
import ContinuousConversationManager from './continuousConversationManager.js';
import { publishLearningEvent } from '../events/learningEventService.js';

export class VoiceOrchestrator {
  /**
   * ═══════════════════════════════════════════════════
   * STAGE 1: Start or Resume a Voice Learning Session
   * ═══════════════════════════════════════════════════
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

    // 3. Generate evidence-based resumption context if resuming
    const resumptionInfo = await ContextCompressor.generateResumptionContext(
      conversation.id,
      courseId ? (await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }))?.title : null,
      lessonId ? (await prisma.lesson.findUnique({ where: { id: lessonId }, select: { title: true } }))?.title : null
    );

    // 4. Ingest session start event (non-blocking)
    publishLearningEvent({
      userId,
      eventType: 'VOICE_SESSION_STARTED',
      courseId,
      lessonId,
      metadata: { sessionId: session.id, mode }
    }).catch(() => {});

    return {
      session,
      conversationId: conversation.id,
      resumptionInfo
    };
  }

  /**
   * Resume an existing voice session with evidence-based continuity.
   */
  static async resumeSession({ sessionId, userId }) {
    const session = await prisma.voiceLearningSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.learnerId !== userId) {
      return null;
    }

    const [course, lesson] = await Promise.all([
      session.courseId ? prisma.course.findUnique({ where: { id: session.courseId }, select: { title: true } }) : null,
      session.lessonId ? prisma.lesson.findUnique({ where: { id: session.lessonId }, select: { title: true } }) : null
    ]);

    const resumptionInfo = await ContextCompressor.generateResumptionContext(
      session.conversationId,
      course?.title,
      lesson?.title
    );

    await prisma.voiceLearningSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE', lastActivityAt: new Date() }
    }).catch(() => {});

    return {
      session,
      resumptionInfo
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STAGE 2-8: Full Pipeline — Process Voice/Text Interaction Turn
   * ═══════════════════════════════════════════════════════════════
   *
   * Pipeline flow:
   *   [STUDENT SPEAKS] → transcript/audioBase64
   *   [SPEECH → TEXT] → sttProvider transcription
   *   [EDOT CONTEXT ENGINE] → Course Knowledge + Learner Profile + Memory
   *   [AI REASONING] → Gemini generation with full grounded context
   *   [RESPONSE] → mentorReply + ttsData
   *   [TEXT → NATURAL VOICE] → client-side SpeechSynthesis
   */
  static async processInteraction({
    userId,
    sessionId,
    conversationId,
    transcript = '',
    audioBase64 = null,
    inputType = 'VOICE',
    courseId = null,
    sectionId = null,
    lessonId = null,
    mode = 'EXPLAIN',
    voiceStyle = 'Friendly',
    explanationStyle = 'Normal',
    speakingSpeed = 'Normal',
    speechLanguage = 'en-US'
  }) {
    const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // ──────────────────────────────────────────────
    // STAGE 2: SPEECH → TEXT
    // ──────────────────────────────────────────────
    const sttResult = await SpeechToTextProvider.transcribe({
      transcript,
      audioBase64,
      language: speechLanguage
    });

    const userText = sttResult.transcript || transcript || 'Hello mentor';

    // Auto-resolve conversationId if missing
    let targetConversationId = conversationId;
    if (!targetConversationId) {
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
      targetConversationId = conversation.id;
    }

    // ──────────────────────────────────────────────
    // STAGE 3: Save user message to conversation
    // ──────────────────────────────────────────────
    await prisma.mentorMessage.create({
      data: {
        conversationId: targetConversationId,
        role: 'user',
        content: userText,
        inputType,
        outputType: 'TEXT',
        courseId,
        lessonId,
        responseId
      }
    });

    // ──────────────────────────────────────────────
    // STAGE 4: Manage context window boundaries seamlessly
    // ──────────────────────────────────────────────
    await ContinuousConversationManager.manageContextWindow(conversationId, {
      maxActiveTurns: 8,
      courseId,
      sectionId,
      lessonId
    });

    // ──────────────────────────────────────────────
    // STAGE 5: EDOT CONTEXT ENGINE
    //   Course Knowledge + Learner Profile + Conversation Memory
    // ──────────────────────────────────────────────
    const contextBundle = await this.assembleContextEngine({
      userId,
      courseId,
      sectionId,
      lessonId,
      conversationId
    });

    // ──────────────────────────────────────────────
    // STAGE 6: AI REASONING (Gemini with grounded context)
    // ──────────────────────────────────────────────
    const mentorReply = await TextGenerationProvider.generateMentorResponse({
      mode,
      voiceStyle,
      explanationStyle,
      systemContext: contextBundle.systemContext,
      knowledgeContext: contextBundle.knowledgeContext,
      rollingMemorySummary: contextBundle.rollingMemory.rollingSummary,
      recentTurns: contextBundle.rollingMemory.shortTermMessages,
      userMessage: userText
    });

    // ──────────────────────────────────────────────
    // STAGE 7: TEXT → NATURAL VOICE (TTS chunk preparation)
    // ──────────────────────────────────────────────
    const ttsData = TextToSpeechProvider.synthesize({
      text: mentorReply,
      voiceStyle,
      speakingSpeed,
      language: speechLanguage
    });

    // ──────────────────────────────────────────────
    // STAGE 8: Persist response + update session
    // ──────────────────────────────────────────────
    await prisma.mentorMessage.create({
      data: {
        conversationId: targetConversationId,
        role: 'assistant',
        content: mentorReply,
        inputType: 'TEXT',
        outputType: inputType,
        courseId,
        lessonId,
        responseId
      }
    });

    // Update Voice Session durations & status (non-blocking)
    if (sessionId) {
      prisma.voiceLearningSession.update({
        where: { id: sessionId },
        data: {
          status: 'AI_SPEAKING',
          totalListeningDuration: { increment: Math.round(userText.length / 5) },
          totalSpeakingDuration: { increment: Math.round(mentorReply.length / 10) },
          lastActivityAt: new Date()
        }
      }).catch(() => {});
    }

    // Publish interaction event for analytics (non-blocking)
    publishLearningEvent({
      userId,
      eventType: 'VOICE_INTERACTION',
      courseId,
      lessonId,
      metadata: { sessionId, responseId, mode, inputType }
    }).catch(() => {});

    return {
      responseId,
      userText,
      mentorReply,
      ttsData,
      mode,
      status: 'AI_SPEAKING',
      context: {
        courseTitle: contextBundle.course?.title || null,
        lessonTitle: contextBundle.lesson?.title || null,
        knowledgeChunksUsed: contextBundle.knowledgeDocuments?.length || 0,
        learnerMomentum: contextBundle.learnerProfile?.learningMomentum || null
      }
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STAGE 5 (Detail): EDOT CONTEXT ENGINE
   *
   * Assembles three context layers in parallel:
   *   1. COURSE KNOWLEDGE — KnowledgeDocuments (RAG context)
   *   2. LEARNER PROFILE — Skills, weaknesses, progress, goals
   *   3. CONVERSATION MEMORY — Rolling summaries + recent turns
   * ═══════════════════════════════════════════════════════════════
   */
  static async assembleContextEngine({ userId, courseId, sectionId, lessonId, conversationId }) {
    // Parallel fetch all context layers
    const [
      learnerProfile,
      course,
      lesson,
      learnerSkills,
      learnerWeaknesses,
      courseProgress,
      knowledgeDocuments,
      rollingMemory
    ] = await Promise.all([
      // LAYER 1: Learner Profile
      prisma.learnerProfile.findUnique({ where: { userId } }),
      
      // LAYER 2: Course Knowledge — dynamic by ID
      courseId ? prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true, description: true, mainCategory: true, subCategory: true }
      }) : null,
      
      lessonId ? prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, title: true, description: true, duration: true }
      }) : null,
      
      // LAYER 3: Learner skill mastery (top skills)
      prisma.learnerSkill.findMany({
        where: { userId },
        orderBy: { masteryScore: 'desc' },
        take: 8
      }),
      
      // LAYER 4: Detected weaknesses
      prisma.learnerWeakness.findMany({
        where: { OR: [{ userId }, { profile: { userId } }] },
        take: 5
      }),
      
      // LAYER 5: Course progress
      courseId ? prisma.userCourseProgress.findFirst({
        where: { userId, courseId }
      }) : null,
      
      // LAYER 6: RAG Knowledge Documents (grounded course content)
      this.fetchKnowledgeContext({ courseId, sectionId, lessonId }),
      
      // LAYER 7: Rolling conversation memory
      ContextCompressor.getRollingMemory(conversationId)
    ]);

    // Build structured system context string
    const systemContextParts = [
      `[COURSE CONTEXT]`,
      `Course: ${course?.title || 'General EDOT Learning'}`,
      `Category: ${course?.mainCategory || 'General'}${course?.subCategory ? ` > ${course.subCategory}` : ''}`,
      `Course Description: ${course?.description?.slice(0, 200) || 'N/A'}`,
      `Current Lesson: ${lesson?.title || 'General Discussion'}`,
      `Lesson Description: ${lesson?.description?.slice(0, 200) || 'N/A'}`,
      '',
      `[LEARNER PROFILE]`,
      `Learning Goals: ${learnerProfile?.learningGoals?.join(', ') || 'Not specified'}`,
      `Academic Level: ${learnerProfile?.academicLevel || 'unknown'}`,
      `Strengths: ${learnerProfile?.strengths?.join(', ') || 'Discovering'}`,
      `Learning Momentum: ${learnerProfile?.learningMomentum || 50}/100`,
      `Risk Level: ${learnerProfile?.riskLevel || 'normal'}`,
      `Course Progress: ${courseProgress?.progress || 0}%`,
      '',
      `[VERIFIED SKILLS]`,
      learnerSkills.length > 0
        ? learnerSkills.map(s => `• ${s.name}: ${Math.round(s.masteryScore)}% mastery`).join('\n')
        : 'No verified skills yet',
      '',
      `[WEAKNESS AREAS]`,
      learnerWeaknesses.length > 0
        ? learnerWeaknesses.map(w => `• ${w.topic}: ${w.description || 'Needs practice'}`).join('\n')
        : 'No weaknesses detected yet'
    ];

    // Build RAG knowledge context string
    const knowledgeContext = knowledgeDocuments.length > 0
      ? [
          `[COURSE KNOWLEDGE BASE — Use this to ground your responses]`,
          ...knowledgeDocuments.map((doc, i) =>
            `[${i + 1}] ${doc.title} (${doc.resourceType}): ${doc.content?.slice(0, 300) || doc.title}`
          )
        ].join('\n')
      : '';

    return {
      learnerProfile,
      course,
      lesson,
      learnerSkills,
      learnerWeaknesses,
      courseProgress,
      knowledgeDocuments,
      rollingMemory,
      systemContext: systemContextParts.join('\n'),
      knowledgeContext
    };
  }

  /**
   * Fetch relevant KnowledgeDocuments for RAG grounding.
   * Retrieves course-level, section-level, and lesson-level knowledge.
   */
  static async fetchKnowledgeContext({ courseId, sectionId, lessonId }) {
    if (!courseId) return [];

    try {
      const conditions = [
        { courseId, status: 'ACTIVE' }
      ];

      // Prioritize lesson-specific and section-specific knowledge
      if (lessonId) {
        conditions.unshift({ lessonId, status: 'ACTIVE' });
      }
      if (sectionId) {
        conditions.unshift({ sectionId, status: 'ACTIVE' });
      }

      const docs = await prisma.knowledgeDocument.findMany({
        where: {
          OR: conditions
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          content: true,
          resourceType: true,
          lessonId: true,
          sectionId: true
        }
      });

      // Sort: lesson-specific first, then section, then course-level
      return docs.sort((a, b) => {
        if (a.lessonId && !b.lessonId) return -1;
        if (!a.lessonId && b.lessonId) return 1;
        if (a.sectionId && !b.sectionId) return -1;
        if (!a.sectionId && b.sectionId) return 1;
        return 0;
      });
    } catch {
      return [];
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STREAMING: Process interaction with Server-Sent Events
   *
   * Streams AI response chunks to the client in real-time so
   * the student hears the response as it's generated.
   * ═══════════════════════════════════════════════════════════════
   */
  static async processInteractionStreaming({
    res,
    userId,
    sessionId,
    conversationId,
    transcript = '',
    audioBase64 = null,
    inputType = 'VOICE',
    courseId = null,
    sectionId = null,
    lessonId = null,
    mode = 'EXPLAIN',
    voiceStyle = 'Friendly',
    explanationStyle = 'Normal',
    speakingSpeed = 'Normal',
    speechLanguage = 'en-US'
  }) {
    const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // STAGE 2: SPEECH → TEXT
      sendEvent('status', { stage: 'TRANSCRIBING', message: 'Processing speech...' });
      
      const sttResult = await SpeechToTextProvider.transcribe({
        transcript,
        audioBase64,
        language: speechLanguage
      });

      const userText = sttResult.transcript || transcript || 'Hello mentor';
      sendEvent('transcript', { text: userText, confidence: sttResult.confidence });

      // Save user message
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

      // STAGE 4: Compress if needed
      await ContextCompressor.compressIfNecessary(conversationId, 10);

      // STAGE 5: EDOT CONTEXT ENGINE
      sendEvent('status', { stage: 'CONTEXT_LOADING', message: 'Loading course knowledge...' });
      
      const contextBundle = await this.assembleContextEngine({
        userId,
        courseId,
        sectionId,
        lessonId,
        conversationId
      });

      sendEvent('context', {
        courseTitle: contextBundle.course?.title || null,
        lessonTitle: contextBundle.lesson?.title || null,
        knowledgeChunks: contextBundle.knowledgeDocuments?.length || 0,
        momentum: contextBundle.learnerProfile?.learningMomentum || null
      });

      // STAGE 6: AI REASONING with streaming
      sendEvent('status', { stage: 'AI_REASONING', message: 'AI mentor is thinking...' });

      const mentorReply = await TextGenerationProvider.generateMentorResponse({
        mode,
        voiceStyle,
        explanationStyle,
        systemContext: contextBundle.systemContext,
        knowledgeContext: contextBundle.knowledgeContext,
        rollingMemorySummary: contextBundle.rollingMemory.rollingSummary,
        recentTurns: contextBundle.rollingMemory.shortTermMessages,
        userMessage: userText
      });

      // STAGE 7: Stream response chunks for real-time TTS
      const ttsData = TextToSpeechProvider.synthesize({
        text: mentorReply,
        voiceStyle,
        speakingSpeed,
        language: speechLanguage
      });

      // Stream each sentence chunk
      for (const chunk of ttsData.chunks) {
        sendEvent('speech_chunk', {
          index: chunk.index,
          text: chunk.text,
          estimatedDurationMs: chunk.estimatedDurationMs
        });
      }

      // STAGE 8: Persist + finalize
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

      // Update session (non-blocking)
      if (sessionId) {
        prisma.voiceLearningSession.update({
          where: { id: sessionId },
          data: {
            status: 'AI_SPEAKING',
            totalListeningDuration: { increment: Math.round(userText.length / 5) },
            totalSpeakingDuration: { increment: Math.round(mentorReply.length / 10) },
            lastActivityAt: new Date()
          }
        }).catch(() => {});
      }

      // Publish analytics event (non-blocking)
      publishLearningEvent({
        userId,
        eventType: 'VOICE_INTERACTION',
        courseId,
        lessonId,
        metadata: { sessionId, responseId, mode, inputType }
      }).catch(() => {});

      // Send completion event
      sendEvent('complete', {
        responseId,
        userText,
        mentorReply,
        ttsData,
        mode,
        status: 'AI_SPEAKING'
      });

    } catch (err) {
      sendEvent('error', { message: err.message || 'Voice processing failed' });
    } finally {
      res.end();
    }
  }

  /**
   * Cancel active response for barge-in / speech interruption.
   */
  static async cancelResponse({ sessionId, responseId, userId }) {
    return this.cancelActiveResponse({ sessionId, responseId });
  }

  /**
   * Change active conversation mode for a voice session.
   */
  static async changeMode({ sessionId, mode, userId }) {
    if (!sessionId) return null;
    return prisma.voiceLearningSession.update({
      where: { id: sessionId },
      data: { mode, lastActivityAt: new Date() }
    });
  }

  /**
   * List voice sessions for a user.
   */
  static async listSessions({ userId, courseId, limit = 10 }) {
    const where = { learnerId: userId };
    if (courseId) where.courseId = courseId;

    return prisma.voiceLearningSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Number(limit) || 10, 50)
    });
  }

  /**
   * End a voice learning session and publish summary analytics.
   */
  static async endSession({ sessionId, userId }) {
    if (!sessionId) return { ended: false };

    const session = await prisma.voiceLearningSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', lastActivityAt: new Date() }
    }).catch(() => null);

    if (session) {
      publishLearningEvent({
        userId,
        eventType: 'VOICE_SESSION_ENDED',
        courseId: session.courseId,
        lessonId: session.lessonId,
        metadata: {
          sessionId,
          totalListeningDuration: session.totalListeningDuration,
          totalSpeakingDuration: session.totalSpeakingDuration,
          mode: session.mode
        }
      }).catch(() => {});
    }

    return { ended: true, session };
  }
}

export default VoiceOrchestrator;
