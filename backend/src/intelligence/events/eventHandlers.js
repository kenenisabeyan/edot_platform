/**
 * EDOT Intelligence Domain - Event Handlers / Subscribers
 * Subscribes to learning events and coordinates intelligence recalculations.
 */

import { eventBus } from '../shared/eventBus.js';
import { EventTypes } from '../shared/contracts.js';
import { syncLearnerProfile } from '../profile/profileService.js';
import { getLearnerAnalytics } from '../analytics/analyticsService.js';

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

  console.log('⚡ EDOT Intelligence Core: Event Subscribers Active');
}
