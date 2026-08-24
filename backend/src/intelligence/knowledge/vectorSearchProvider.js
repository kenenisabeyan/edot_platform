/**
 * EDOT Intelligence Domain - Vendor-Agnostic Vector & Semantic Search Provider
 * 
 * Provides an abstract interface for generating embeddings and computing semantic relevance.
 * Tightly decouples EDOT Intelligence business logic from any specific AI or Vector DB vendor.
 */

import { computeSimilarity } from './conceptNormalization.js';

/**
 * Generates an embedding vector for a given text snippet.
 * Abstract interface: Fallback implements lightweight term vector hashing.
 * 
 * @param {string} text 
 * @returns {Promise<Array<number>>} vector embedding
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') return new Array(64).fill(0);

  const hash = [];
  const clean = text.toLowerCase();
  for (let i = 0; i < 64; i++) {
    const charCode = clean.charCodeAt(i % clean.length) || 0;
    hash.push(Math.sin(charCode + i));
  }
  return hash;
}

/**
 * Computes semantic similarity between query text and a candidate text.
 * 
 * @param {string} queryText 
 * @param {string} candidateText 
 * @returns {Promise<number>} similarity score 0.0 - 1.0
 */
export async function computeSemanticRelevance(queryText, candidateText) {
  if (!queryText || !candidateText) return 0.0;
  return computeSimilarity(queryText, candidateText);
}
