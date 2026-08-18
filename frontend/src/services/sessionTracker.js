/**
 * sessionTracker.js
 *
 * Manages LearningSession lifecycle for the EDOT Intelligence Core.
 *
 * Usage — inside a React component:
 *
 *   import sessionTracker from '../services/sessionTracker';
 *
 *   useEffect(() => {
 *     sessionTracker.start({ courseId, lessonId, pageContext: 'lesson' });
 *     return () => sessionTracker.end();
 *   }, [lessonId]);
 */

import { startSession, endSession } from './intelligenceApi.js';

class SessionTracker {
  constructor() {
    this._sessionId = null;
    this._startTime = null;
    this._active = false;
  }

  /**
   * Start a new learning session.
   * Silently no-ops if a session is already active.
   *
   * @param {{ courseId?: string, lessonId?: string, pageContext?: string }} context
   */
  async start(context = {}) {
    if (this._active) return;

    try {
      this._startTime = Date.now();
      const result = await startSession(context);
      if (result?.data?.sessionId) {
        this._sessionId = result.data.sessionId;
        this._active = true;
      }
    } catch {
      // Never throw — session tracking is non-critical
    }
  }

  /**
   * End the current session.
   * Automatically calculates duration from start time.
   * Silently no-ops if no session is active.
   */
  async end() {
    if (!this._active || !this._sessionId) return;

    try {
      const durationSeconds = this._startTime
        ? Math.round((Date.now() - this._startTime) / 1000)
        : 0;

      await endSession({ sessionId: this._sessionId, durationSeconds });
    } catch {
      // Non-critical
    } finally {
      this._sessionId = null;
      this._startTime = null;
      this._active = false;
    }
  }

  /** True if a session is currently active. */
  get isActive() {
    return this._active;
  }
}

// Singleton — one active session per browser tab at a time
const sessionTracker = new SessionTracker();
export default sessionTracker;
