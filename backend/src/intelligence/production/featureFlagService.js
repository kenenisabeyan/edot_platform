/**
 * EDOT Intelligence Domain - Feature Flag & Safe Rollout Service
 * Manages operational feature flags (ENABLED, DISABLED, LIMITED) for optional intelligence capabilities,
 * allowing safe maintenance or feature disabling without affecting core educational workflows.
 */

const featureFlags = new Map([
  ['AI_MENTOR', 'ENABLED'],
  ['AI_RECOMMENDATIONS', 'ENABLED'],
  ['AI_PRACTICE_GENERATOR', 'ENABLED'],
  ['OPPORTUNITY_MATCHING', 'ENABLED']
]);

export const FEATURE_FLAG_STATES = {
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED',
  LIMITED: 'LIMITED'
};

/**
 * Gets the current state of a feature flag.
 */
export function getFeatureFlagState(featureName) {
  return featureFlags.get(featureName) || FEATURE_FLAG_STATES.ENABLED;
}

/**
 * Sets the state of a feature flag (Admin operation).
 */
export function setFeatureFlagState(featureName, state) {
  if (!Object.values(FEATURE_FLAG_STATES).includes(state)) {
    throw new Error(`Invalid feature flag state: ${state}`);
  }
  featureFlags.set(featureName, state);
  return { featureName, state, updated: true };
}

/**
 * Returns all active feature flags.
 */
export function getAllFeatureFlags() {
  const flags = {};
  for (const [k, v] of featureFlags.entries()) {
    flags[k] = v;
  }
  return flags;
}
