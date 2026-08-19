/**
 * EDOT Intelligence Domain - Event Handlers / Subscribers
 * Subscribes to learning events and coordinates intelligence recalculations.
 */

import { eventBus } from '../shared/eventBus.js';
import { EventTypes } from '../shared/contracts.js';
import { syncLearnerProfile } from '../profile/profileService.js';
import { getLearnerAnalytics } from '../analytics/analyticsService.js';
import {
  onCategoryCreated,
  onCourseCreated,
  onSectionCreated,
  onLessonCreated,
  onQuizCreated,
  onAssignmentCreated,
  onContentUpdated,
  onContentDeleted
} from '../dynamic/dynamicContentIntelligenceEngine.js';

export function initializeEventSubscribers() {
  // Sync profile when progress milestones occur
  const syncTriggers = [
    EventTypes.LESSON_COMPLETED,
    EventTypes.QUIZ_COMPLETED,
    EventTypes.EXAM_SUBMITTED,
    EventTypes.SESSION_ENDED,
    EventTypes.CERTIFICATE_ISSUED
  ];

  syncTriggers.forEach((eventType) => {
    eventBus.subscribe(eventType, async (eventData) => {
      if (eventData.userId) {
        // Asynchronously update profile & analytics without blocking origin
        await syncLearnerProfile(eventData.userId).catch(() => {});
        await getLearnerAnalytics(eventData.userId).catch(() => {});
      }
    });
  });

  // Universal Dynamic Content Intelligence Lifecycle Subscribers
  eventBus.subscribe('CATEGORY_CREATED', async (payload) => {
    await onCategoryCreated(payload).catch((err) => console.error('[EventBus] CATEGORY_CREATED error:', err.message));
  });

  eventBus.subscribe('COURSE_CREATED', async (payload) => {
    await onCourseCreated(payload).catch((err) => console.error('[EventBus] COURSE_CREATED error:', err.message));
  });

  eventBus.subscribe('SECTION_CREATED', async (payload) => {
    await onSectionCreated(payload).catch((err) => console.error('[EventBus] SECTION_CREATED error:', err.message));
  });

  eventBus.subscribe('LESSON_CREATED', async (payload) => {
    await onLessonCreated(payload).catch((err) => console.error('[EventBus] LESSON_CREATED error:', err.message));
  });

  eventBus.subscribe('QUIZ_CREATED', async (payload) => {
    await onQuizCreated(payload).catch((err) => console.error('[EventBus] QUIZ_CREATED error:', err.message));
  });

  eventBus.subscribe('ASSIGNMENT_CREATED', async (payload) => {
    await onAssignmentCreated(payload).catch((err) => console.error('[EventBus] ASSIGNMENT_CREATED error:', err.message));
  });

  eventBus.subscribe('CONTENT_UPDATED', async (payload) => {
    await onContentUpdated(payload).catch((err) => console.error('[EventBus] CONTENT_UPDATED error:', err.message));
  });

  eventBus.subscribe('CONTENT_DELETED', async (payload) => {
    await onContentDeleted(payload).catch((err) => console.error('[EventBus] CONTENT_DELETED error:', err.message));
  });

  console.log('⚡ EDOT Intelligence Core: Event Subscribers Active (Learner & Content Lifecycles)');
}

