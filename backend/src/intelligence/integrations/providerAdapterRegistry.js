/**
 * EDOT Intelligence Domain - Modular Provider Adapter Registry & Integration Layer
 * Decouples external providers (content, video, education, assessment, hiring, opportunity, calendar, communication)
 * from core EDOT business logic using standardized provider adapters with configuration, authentication,
 * timeouts, retries, disablement toggles, and audit logging.
 */

import { ExternalServiceError, ForbiddenError, NotFoundError } from '../shared/errors.js';

export class BaseProviderAdapter {
  constructor({
    name,
    category,
    enabled = true,
    config = {},
    timeoutMs = 10000,
    maxRetries = 3
  }) {
    this.name = name;
    this.category = category; // CONTENT_PROVIDER, VIDEO_PLATFORM, EDUCATION_SYSTEM, ASSESSMENT_PROVIDER, HIRING_PLATFORM, OPPORTUNITY_PROVIDER, CALENDAR_SYSTEM, COMMUNICATION_SYSTEM
    this.enabled = enabled;
    this.config = config;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.auditLogs = [];
  }

  /**
   * Executes a provider action with timeout, retries, error handling, and audit logging.
   */
  async executeWithAdapter(actionName, payload, fn) {
    if (!this.enabled) {
      throw new ForbiddenError(`Provider adapter "${this.name}" is currently disabled.`);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        // Execute with timeout promise
        const result = await Promise.race([
          fn(payload),
          new Promise((_, reject) =>
            setTimeout(() => reject(new ExternalServiceError(`Provider timeout after ${this.timeoutMs}ms`)), this.timeoutMs)
          )
        ]);

        const durationMs = Date.now() - startTime;
        this.logAudit(actionName, 'SUCCESS', attempt, durationMs);
        return {
          success: true,
          provider: this.name,
          category: this.category,
          attempts: attempt,
          durationMs,
          data: result
        };
      } catch (err) {
        lastError = err;
        if (attempt >= this.maxRetries) break;
        // Exponential backoff delay
        await new Promise(res => setTimeout(res, 100 * Math.pow(2, attempt)));
      }
    }

    const durationMs = Date.now() - startTime;
    this.logAudit(actionName, 'FAILED', attempt, durationMs, lastError?.message);
    throw new ExternalServiceError(`Provider "${this.name}" failed after ${attempt} attempts: ${lastError?.message}`);
  }

  logAudit(actionName, status, attempts, durationMs, errorDetails = null) {
    this.auditLogs.unshift({
      timestamp: new Date().toISOString(),
      provider: this.name,
      category: this.category,
      actionName,
      status,
      attempts,
      durationMs,
      errorDetails
    });
    if (this.auditLogs.length > 100) this.auditLogs.pop();
  }
}

export class ProviderAdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  registerAdapter(adapter) {
    this.adapters.set(adapter.name, adapter);
  }

  getAdapter(name) {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new NotFoundError(`Provider adapter "${name}" not found.`);
    return adapter;
  }

  listAdapters() {
    return Array.from(this.adapters.values()).map(a => ({
      name: a.name,
      category: a.category,
      enabled: a.enabled,
      timeoutMs: a.timeoutMs,
      maxRetries: a.maxRetries,
      auditLogCount: a.auditLogs.length
    }));
  }

  setEnablement(name, enabled) {
    const adapter = this.getAdapter(name);
    adapter.enabled = Boolean(enabled);
    return { name: adapter.name, enabled: adapter.enabled };
  }

  getAuditLogs() {
    const allLogs = [];
    for (const adapter of this.adapters.values()) {
      allLogs.push(...adapter.auditLogs);
    }
    return allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

export const globalProviderRegistry = new ProviderAdapterRegistry();

// Register Default Reference Adapters
globalProviderRegistry.registerAdapter(new BaseProviderAdapter({
  name: 'GeminiAiProvider',
  category: 'AI_MENTOR',
  timeoutMs: 15000,
  maxRetries: 3
}));

globalProviderRegistry.registerAdapter(new BaseProviderAdapter({
  name: 'HlsVideoPlatform',
  category: 'VIDEO_PLATFORM',
  timeoutMs: 10000,
  maxRetries: 2
}));

globalProviderRegistry.registerAdapter(new BaseProviderAdapter({
  name: 'AssessmentEngineProvider',
  category: 'ASSESSMENT_PROVIDER',
  timeoutMs: 8000,
  maxRetries: 2
}));
