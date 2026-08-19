/**
 * ttsProvider.js
 * 
 * Provider abstraction for Text-To-Speech services.
 * Prepares sentence-buffered audio markers and Web Speech Synthesis / Server SSML chunks.
 */

export class TextToSpeechProvider {
  /**
   * Split text into speech chunks at sentence boundaries for low-latency streaming playback.
   * @param {string} text
   * @returns {Array<{ index: number, text: string, delayMs: number }>}
   */
  static generateSpeechChunks(text = '') {
    if (!text || !text.trim()) return [];

    // Split on sentence boundaries (. ! ?) while preserving punctuation
    const sentences = text
      .match(/[^.!?]+[.!?]+/g) || [text];

    return sentences.map((sentence, idx) => ({
      index: idx,
      text: sentence.trim(),
      estimatedDurationMs: Math.max(1200, sentence.trim().length * 65)
    }));
  }

  /**
   * Format text for synthesis options.
   * @param {Object} params - { text, voiceStyle, speakingSpeed, language }
   */
  static synthesize({ text, voiceStyle = 'Friendly', speakingSpeed = 'Normal', language = 'en-US' }) {
    const rateMap = { Slow: 0.85, Normal: 1.0, Fast: 1.25 };
    const pitchMap = { Calm: 0.9, Friendly: 1.1, Professional: 1.0, Energetic: 1.2 };

    return {
      text,
      language,
      rate: rateMap[speakingSpeed] || 1.0,
      pitch: pitchMap[voiceStyle] || 1.0,
      chunks: this.generateSpeechChunks(text)
    };
  }
}

export default TextToSpeechProvider;
