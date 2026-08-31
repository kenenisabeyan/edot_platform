/**
 * textGenProvider.js
 * 
 * Production-grade AI Reasoning Provider using Gemini 3.5 Flash.
 * 
 * Features:
 *   - 9 dynamic conversation modes with educational prompt policy
 *   - RAG-grounded context from KnowledgeDocuments
 *   - Learner-aware reasoning (skills, weaknesses, progress)
 *   - Voice-optimized output (no markdown, natural speech)
 *   - Graceful fallback on API failure
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

const MODE_INSTRUCTIONS = {
  EXPLAIN: 'You are in EXPLAIN mode. Explain concepts clearly, step-by-step, using relatable analogies and zero dense textbook jargon. Break complex ideas into digestible pieces.',
  SOCRATIC: 'You are in SOCRATIC mode. Never give direct answers immediately. Ask guiding questions that help the learner discover the answer themselves. Build understanding through dialogue.',
  PRACTICE: 'You are in PRACTICE mode. Pose short, interactive practical problems one at a time and evaluate the student\'s verbal/written response. Give constructive feedback.',
  QUIZ: 'You are in QUIZ mode. Conduct a quick verbal quiz question, check their answer, provide instant encouraging feedback, and move to the next topic.',
  STUDY: 'You are in STUDY mode. Guide the student through their current course section structured logically with key checkpoints. Summarize important concepts.',
  EXAM_PREPARATION: 'You are in EXAM PREPARATION mode. Ask exam-style questions, evaluate precision, and highlight areas needing reinforcement. Simulate real exam pressure.',
  PROJECT_COACH: 'You are in PROJECT COACH mode. Help the student design, structure, and debug project ideas step-by-step. Give actionable technical guidance.',
  DEBUG_UNDERSTANDING: 'You are in DEBUG UNDERSTANDING mode. Identify misconceptions in the student\'s mental model and guide them to correct understanding through targeted clarification.',
  MOTIVATION: 'You are in MOTIVATION mode. Provide warm, realistic, highly supportive learning encouragement tailored to their current progress and struggles.'
};

const VOICE_POLICY = `CRITICAL HUMAN CONVERSATIONAL RULES:
- Provide complete, thorough, natural human answers without artificial sentence limits.
- Speak naturally and warmly like an expert human mentor talking directly to a student.
- Give rich, comprehensive explanations with clear step-by-step reasoning.
- Use natural conversational transitions: "So...", "Now...", "Here's the thing...", "Think of it this way..."
- Ask an engaging follow-up checkpoint question when appropriate.
- If referencing course material, mention it conversationally.`;

export class TextGenerationProvider {
  /**
   * Generate AI Mentor response with full grounded context.
   *
   * @param {Object} params
   * @param {string} params.mode - Conversation mode
   * @param {string} params.voiceStyle - Tone (Friendly, Calm, Professional, Energetic)
   * @param {string} params.explanationStyle - Detail level (Simple, Normal, Detailed)
   * @param {string} params.systemContext - Assembled learner + course context
   * @param {string} params.knowledgeContext - RAG knowledge document context
   * @param {string} params.rollingMemorySummary - Compressed conversation history
   * @param {Array} params.recentTurns - Recent conversation messages
   * @param {string} params.userMessage - Current student message
   * @returns {Promise<string>}
   */
  static async generateMentorResponse({
    mode = 'EXPLAIN',
    voiceStyle = 'Friendly',
    explanationStyle = 'Normal',
    systemContext = '',
    knowledgeContext = '',
    rollingMemorySummary = '',
    recentTurns = [],
    userMessage = ''
  }) {
    const baseInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.EXPLAIN;
    
    const styleInstruction = `Adopt a ${voiceStyle.toLowerCase()} tone with ${explanationStyle.toLowerCase()} detail level.`;

    // Assemble the full system prompt with grounded knowledge
    const systemParts = [
      `You are EDOT AI Mentor — a world-class educational tutor that adapts to each student's level.`,
      '',
      baseInstruction,
      '',
      styleInstruction,
      '',
      VOICE_POLICY,
      '',
      systemContext
    ];

    // Add RAG knowledge if available
    if (knowledgeContext) {
      systemParts.push('');
      systemParts.push(knowledgeContext);
      systemParts.push('');
      systemParts.push('IMPORTANT: Ground your responses in the course knowledge above. Reference specific concepts from the materials when relevant.');
    }

    // Add rolling memory summary if available
    if (rollingMemorySummary) {
      systemParts.push('');
      systemParts.push(`[CONVERSATION HISTORY SUMMARY]`);
      systemParts.push(rollingMemorySummary);
    }

    const systemPolicy = systemParts.join('\n');

    // Format recent conversation turns
    const formattedTurns = recentTurns
      .map((turn) => `${turn.role === 'user' ? 'Student' : 'Mentor'}: ${turn.content}`)
      .join('\n');

    const promptText = formattedTurns
      ? `${formattedTurns}\nStudent: ${userMessage}\nMentor:`
      : `Student: ${userMessage}\nMentor:`;

    // Check if API key is available
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
      return this.generateFallbackResponse(mode, userMessage);
    }

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPolicy
      });

      const result = await model.generateContent(promptText);
      const response = await result.response;
      let replyText = response.text().trim();

      // Clean up any markdown formatting for natural speech
      replyText = replyText
        .replace(/[*#_~`]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return replyText;
    } catch (err) {
      console.error('[TextGenProvider] Generation error, using fallback:', err.message);
      return this.generateFallbackResponse(mode, userMessage);
    }
  }

  /**
   * Generate a contextual fallback response when the API is unavailable.
   */
  static generateFallbackResponse(mode, userMessage) {
    const cleanMsg = (userMessage || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. ADVANCED / IN-DEPTH EXPLANATION REQUESTS
    if (/advanced|deep|in-depth|technical|detailed|expert/i.test(lowerMsg)) {
      return `To explain this at an advanced, technical level: EDOT's platform architecture relies on a multi-tier educational intelligence ecosystem. It integrates continuous telemetry tracking, knowledge document vector embeddings (RAG), and adaptive cognitive modeling to track your mastery curve across every concept in real time. Rather than linear instruction, it dynamically recalibrates lesson paths, quiz difficulty, and practice exercises based on your exact retention metrics. Which technical subsystem would you like to explore deeper — the RAG knowledge pipeline, the adaptive skill graph, or the telemetry engine?`;
    }

    // 2. WHY / CAUSE / REASON INQUIRIES
    if (/^why\??$/i.test(lowerMsg) || /why is|why does|why do|reason/i.test(lowerMsg)) {
      return `The fundamental reason behind this lies in how adaptive learning optimizes cognitive retention. When education is tailored to an individual's personal pace, cognitive load is balanced — preventing both boredom from overly easy material and frustration from ungrounded concepts. By continuously analyzing your practice responses and study rhythm, EDOT ensures every lesson directly strengthens your weak areas while accelerating your domain strengths.`;
    }

    // 3. EDOT PLATFORM DEFINITION & PURPOSE
    if (/edot|platform|what is edot|what edot means/i.test(lowerMsg)) {
      return `The EDOT Platform is a unified, AI-powered digital learning ecosystem. It brings together interactive course materials, real-time AI mentorship, continuous telemetry progress analytics, parent/guardian insight portals, and sponsorship networks into one seamless experience. Instead of static textbook learning, EDOT adapts directly to your speed, goals, and style — providing instant explanations, guided practice, and industry-aligned skill certificates.`;
    }

    // 4. COURSE & CATALOG INQUIRIES
    if (/course|class|enroll|catalog|available|all our courses/i.test(lowerMsg)) {
      return `EDOT features a comprehensive curriculum spanning Computer Science, Full-Stack Web Development, Data Science, AI & Machine Learning, Business & Entrepreneurship, and Mathematics. In addition to your active enrolled courses, you have full access to browse the complete Course Catalog, complete self-paced lessons, earn verified certificates, and practice with your AI Mentor. Which course track or career skill would you like to focus on today?`;
    }

    // 5. AFFIRMATIVE / SHORT CONTINUATION PROMPTS ("yea", "yes", "ok", "continue", "go on", "sure")
    if (/^(yea|yeah|yes|ok|okay|sure|continue|go on|yep|aight|alright|o)$/i.test(lowerMsg)) {
      return `Fantastic! Let's keep building momentum. We can dive right into your active course material, analyze code architecture, practice problem-solving, or explore an advanced concept you're curious about. What specific topic shall we tackle first?`;
    }

    // 6. PROGRESS, GRADES, CERTIFICATES & MASTERY
    if (/progress|grade|certificate|score|mastery|streak/i.test(lowerMsg)) {
      return `You can view your complete learning velocity, quiz averages, weekly study hours, and earned certificates inside your Intelligence Hub under My Progress and My Mastery. Your continuous effort is building strong momentum! What specific goal or milestone are you aiming to hit next?`;
    }

    // 7. MENTOR & GUIDANCE PROMPTS
    if (/mentor|guide|help|tutor|teach/i.test(lowerMsg)) {
      return `I am your personal AI Academic Mentor! I am here to explain complex concepts in plain English, guide you through interactive practice problems, debug code, and help prepare for exams. What lesson or problem can we solve together right now?`;
    }

    // 8. GENERAL INTENTIONAL RESPONDER
    return `That's an important topic. When we analyze "${cleanMsg}", the key is to look at the underlying principles first and then examine how they apply in practice. Let me know which specific angle or question about this you'd like to dive into!`;
  }
}

export default TextGenerationProvider;
