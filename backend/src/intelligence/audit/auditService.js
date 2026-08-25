/**
 * EDOT Intelligence Domain - Product Experience Audit Master Orchestrator
 * Coordinates telemetry logging, journey health evaluation, recommendation feedback, AI Mentor quality ratings,
 * system availability states, empty state guidance, and admin product health analytics.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import { logExperienceEvent, getFeatureAdoptionMetrics } from './productExperienceAuditService.js';
import { evaluateJourneyHealth, CORE_JOURNEYS } from './journeyHealthService.js';
import { recordRecommendationFeedback, shouldSuppressRecommendation } from './recommendationExperienceFeedbackService.js';
import { detectFrictionSignals } from './experienceFrictionDetectionService.js';

export {
  logExperienceEvent,
  getFeatureAdoptionMetrics,
  evaluateJourneyHealth,
  CORE_JOURNEYS,
  recordRecommendationFeedback,
  shouldSuppressRecommendation,
  detectFrictionSignals
};

/**
 * Records lightweight AI Mentor response feedback.
 */
export async function recordAIMentorFeedback(userId, messageId, rating, reasonCategory = null) {
  assertValidUUID(userId, 'userId');

  const validRatings = ['HELPFUL', 'NOT_HELPFUL'];
  if (!validRatings.includes(rating)) {
    throw new Error(`Invalid rating: ${rating}`);
  }

  return prisma.aIMentorFeedback.create({
    data: {
      userId,
      messageId: String(messageId),
      rating,
      reasonCategory: reasonCategory ? String(reasonCategory).toUpperCase() : null
    }
  });
}

/**
 * Returns human-friendly system availability status for an intelligence feature.
 */
export function getSystemAvailabilityState(featureKey, isError = false, hasData = true) {
  if (isError) {
    return {
      status: 'TEMPORARILY_UNAVAILABLE',
      humanMessage: 'We couldn\'t load this section right now. You can continue learning normally.',
      canRetry: true
    };
  }
  if (!hasData) {
    return {
      status: 'INSUFFICIENT_DATA',
      humanMessage: 'As you complete lessons and build projects, recommendations will become more tailored.',
      canRetry: false
    };
  }
  return {
    status: 'AVAILABLE',
    humanMessage: 'Feature is active and up to date.',
    canRetry: false
  };
}

/**
 * Returns empty state guidance cards for new students.
 */
export function getEmptyStateGuidance(sectionKey) {
  switch (String(sectionKey).toUpperCase()) {
    case 'MY_SKILLS':
      return {
        title: 'Build Your Skill Profile',
        description: 'You haven\'t built enough evidence yet. Start learning or complete a project to begin building your skill profile.',
        actionText: 'Explore Courses',
        actionCode: 'EXPLORE_COURSES'
      };
    case 'MY_PROJECTS':
      return {
        title: 'Start Your First Project Challenge',
        description: 'Hands-on projects provide verified evidence of your capabilities for mentors and future opportunities.',
        actionText: 'Browse Projects',
        actionCode: 'BROWSE_PROJECTS'
      };
    case 'OPPORTUNITIES':
      return {
        title: 'Discover Career Opportunities',
        description: 'Set your career targets and build project evidence to unlock tailored job and internship recommendations.',
        actionText: 'Set Career Goals',
        actionCode: 'SET_CAREER_GOALS'
      };
    default:
      return {
        title: 'Let\'s Get Started',
        description: 'Explore courses to begin your personal learning journey.',
        actionText: 'Start Learning',
        actionCode: 'START_LEARNING'
      };
  }
}

/**
 * Admin Product Experience Health Summary.
 */
export async function getAdminProductExperienceHealth() {
  const [featureAdoption, journeyHealth, totalFeedbacks, aiFeedbacks] = await Promise.all([
    getFeatureAdoptionMetrics(),
    evaluateJourneyHealth(),
    prisma.recommendationFeedback.count(),
    prisma.aIMentorFeedback.findMany({ take: 100, orderBy: { createdAt: 'desc' } })
  ]);

  const helpfulCount = aiFeedbacks.filter(f => f.rating === 'HELPFUL').length;
  const aiUsefulnessRate = aiFeedbacks.length > 0 ? Math.round((helpfulCount / aiFeedbacks.length) * 100) : 100;

  return {
    totalEventsLogged: featureAdoption.totalEventsLogged,
    totalRecommendationFeedbacks: totalFeedbacks,
    aiMentorUsefulnessPercent: aiUsefulnessRate,
    journeyHealth: journeyHealth.journeys,
    featureAdoption: featureAdoption.featureAdoption,
    generatedAt: new Date().toISOString()
  };
}
