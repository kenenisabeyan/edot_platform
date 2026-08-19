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

const VOICE_POLICY = `CRITICAL VOICE RULES:
- Speak naturally in conversational sentences suitable for audio playback.
- NEVER use markdown formatting (no asterisks, hashes, backticks, bullet points, numbered lists).
- Keep responses under 3-4 short sentences unless the student explicitly asks for depth.
- Use natural verbal transitions: "So...", "Now...", "Here's the thing...", "Think of it this way..."
- Ask an engaging follow-up checkpoint question when appropriate.
- If referencing course material, mention it conversationally, not as citations.`;

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
        model: 'gemini-3.6-flash',
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
    const fallbacks = {
      EXPLAIN: `That's a great question! Let me break it down for you. The key idea here is to start with the fundamentals and build up from there. What part feels most unclear to you right now?`,
      SOCRATIC: `Interesting question! Before I answer directly, let me ask you this: what do you already know about this topic? What's your initial instinct telling you?`,
      PRACTICE: `Let's put your knowledge to the test! Here's a quick challenge: can you explain this concept in your own words, as if you're teaching it to a friend?`,
      QUIZ: `Quick quiz time! Based on what we've been discussing, what would you say is the most important takeaway? I'll let you know how you did!`,
      STUDY: `Let's work through this systematically. We'll start with the big picture and then zoom into the details. Ready to dive in?`,
      EXAM_PREPARATION: `Let's simulate an exam scenario. I'll ask you a question the way it might appear on a test. Take your time and think through your answer carefully.`,
      PROJECT_COACH: `Great project question! Let's think about this step by step. First, what's the core problem you're trying to solve? That will guide our architecture decisions.`,
      DEBUG_UNDERSTANDING: `I want to make sure we're on the same page. Can you walk me through your current understanding? Sometimes explaining it out loud helps identify where things get fuzzy.`,
      MOTIVATION: `You're doing amazing work just by showing up and asking questions! Every expert was once a beginner. What's one thing you learned today that surprised you?`
    };

    return fallbacks[mode] || fallbacks.EXPLAIN;
  }
}

export default TextGenerationProvider;
