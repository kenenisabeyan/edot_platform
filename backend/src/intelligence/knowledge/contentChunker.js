/**
 * EDOT Intelligence Domain - Content Chunking Service
 * 
 * Splits educational content into semantic chunks respecting headings, paragraphs,
 * and max chunk length limits while preserving metadata and lesson traceability.
 */

/**
 * Splits text into semantic educational chunks.
 * 
 * @param {string} text 
 * @param {object} [options]
 * @param {number} [options.maxChunkSize=500] max words per chunk
 * @param {number} [options.overlapSize=50] word overlap
 * @returns {Array<{ chunkIndex: number, text: string }>} chunks
 */
export function chunkEducationalContent(text, { maxChunkSize = 500, overlapSize = 50 } = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const cleanText = text.trim();
  const paragraphs = cleanText.split(/\n\s*\n/);

  const chunks = [];
  let currentWords = [];
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/);
    if (paraWords.length === 0 || paraWords[0] === '') continue;

    if (currentWords.length + paraWords.length > maxChunkSize && currentWords.length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        text: currentWords.join(' ')
      });

      // Keep overlap from end of current chunk
      currentWords = currentWords.slice(Math.max(0, currentWords.length - overlapSize));
    }

    currentWords.push(...paraWords);
  }

  if (currentWords.length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      text: currentWords.join(' ')
    });
  }

  return chunks;
}
