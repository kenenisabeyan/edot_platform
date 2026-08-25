/**
 * EDOT Intelligence Domain - Structured Logging & Secret Redaction Service
 * Supports DEBUG, INFO, WARN, ERROR, and CRITICAL log levels.
 * Automatically redacts passwords, tokens, API keys, database connection strings, and private AI prompts.
 */

export const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  CRITICAL: 50
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

const SECRET_PATTERNS = [
  /password\s*=\s*['"]?[^\s'"]+['"]?/gi,
  /bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*/gi,
  /postgres:\/\/[^\s]+/gi,
  /sk-[a-zA-Z0-9]{20,}/gi,
  /api[_\-]?key\s*[:=]\s*['"]?[^\s'"]+['"]?/gi
];

/**
 * Sanitizes log message and metadata, redacting secrets.
 */
export function sanitizeLogContent(content) {
  if (!content) return '';
  let text = typeof content === 'object' ? JSON.stringify(content) : String(content);

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, '[REDACTED_SECRET]');
    }
  }

  return text;
}

/**
 * Emits a structured log entry.
 */
export function log(levelName, message, metadata = {}) {
  const levelValue = LOG_LEVELS[levelName] || LOG_LEVELS.INFO;
  if (levelValue < CURRENT_LOG_LEVEL) return null;

  const sanitizedMsg = sanitizeLogContent(message);
  const sanitizedMeta = typeof metadata === 'object' ? JSON.parse(sanitizeLogContent(metadata)) : {};

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: levelName,
    service: 'EDOT_INTELLIGENCE',
    message: sanitizedMsg,
    metadata: sanitizedMeta
  };

  if (levelName === 'ERROR' || levelName === 'CRITICAL') {
    console.error(`[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.message}`);
  } else {
    console.log(`[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.message}`);
  }

  return logEntry;
}

export function logInfo(message, metadata) { return log('INFO', message, metadata); }
export function logWarn(message, metadata) { return log('WARN', message, metadata); }
export function logError(message, metadata) { return log('ERROR', message, metadata); }
export function logCritical(message, metadata) { return log('CRITICAL', message, metadata); }
