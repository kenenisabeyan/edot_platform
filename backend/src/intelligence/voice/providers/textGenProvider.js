/**
 * textGenProvider.js
 * 
 * Provider abstraction for Text Generation using Gemini 3.5 Flash.
 * Implements 9 dynamic conversation modes with educational prompt policy.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

const MODE_INSTRUCTIONS = {
  EXPLAIN: 'You are in EXPLAIN mode. Explain concepts clearly, step-by-step, using relatable analogies and zero dense textbook jargon.',
  SOCRATIC: 'You are in SOCRATIC mode. Never give direct answers immediately. Ask guiding questions that help the learner discover the answer themselves.',
  PRACTICE: 'You are in PRACTICE mode. Pose short, interactive practical problems one at a time and evaluate the student\'s verbal/written response.',
  QUIZ: 'You are in QUIZ mode. Conduct a quick verbal quiz question, check their answer, provide instant encouraging feedback, and move to the next topic.',
  STUDY: 'You are in STUDY mode. Guide the student through their current course section structured logically with key checkpoints.',
  EXAM_PREPARATION: 'You are in EXAM PREPARATION mode. Ask exam-style questions, evaluate precision, and highlight areas needing reinforcement.',
  PROJECT_COACH: 'You are in PROJECT COACH mode. Help the student design, structure, and debug project ideas step-by-step.',
  DEBUG_UNDERSTANDING: 'You are in DEBUG UNDERSTANDING mode. Identify misconceptions in the student\'s mental model and guide them to correct understanding.',
  MOTIVATION: 'You are in MOTIVATION mode. Provide warm, realistic, highly supportive learning encouragement tailored to their current progress.'
};

export class TextGenerationProvider {
  /**
   * Generate conversational mentor response.
   * @param {Object} params
   * @returns {Promise<string>}
   */
  static async generateMentorResponse({
    mode = 'EXPLAIN',
    voiceStyle = 'Friendly',
    explanationStyle = 'Normal',
    systemContext = '',
    rollingMemorySummary = '',
    recentTurns = [],
    userMessage = ''
  }) {
    const baseInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.EXPLAIN;
    const styleInstruction = `Adopt a ${voiceStyle.toLowerCase()} tone with ${explanationStyle.toLowerCase()} detail level. Speak naturally in conversational sentences suitable for audio playback. Keep responses under 3-4 short sentences unless explicitly asked for depth. Ask an engaging follow-up checkpoint question when appropriate.`;

    const systemPolicy = `${baseInstruction}\n${styleInstruction}\n\n[CONTEXT & MEMORY]\n${systemContext}\n${rollingMemorySummary ? `Summary of prior dialogue: ${rollingMemorySummary}` : ''}`;

    const formattedTurns = recentTurns
      .map((turn) => `${turn.role === 'user' ? 'Student' : 'Mentor'}: ${turn.content}`)
      .join('\n');

    const promptText = `${formattedTurns}\nStudent: ${userMessage}\nMentor:`;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
      return `I understand you are asking about this concept. Let's break it down together! Does that make sense so far?`;
    }

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        systemInstruction: systemPolicy
      });

      const result = await model.generateContent(promptText);
      const response = await result.response;
      let replyText = response.text().trim();

      // Clean up markdown formatting symbols for natural speech synthesis
      replyText = replyText.replace(/[*#_~`]/g, '').trim();
      return replyText;
    } catch (err) {
      console.error('[TextGenProvider] Fallback triggered:', err.message);
      return `That is a great question! Let's explore it step by step. Tell me, what part of this topic feels most familiar to you?`;
    }
  }
}

export default TextGenerationProvider;
