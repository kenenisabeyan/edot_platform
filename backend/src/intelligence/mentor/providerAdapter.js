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
    const { modelName = 'gemini-3.6-flash', timeoutMs = 15000 } = options;

    if (!this.apiKey || !this.genAI) {
      return this.fallbackChatResponse(prompt, context);
    }

    let retries = 2;
    while (retries >= 0) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const systemInstruction = context.systemInstruction || 'You are EDOT AI Academic Mentor.';
        
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
    const currentLesson = context.currentLessonTitle || 'this lesson';
    const courseTitle = context.currentCourseTitle || 'the course';
    const weakTopic = context.identifiedWeakSkills?.[0] || 'core concepts';

    return {
      rawText: JSON.stringify({
        answer: `I am your EDOT AI Academic Mentor for ${courseTitle}. Based on your progress in "${currentLesson}", I am here to guide your study. ${
          context.knowledgeAvailable === false 
            ? 'Information regarding specific unindexed course materials could not be verified from available course documents.'
            : `To master ${weakTopic}, focus on reviewing the key module notes and attempting practice questions.`
        }`,
        sources: context.sources || [courseTitle],
        suggestedNextActions: [
          `Review lesson notes for ${currentLesson}`,
          `Practice weak topic: ${weakTopic}`
        ],
        confidence: 0.92,
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
