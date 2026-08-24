/**
 * EDOT Intelligence Domain - Concept Normalization Engine
 * 
 * Prevents noisy duplicate knowledge nodes (e.g. "JS Functions" vs "JavaScript Function" vs "JavaScript Functions").
 * Provides string cleaning, canonical transformation, and candidate similarity matching.
 */

/**
 * Normalizes a raw concept name into a standard canonical form.
 * 
 * @param {string} rawName 
 * @returns {string} normalized string
 */
export function normalizeConceptName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';

  let name = rawName.trim().toLowerCase();

  // Common abbreviation mappings
  name = name.replace(/\bjs\b/g, 'javascript');
  name = name.replace(/\bpy\b/g, 'python');
  name = name.replace(/\bts\b/g, 'typescript');
  name = name.replace(/\bhtml5\b/g, 'html');
  name = name.replace(/\bcss3\b/g, 'css');
  name = name.replace(/\bpostgres\b/g, 'postgresql');

  // Strip punctuation and special characters (keep spaces & alphanumeric)
  name = name.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim();

  // Strip trailing plural 's' if word > 3 chars (simple stemming)
  const words = name.split(' ').map(w => {
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) {
      return w.slice(0, -1);
    }
    return w;
  });

  return words.join(' ');
}

/**
 * Computes Jaccard similarity between two normalized concept names.
 * 
 * @param {string} nameA 
 * @param {string} nameB 
 * @returns {number} similarity score (0.0 to 1.0)
 */
export function computeSimilarity(nameA, nameB) {
  const normA = normalizeConceptName(nameA);
  const normB = normalizeConceptName(nameB);

  if (normA === normB) return 1.0;

  const setA = new Set(normA.split(' '));
  const setB = new Set(normB.split(' '));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0.0;
  return intersection.size / union.size;
}
