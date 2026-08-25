/**
 * EDOT Intelligence Domain - Analytics Data Lifecycle & Tiering Service
 * Manages data lifecycles across HOT (operational), WARM (analytics), and COLD (archival) tiers.
 */

export const DATA_TIERS = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD'
};

/**
 * Evaluates the data tier for a record based on creation timestamp and access frequency.
 */
export function evaluateDataTier(createdAt) {
  const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 3600 * 24);

  if (ageInDays <= 30) return DATA_TIERS.HOT;
  if (ageInDays <= 365) return DATA_TIERS.WARM;
  return DATA_TIERS.COLD;
}
