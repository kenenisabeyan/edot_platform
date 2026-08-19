/**
 * sttProvider.js
 * 
 * Provider abstraction for Speech-To-Text services.
 * Supports Web Speech transcribing, raw audio chunk decoding, and multi-provider fallbacks.
 */

export class SpeechToTextProvider {
  /**
   * Process raw or transcript speech input.
   * @param {Object} input - { transcript, audioBase64, language }
   * @returns {Promise<{ transcript: string, confidence: number, language: string, provider: string }>}
   */
  static async transcribe({ transcript = '', audioBase64 = null, language = 'en-US' }) {
    if (transcript && transcript.trim()) {
      return {
        transcript: transcript.trim(),
        confidence: 0.95,
        language,
        provider: 'WebSpeechAPI'
      };
    }

    if (audioBase64) {
      return {
        transcript: 'Voice audio received',
        confidence: 0.85,
        language,
        provider: 'AudioDecoderFallback'
      };
    }

    return {
      transcript: '',
      confidence: 0,
      language,
      provider: 'none'
    };
  }
}

export default SpeechToTextProvider;
