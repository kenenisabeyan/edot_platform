/**
 * EDOT Intelligence Domain - Shared Contracts & Event Definitions
 * Defines all standard learning event types, proficiency levels, and risk constants.
 */

export const EventTypes = {
  // Lesson Events
  LESSON_STARTED: 'LESSON_STARTED',
  LESSON_VIEWED: 'LESSON_VIEWED',
  LESSON_COMPLETED: 'LESSON_COMPLETED',

  // Video Learning Events
  VIDEO_STARTED: 'VIDEO_STARTED',
  VIDEO_PROGRESS: 'VIDEO_PROGRESS',
  VIDEO_PAUSED: 'VIDEO_PAUSED',
  VIDEO_COMPLETED: 'VIDEO_COMPLETED',

  // Assessment & Quiz Events
  QUIZ_STARTED: 'QUIZ_STARTED',
  QUIZ_ANSWERED: 'QUIZ_ANSWERED',
  QUIZ_COMPLETED: 'QUIZ_COMPLETED',
  QUIZ_FAILED: 'QUIZ_FAILED',

  // Assignment Events
  ASSIGNMENT_STARTED: 'ASSIGNMENT_STARTED',
  ASSIGNMENT_SUBMITTED: 'ASSIGNMENT_SUBMITTED',
  ASSIGNMENT_GRADED: 'ASSIGNMENT_GRADED',

  // Course Lifecycle Events
  COURSE_ENROLLED: 'COURSE_ENROLLED',
  COURSE_STARTED: 'COURSE_STARTED',
  COURSE_COMPLETED: 'COURSE_COMPLETED',

  // Attendance Events
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',

  // Authentication & Session Events
  LOGIN: 'LOGIN',
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',

  // Growth & Guidance Events
  SKILL_EVALUATED: 'SKILL_EVALUATED',
  WEAKNESS_FLAGGED: 'WEAKNESS_FLAGGED',
  MILESTONE_REACHED: 'MILESTONE_REACHED',
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
  MENTOR_QUERY: 'MENTOR_QUERY',
  RECOMMENDATION_ACTED: 'RECOMMENDATION_ACTED'
};

export const StandardEventTypeList = Object.values(EventTypes);

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
