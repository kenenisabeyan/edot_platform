/**
 * intelligenceApi.js
 *
 * Typed API wrappers for the EDOT Intelligence Core endpoints.
 * Supports Dynamic Learner Intelligence, Multi-Level Hierarchy, Learning Events, and Real-Time Telemetry.
 * All functions return { success, data } or throw.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';

async function request(method, path, body) {
  const options = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();
  return data;
}

// ─── Dynamic Learner Intelligence & Multi-Level Hierarchy ────────────────────

/**
 * Fetch complete multi-level learner intelligence hierarchy:
 * Learner -> Global Intelligence -> Category Intelligence -> Course Intelligence -> Section Intelligence -> Lesson Intelligence
 * @param {{ courseId?: string, lessonId?: string, sectionId?: string }} params
 */
export const getLearnerHierarchy = (params = {}) => {
  const query = new URLSearchParams();
  if (params.courseId) query.append('courseId', params.courseId);
  if (params.lessonId) query.append('lessonId', params.lessonId);
  if (params.sectionId) query.append('sectionId', params.sectionId);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return request('GET', `/intelligence/profile/hierarchy${qs}`);
};

/** Fetch the current user's full relational learner profile. */
export const getMyLearnerProfile = () => request('GET', '/intelligence/profile/me');

/** Resynchronize the learner profile using the latest learning events. */
export const refreshLearnerProfile = () => request('POST', '/intelligence/profile/refresh');

/**
 * Publish a learning event into the unified event pipeline.
 * @param {object} eventPayload
 */
export const publishLearningEvent = (eventPayload) =>
  request('POST', '/learning/events', eventPayload);

// ─── Wave 1: Recommendations & Next Best Action ─────────────────────────────

/** Fetch personalized course recommendations for the current user. */
export const getRecommendations = () => request('GET', '/recommendations/me');

/**
 * Record that the user acted on a recommendation.
 * @param {{ targetTitle: string, recommendationType?: string, targetId?: string, reason?: string, score?: number, actionType: 'enrolled'|'viewed'|'dismissed' }} feedback
 */
export const sendRecommendationFeedback = (feedback) =>
  request('POST', '/recommendations/feedback', feedback);

// ─── Wave 2: Quiz attempts ────────────────────────────────────────────────────

/**
 * Record a single quiz question attempt.
 * @param {{ courseId: string, lessonId?: string, quizId?: string, questionIndex: number,
 *            question: string, selectedAnswer: string, correctAnswer: string,
 *            isCorrect: boolean, topic?: string, timeSpentSeconds?: number }} attempt
 */
export const recordQuizAttempt = (attempt) =>
  request('POST', '/intelligence/quiz-attempts', attempt);

/**
 * Get quiz attempt history with per-topic accuracy breakdown.
 * @param {string} courseId
 */
export const getQuizAttempts = (courseId) =>
  request('GET', `/intelligence/quiz-attempts/${courseId}`);

// ─── Wave 3: Learning sessions ────────────────────────────────────────────────

/**
 * Start a learning session. Returns { sessionId }.
 * @param {{ courseId?: string, lessonId?: string, pageContext?: string, deviceType?: string }} context
 */
export const startSession = (context = {}) =>
  request('POST', '/intelligence/sessions/start', context);

/**
 * End a learning session.
 * @param {{ sessionId: string, durationSeconds?: number }} data
 */
export const endSession = (data) =>
  request('POST', '/intelligence/sessions/end', data);

// ─── Wave 4: Analytics ───────────────────────────────────────────────────────

/** Get the current user's analytics report (risk level, scores, etc.). */
export const getMyAnalytics = () => request('GET', '/intelligence/analytics/me');

/** Admin only: Get list of at-risk learners. */
export const getAtRiskLearners = (limit = 20) =>
  request('GET', `/intelligence/analytics/admin/at-risk?limit=${limit}`);

// ─── Learning profile ─────────────────────────────────────────────────────────

/** Get the current user's full learning profile including skills and weaknesses. */
export const getMyProfile = () => request('GET', '/learning-profile/me');

/** Sync the learning profile with derived data. */
export const syncProfile = (data = {}) => request('POST', '/learning-profile/sync', data);

/** Record a learning history event. */
export const recordLearningEvent = (event) => request('POST', '/learning-profile/events', event);

export default {
  getLearnerHierarchy,
  getMyLearnerProfile,
  refreshLearnerProfile,
  publishLearningEvent,
  getRecommendations,
  sendRecommendationFeedback,
  recordQuizAttempt,
  getQuizAttempts,
  startSession,
  endSession,
  getMyAnalytics,
  getAtRiskLearners,
  getMyProfile,
  syncProfile,
  recordLearningEvent
};
