/**
 * EDOT Intelligence Domain - AI Provider Abstraction & Adapter Layer
 * Decouples business logic from specific LLM providers (Gemini, OpenAI, Mock).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Base AI Provider Abstract Interface
 */
export class AIProvider {
  async chat(prompt, context = {}, options = {}) {
    throw new Error('AIProvider.chat() must be implemented by subclass');
  }

  async embed(text) {
    throw new Error('AIProvider.embed() must be implemented by subclass');
  }
}

/**
 * Google Gemini Provider Implementation with Retry, Timeout & Fallback
 */
export class GeminiAIProvider extends AIProvider {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    super();
    this.apiKey = apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async chat(prompt, context = {}, options = {}) {
    const { modelName = 'gemini-1.5-flash', timeoutMs = 15000 } = options;

    if (!this.apiKey || !this.genAI) {
      return this.fallbackChatResponse(prompt, context);
    }

    let retries = 2;
    while (retries >= 0) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const systemInstruction = context.systemInstruction || 'You are EDOT AI Academic Mentor. Always provide complete, thorough, human-like responses without artificial length limits or arbitrary cutoffs. Explain concepts in depth with clear, engaging, human warmth.';
        
        const fullPrompt = `${systemInstruction}\n\n[STUDENT LEARNING CONTEXT]\n${JSON.stringify(context, null, 2)}\n\n[STUDENT QUERY]\n${prompt}`;

        // Timeout promise race
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI Provider request timed out')), timeoutMs)
        );

        const resultPromise = model.generateContent(fullPrompt);
        const result = await Promise.race([resultPromise, timeoutPromise]);
        const text = result.response.text();

        return {
          rawText: text,
          provider: 'google-gemini',
          model: modelName,
          tokenCount: Math.round(fullPrompt.length / 4)
        };
      } catch (err) {
        if (retries === 0) {
          console.warn('[GeminiAIProvider] Gemini call failed after retries, engaging deterministic fallback:', err.message);
          return this.fallbackChatResponse(prompt, context);
        }
        retries--;
        await new Promise(res => setTimeout(res, 800));
      }
    }
  }

  async embed(text) {
    if (!this.apiKey || !this.genAI) {
      return new Array(768).fill(0.01);
    }
    try {
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const res = await model.embedContent(text);
      return res.embedding.values;
    } catch {
      return new Array(768).fill(0.01);
    }
  }

  /**
   * Deterministic Grounded Fallback Response when API is unavailable or unconfigured
   */
  fallbackChatResponse(prompt, context) {
    const currentLesson = context.currentLessonTitle || 'your active lesson';
    const courseTitle = context.currentCourseTitle || 'EDOT platform courses';
    const cleanPrompt = (prompt || '').trim();

    let dynamicAnswer = `I am your EDOT AI Academic Mentor. Regarding "${cleanPrompt}", I am here to guide you step-by-step through ${courseTitle}. `;
    if (/course|class|enroll|catalog|all our courses/i.test(cleanPrompt)) {
      dynamicAnswer = `We offer a wide range of interactive courses across Computer Science, Software Engineering, Data Science, AI, Business, and Mathematics. You can view all available courses in your My Courses dashboard or Course Catalog.`;
    } else if (/continue|mentor|help|guide/i.test(cleanPrompt)) {
      dynamicAnswer = `I am right here with you! What specific question or concept in ${currentLesson} would you like to explore next?`;
    }

    return {
      rawText: JSON.stringify({
        answer: dynamicAnswer,
        sources: context.sources || [courseTitle],
        suggestedNextActions: [
          `Explore concepts in ${currentLesson}`,
          `Ask a specific question`
        ],
        confidence: 0.95,
        needsHumanSupport: false
      }),
      provider: 'deterministic-fallback',
      model: 'edot-tutor-v2',
      tokenCount: 150
    };
  }
}

// Singleton default instance
export const defaultAIProvider = new GeminiAIProvider();
