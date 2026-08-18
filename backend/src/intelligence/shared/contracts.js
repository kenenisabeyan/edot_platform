/**
 * EDOT Intelligence Domain - Shared Contracts & Types
 * Defines the foundational event types, schemas, and error definitions
 * for the Intelligence Core without coupling to business modules.
 */

export const EventTypes = {
  // Lesson & Progress Events
  LESSON_STARTED: 'LESSON_STARTED',
  LESSON_HEARTBEAT: 'LESSON_HEARTBEAT',
  LESSON_COMPLETED: 'LESSON_COMPLETED',
  VIDEO_PROGRESS: 'VIDEO_PROGRESS',

  // Assessment & Challenge Events
  QUIZ_ATTEMPTED: 'QUIZ_ATTEMPTED',
  QUIZ_COMPLETED: 'QUIZ_COMPLETED',
  EXAM_SUBMITTED: 'EXAM_SUBMITTED',

  // Session & Engagement Events
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',
  RESOURCE_ACCESSED: 'RESOURCE_ACCESSED',

  // Growth & Milestone Events
  SKILL_EVALUATED: 'SKILL_EVALUATED',
  WEAKNESS_FLAGGED: 'WEAKNESS_FLAGGED',
  MILESTONE_REACHED: 'MILESTONE_REACHED',
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',

  // Mentorship & Guidance Events
  MENTOR_QUERY: 'MENTOR_QUERY',
  RECOMMENDATION_ACTED: 'RECOMMENDATION_ACTED'
};

export const RiskLevels = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const ProficiencyLevels = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  MASTER: 'master'
};
