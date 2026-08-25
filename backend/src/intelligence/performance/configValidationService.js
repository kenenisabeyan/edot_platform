/**
 * EDOT Intelligence Domain - Configuration Management & Startup Validation Service
 * Validates critical environment variables without exposing secret strings in logs or API responses.
 */

/**
 * Validates critical environment configuration parameters.
 */
export function validateConfig(env = process.env) {
  const requiredKeys = ['DATABASE_URL', 'JWT_SECRET'];
  const missingKeys = [];

  for (const key of requiredKeys) {
    if (!env[key] || String(env[key]).trim().length === 0) {
      missingKeys.push(key);
    }
  }

  const isValid = missingKeys.length === 0;

  return {
    isValid,
    missingKeys,
    environment: env.NODE_ENV || 'development',
    validatedAt: new Date().toISOString()
  };
}
