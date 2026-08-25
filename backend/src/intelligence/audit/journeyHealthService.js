/**
 * EDOT Intelligence Domain - Student Journey Health Engine
 * Evaluates product health across 9 core student journeys (HEALTHY, FRICTION_DETECTED, CONFUSION_DETECTED, ABANDONMENT_RISK, INSUFFICIENT_DATA).
 */

import { prisma } from '../../../lib/prisma.js';

export const CORE_JOURNEYS = {
  ONBOARDING: 'New Student Onboarding',
  RETURNING: 'Returning Student Action',
  REMEDIATION: 'Student Struggles & Support',
  MENTOR_CHAT: 'AI Mentor Interaction',
  SKILL_BUILDING: 'Skill & Project Building',
  PORTFOLIO_PUB: 'Portfolio Publication',
  CAREER_DISCOVERY: 'Career Exploration',
  OPPORTUNITY_PREP: 'Opportunity Discovery & Preparation',
  HUMAN_SUPPORT: 'Human Support Connection'
};

/**
 * Evaluates platform-wide journey health metrics (Admin view).
 */
export async function evaluateJourneyHealth() {
  const events = await prisma.productExperienceEvent.findMany({
    take: 1000,
    orderBy: { createdAt: 'desc' }
  });

  const journeyStats = {};

  for (const [key, name] of Object.entries(CORE_JOURNEYS)) {
    journeyStats[key] = {
      journeyKey: key,
      journeyName: name,
      totalEvents: 0,
      dismissedCount: 0,
      abandonedCount: 0,
      completedCount: 0,
      healthStatus: 'INSUFFICIENT_DATA'
    };
  }

  for (const ev of events) {
    if (ev.journeyKey && journeyStats[ev.journeyKey]) {
      const stats = journeyStats[ev.journeyKey];
      stats.totalEvents++;
      if (ev.eventType === 'DISMISSED') stats.dismissedCount++;
      if (ev.eventType === 'ABANDONED') stats.abandonedCount++;
      if (ev.eventType === 'COMPLETED') stats.completedCount++;
    }
  }

  for (const key of Object.keys(journeyStats)) {
    const s = journeyStats[key];
    if (s.totalEvents === 0) {
      s.healthStatus = 'INSUFFICIENT_DATA';
    } else if (s.abandonedCount > s.completedCount && s.abandonedCount >= 3) {
      s.healthStatus = 'ABANDONMENT_RISK';
    } else if (s.dismissedCount > s.completedCount && s.dismissedCount >= 3) {
      s.healthStatus = 'CONFUSION_DETECTED';
    } else if (s.abandonedCount > 0 || s.dismissedCount > 0) {
      s.healthStatus = 'FRICTION_DETECTED';
    } else {
      s.healthStatus = 'HEALTHY';
    }
  }

  return {
    evaluatedAt: new Date().toISOString(),
    journeys: Object.values(journeyStats)
  };
}
