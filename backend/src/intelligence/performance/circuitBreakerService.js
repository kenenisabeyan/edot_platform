/**
 * EDOT Intelligence Domain - Circuit Breaker & Resilience Service
 * Implements circuit breaker pattern (CLOSED, OPEN, HALF_OPEN) to protect external dependencies
 * (AI providers, email services, external APIs) from cascading failures.
 */

const circuitBreakers = new Map();
const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT_MS = 10000;

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

/**
 * Executes a function wrapped in a circuit breaker.
 */
export async function executeWithCircuitBreaker(serviceName, actionFn, fallbackFn = null) {
  let breaker = circuitBreakers.get(serviceName) || {
    state: CIRCUIT_STATES.CLOSED,
    failures: 0,
    nextAttemptAt: 0
  };

  const now = Date.now();

  if (breaker.state === CIRCUIT_STATES.OPEN) {
    if (now > breaker.nextAttemptAt) {
      breaker.state = CIRCUIT_STATES.HALF_OPEN;
    } else {
      // Circuit is OPEN: execute fallback
      if (typeof fallbackFn === 'function') {
        const fallbackValue = await fallbackFn();
        return { result: fallbackValue, circuitState: CIRCUIT_STATES.OPEN, isFallback: true };
      }
      throw new Error(`Circuit breaker for ${serviceName} is OPEN`);
    }
  }

  try {
    const result = await actionFn();

    // Success: reset failures and close circuit
    breaker.state = CIRCUIT_STATES.CLOSED;
    breaker.failures = 0;
    circuitBreakers.set(serviceName, breaker);

    return { result, circuitState: CIRCUIT_STATES.CLOSED, isFallback: false };
  } catch (err) {
    breaker.failures++;
    if (breaker.failures >= FAILURE_THRESHOLD) {
      breaker.state = CIRCUIT_STATES.OPEN;
      breaker.nextAttemptAt = Date.now() + RESET_TIMEOUT_MS;
    }
    circuitBreakers.set(serviceName, breaker);

    if (typeof fallbackFn === 'function') {
      const fallbackValue = await fallbackFn();
      return { result: fallbackValue, circuitState: breaker.state, isFallback: true };
    }

    throw err;
  }
}

/**
 * Gets the current state of a circuit breaker.
 */
export function getCircuitBreakerState(serviceName) {
  const breaker = circuitBreakers.get(serviceName);
  return breaker ? breaker.state : CIRCUIT_STATES.CLOSED;
}
