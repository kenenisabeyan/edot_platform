/**
 * EDOT Intelligence Domain - Secure Learning Context Builder
 * Assembles authorized learner context & grounded course knowledge.
 * 
 * Uses the Dynamic Course Intelligence Onboarding Pipeline's KnowledgeDocument
 * store for rich, structured course knowledge with strict enrollment isolation.
 * Falls back to legacy CourseIntelligenceDocument if the new system has no data yet.
 */

import { prisma } from '../../../lib/prisma.js';
import { getAuthorizedCourseKnowledgeContext } from '../onboarding/courseOnboardingPipeline.js';
import { resolveLearnerContext } from '../personalLearning/learnerContextResolver.js';
import { getOrUpdateLearningPlan } from '../personalLearning/learningPlanService.js';

/**
 * Builds a secure, sanitized context object for a student's mentor query.
 * 
 * Synthesizes 9 Key Inputs:
 * 1. Course Content & Lessons
 * 2. Phase 8 Knowledge Graph & Relationships
 * 3. Current Lesson & Section Context
 * 4. Learner Profile & Goals
 * 5. Phase 9 Mastery Intelligence (Mastery States & Evidence)
 * 6. Phase 3 Learning Pulse & Fatigue Signals
 * 7. Phase 10 Personal Learning Plan & Next Best Action
 * 8. Misconception Signals & Weaknesses
 * 9. Authorized Student Data & Multi-Course Privacy
 * 
 * @param {string} userId 
 * @param {object} options 
 * @param {string} [options.courseId]
 * @param {string} [options.lessonId]
 * @returns {Promise<object>} Secure Learning Context
 */
export async function buildStudentLearningContext(userId, options = {}) {
  const { courseId, lessonId } = options;

  const [
    user,
    profile,
    skills,
    weaknesses,
    progressRecords,
    quizAttempts,
    courseDoc
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true }
    }),
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.learnerSkill.findMany({ where: { userId }, take: 10 }),
    prisma.learnerWeakness.findMany({ where: { userId }, take: 5 }),
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, mainCategory: true, description: true } } }
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    courseId ? prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: { orderBy: { order: 'asc' } } }
    }) : null
  ]);

  const currentCourse = courseDoc || (progressRecords[0]?.course || null);
  const activeCourseId = currentCourse?.id || null;
  const lessons = currentCourse?.lessons || [];
  const currentLesson = lessonId ? lessons.find(l => l.id === lessonId) : lessons[0];

  // Fetch Phase 10 Learner Context & Personal Learning Plan
  let personalLearningContext = null;
  let personalLearningPlanResult = null;
  if (activeCourseId) {
    try {
      personalLearningContext = await resolveLearnerContext(userId, activeCourseId);
      personalLearningPlanResult = await getOrUpdateLearningPlan(userId, activeCourseId);
    } catch (e) {
      console.warn('[ContextBuilder] Personal learning engine context resolution fallback:', e.message);
    }
  }

  const completedLessonsList = progressRecords.flatMap(p => 
    Array.isArray(p.completedLessons) ? p.completedLessons : []
  );

  const totalQuizCount = quizAttempts.length;
  const correctQuizCount = quizAttempts.filter(q => q.isCorrect).length;
  const quizAccuracyPercent = totalQuizCount > 0 ? Math.round((correctQuizCount / totalQuizCount) * 100) : 75;

  // ── Grounded Knowledge Retrieval (KnowledgeDocument Pipeline → Legacy Fallback) ──
  let groundedKnowledge = null;
  let knowledgeSources = [];

  if (currentCourse) {
    try {
      // Primary: Use the new Authorized Knowledge Base from the Onboarding Pipeline
      const authorizedCtx = await getAuthorizedCourseKnowledgeContext(userId, currentCourse.id, lessonId);
      if (authorizedCtx.authorized && authorizedCtx.knowledgeChunks.length > 0) {
        groundedKnowledge = authorizedCtx.knowledgeChunks.join('\n---\n');
        knowledgeSources = [authorizedCtx.courseTitle];
      }
    } catch (err) {
      console.warn('[ContextBuilder] KnowledgeDocument retrieval failed, trying legacy:', err.message);
    }

    // Fallback: Legacy CourseIntelligenceDocument system
    if (!groundedKnowledge) {
      try {
        const doc = await prisma.courseIntelligenceDocument.findFirst({
          where: { courseId: currentCourse.id },
          include: { chunks: { take: 3 } }
        });
        if (doc && doc.chunks.length > 0) {
          groundedKnowledge = doc.chunks.map(c => c.content).join('\n---\n');
        }
      } catch (legacyErr) {
        console.warn('[ContextBuilder] Legacy knowledge also unavailable:', legacyErr.message);
      }
    }
  }

  const nextAction = personalLearningPlanResult?.primaryAction || {
    actionType: profile?.recommendedNextAction || 'CONTINUE_CURRENT_LESSON',
    explanation: 'Continue module exercises'
  };

  // ── Phase 12: Career Intelligence Context (failure-isolated) ──────────────
  let careerContext = null;
  try {
    const { getCareerInterests, getCareerGoals, getStudentSkillProfile } =
      await import('../career/careerIntelligenceService.js');
    const [careerInterests, careerGoals, skillProfileData] = await Promise.all([
      getCareerInterests(userId).catch(() => []),
      getCareerGoals(userId).catch(() => []),
      getStudentSkillProfile(userId).catch(() => null)
    ]);

    careerContext = {
      activeInterests: careerInterests
        .filter(i => i.status === 'ACTIVE')
        .map(i => i.interestText)
        .slice(0, 5),
      activeGoals: careerGoals
        .filter(g => g.status === 'ACTIVE')
        .map(g => `${g.title} (${g.type})`)
        .slice(0, 3),
      skillSummary: skillProfileData
        ? {
            strongEvidence: skillProfileData.summary.strongEvidence,
            developing: skillProfileData.summary.developing,
            notStarted: skillProfileData.summary.notStarted,
            topSkills: skillProfileData.skills
              .filter(s => ['STRONG_EVIDENCE', 'DEMONSTRATING'].includes(s.evidenceState))
              .slice(0, 5)
              .map(s => `${s.name} (${s.evidenceState.toLowerCase().replace('_', ' ')})`)
          }
        : null
    };
  } catch {
    // Career intelligence context is non-critical; mentor still functions without it
  }

  // Phase 13 Project & Portfolio Intelligence context (failure-isolated)
  let projectContext = null;
  try {
    const { getPortfolioIntelligence } = await import('../projects/projectService.js');
    const portfolioIntel = await getPortfolioIntelligence(userId);
    projectContext = {
      portfolioCount: portfolioIntel.portfolioCount,
      publishedProjects: portfolioIntel.portfolioItems.slice(0, 3).map(p => ({
        title: p.title,
        demonstratedSkills: p.demonstratedSkills
      })),
      projectSuggestions: portfolioIntel.portfolioSuggestions.slice(0, 3).map(s => s.suggestionMessage)
    };
  } catch {
    // Project intelligence context is non-critical; mentor still functions without it
  }

  // Phase 14 Human, Mentorship & Collaboration context (failure-isolated)
  let collaborationContext = null;
  try {
    const { getRecommendedMentors, getRecommendedPeers, getRecommendedCommunities } = await import('../collaboration/collaborationService.js');
    const [mentors, peerData, communities] = await Promise.all([
      getRecommendedMentors(userId).catch(() => []),
      getRecommendedPeers(userId).catch(() => ({ isDiscoverable: false, peers: [] })),
      getRecommendedCommunities(userId).catch(() => [])
    ]);

    collaborationContext = {
      recommendedMentors: mentors.slice(0, 3).map(m => ({ name: m.name, matchReason: m.matchReason })),
      peerDiscoverability: peerData.isDiscoverable,
      recommendedPeersCount: peerData.peers?.length || 0,
      recommendedCommunities: communities.slice(0, 3).map(c => c.name)
    };
  } catch {
    // Collaboration context is non-critical; mentor still functions without it
  }

  // Phase 15 Global Opportunity context (failure-isolated)
  let opportunityContext = null;
  try {
    const { getRecommendedOpportunities, getStudentApplications, getStudentConsents } = await import('../opportunities/opportunityService.js');
    const [opps, apps, consents] = await Promise.all([
      getRecommendedOpportunities(userId).catch(() => []),
      getStudentApplications(userId).catch(() => []),
      getStudentConsents(userId).catch(() => ({ consents: {} }))
    ]);

    opportunityContext = {
      recommendedOpportunities: opps.slice(0, 3).map(o => ({ title: o.title, alignment: o.alignmentCategory })),
      activeApplicationsCount: apps.length,
      consentGranted: Object.values(consents.consents || {}).filter(Boolean).length
    };
  } catch {
    // Opportunity context is non-critical; mentor still functions without it
  }

  return {
    learnerName: user?.name || 'Student',
    academicLevel: profile?.academicLevel || 'Intermediate',
    goals: Array.isArray(profile?.learningGoals) ? profile.learningGoals : ['Master course concepts'],
    interests: Array.isArray(profile?.interests) ? profile.interests : ['Technology'],
    currentCourseTitle: currentCourse?.title || 'General Curriculum',
    currentLessonTitle: currentLesson?.title || 'Current Module',
    completedLessonsCount: completedLessonsList.length,
    recentQuizPerformance: {
      attempts: totalQuizCount,
      accuracyPercent: quizAccuracyPercent
    },
    pulse: personalLearningContext?.pulse || { isFatigued: false },
    masteryStates: personalLearningContext?.masteries?.map(m => `${m.node?.name || 'Concept'}: ${m.masteryState}`) || [],
    prerequisiteGaps: personalLearningContext?.prerequisiteGaps || [],
    identifiedWeakSkills: weaknesses.map(w => w.topic),
    skillsMastery: skills.map(s => `${s.name} (${s.proficiencyLevel})`),
    personalLearningPlan: personalLearningPlanResult?.plan || null,
    recommendedNextAction: nextAction,
    groundedKnowledge: groundedKnowledge || (currentLesson ? `Lesson "${currentLesson.title}": ${currentLesson.description || currentLesson.summary || 'Core concept lesson'}` : null),
    knowledgeAvailable: Boolean(groundedKnowledge || currentLesson),
    sources: knowledgeSources.length > 0 ? knowledgeSources : [currentCourse?.title, currentLesson?.title].filter(Boolean),
    // Phase 12 Career Intelligence context
    careerContext,
    // Phase 13 Project & Portfolio Intelligence context
    projectContext,
    // Phase 14 Collaboration & Mentorship context
    collaborationContext,
    // Phase 15 Global Opportunity context
    opportunityContext
  };
}
