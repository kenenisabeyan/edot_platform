/**
 * EDOT Intelligence Core - Module Entry Point
 * Exposes domain services, background event pipeline, and routing.
 */

import intelligenceRouter from './routes.js';
import { eventBus } from './shared/eventBus.js';
import { initializeEventSubscribers } from './events/eventHandlers.js';
import * as eventContracts from './shared/contracts.js';

// Services
export * as EventService from './events/eventService.js';
export * as ProfileService from './profile/profileService.js';
export * as AnalyticsService from './analytics/analyticsService.js';
export * as MentorService from './mentor/mentorService.js';
export * as RecommendationService from './recommendations/recommendationService.js';
export * as CourseIntelligenceService from './course-intelligence/courseIntelligenceService.js';
export * as CareerIntelligenceService from './career/careerIntelligenceService.js';
export * as ProjectIntelligenceService from './projects/projectService.js';
export * as CollaborationService from './collaboration/collaborationService.js';
export * as OpportunityIntelligenceService from './opportunities/opportunityService.js';
export * as ExperienceIntelligenceService from './experience/edotIntelligenceExperienceService.js';
export * as ProductAuditService from './audit/auditService.js';
export * as PilotValidationService from './pilot/pilotService.js';
export * as AIQualityService from './ai-quality/aiQualityOrchestrator.js';
export * as PerformanceService from './performance/performanceOrchestrator.js';
export * as ProductionReadinessService from './production/productionOrchestrator.js';
export * as HyperscaleService from './hyperscale/hyperscaleOrchestrator.js';

/**
 * Initializes the Intelligence Subsystem and background event handlers.
 * 
 * @param {import('express').Application} app 
 * @param {string} mountPath 
 */
export function initializeIntelligenceCore(app, mountPath = '/api/v2/intelligence') {
  // Initialize background event bus listeners
  initializeEventSubscribers();

  // Mount API endpoints
  if (app) {
    app.use(mountPath, intelligenceRouter);
    console.log(`🧠 EDOT Intelligence Core mounted at ${mountPath}`);
  }
}

export { intelligenceRouter, eventBus, eventContracts };
export default initializeIntelligenceCore;
