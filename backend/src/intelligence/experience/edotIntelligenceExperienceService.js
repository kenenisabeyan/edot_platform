/**
 * EDOT Intelligence Domain - Unified Student Experience Service
 * Master orchestration service that gathers authorized signals across all 15 completed phases,
 * prioritizes actions (1 Primary + max 2 Secondary), and exposes simple human-centered student UX summaries.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import {
  generateStudentGreeting,
  translateMasteryStatus,
  translateSkillStatus,
  translateOpportunityAlignment,
  translateAdaptiveAction,
  translateGapStatus
} from './intelligenceExperienceTranslator.js';

/**
 * Generates the unified student dashboard experience overview.
 */
export async function getStudentExperienceOverview(studentId) {
  assertValidUUID(studentId, 'studentId');

  // Fetch student basic profile
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, createdAt: true }
  });

  const greeting = generateStudentGreeting(user?.name || 'Learner');

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Failure-Isolated Sub-Domain Data Retrieval
  // ─────────────────────────────────────────────────────────────────────────

  // Learning Progress & Active Course
  let learningSummary = { hasActiveCourse: false, activeCourseTitle: null, progressPercent: 0, nextLessonTitle: null };
  try {
    const activeEnrollment = await prisma.enrollment.findFirst({
      where: { userId: studentId, status: 'active' },
      include: { course: true }
    });

    if (activeEnrollment) {
      const progressLog = await prisma.progressLog.findFirst({
        where: { userId: studentId, courseId: activeEnrollment.courseId },
        orderBy: { updatedAt: 'desc' },
        include: { lesson: true }
      });

      learningSummary = {
        hasActiveCourse: true,
        activeCourseId: activeEnrollment.courseId,
        activeCourseTitle: activeEnrollment.course.title,
        progressPercent: activeEnrollment.progress || 0,
        nextLessonTitle: progressLog?.lesson?.title || 'Next Lesson',
        humanProgress: `${Math.round(activeEnrollment.progress || 0)}% completed`
      };
    }
  } catch {
    // Learning progress failure isolation
  }

  // Personal Learning Engine & Adaptive Actions (Phase 10)
  let adaptiveAction = null;
  try {
    const { getPersonalLearningPlan } = await import('../personal-learning/personalLearningService.js');
    if (learningSummary.activeCourseId) {
      const planResult = await getPersonalLearningPlan(studentId, learningSummary.activeCourseId);
      if (planResult?.primaryAction) {
        adaptiveAction = translateAdaptiveAction(
          planResult.primaryAction.actionType,
          planResult.primaryAction.targetNodeTitle || learningSummary.nextLessonTitle
        );
      }
    }
  } catch {
    // Personal learning engine failure isolation
  }

  // Skills Summary (Phase 12)
  let skillsSummary = { totalSkills: 0, topSkills: [] };
  try {
    const { getLearnerSkillPassport } = await import('../career/careerIntelligenceService.js');
    const passport = await getLearnerSkillPassport(studentId);
    if (passport && Array.isArray(passport.skills)) {
      skillsSummary = {
        totalSkills: passport.skills.length,
        topSkills: passport.skills.slice(0, 3).map(s => {
          const status = translateSkillStatus(s.evidenceCount, s.isVerified);
          return {
            name: s.skillName,
            statusLabel: status.label,
            statusCode: status.code,
            explanation: status.explanation
          };
        })
      };
    }
  } catch {
    // Skills failure isolation
  }

  // Projects Summary (Phase 13)
  let projectSummary = { activeProjectsCount: 0, recentProjects: [] };
  try {
    const { getStudentProjects } = await import('../projects/projectService.js');
    const projects = await getStudentProjects(studentId);
    if (Array.isArray(projects)) {
      projectSummary = {
        activeProjectsCount: projects.length,
        recentProjects: projects.slice(0, 2).map(p => ({
          title: p.title,
          status: p.status,
          type: p.projectType
        }))
      };
    }
  } catch {
    // Projects failure isolation
  }

  // Career Summary (Phase 12)
  let careerSummary = { primaryGoal: null, readinessStatus: 'EXPLORING' };
  try {
    const { getLearnerCareerGoals } = await import('../career/careerIntelligenceService.js');
    const goals = await getLearnerCareerGoals(studentId);
    if (Array.isArray(goals) && goals.length > 0) {
      careerSummary = {
        primaryGoal: goals[0].title,
        readinessStatus: goals[0].status || 'ACTIVE',
        humanSummary: `Building skills for ${goals[0].title}`
      };
    }
  } catch {
    // Career failure isolation
  }

  // Opportunity Summary (Phase 15)
  let opportunitySummary = { recommendedCount: 0, topOpportunity: null };
  try {
    const { getRecommendedOpportunities } = await import('../opportunities/opportunityService.js');
    const opps = await getRecommendedOpportunities(studentId);
    if (Array.isArray(opps) && opps.length > 0) {
      opportunitySummary = {
        recommendedCount: opps.length,
        topOpportunity: {
          title: opps[0].title,
          organization: opps[0].organization,
          alignmentText: translateOpportunityAlignment(opps[0].alignmentCategory)
        }
      };
    }
  } catch {
    // Opportunity failure isolation
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Action Prioritization System (1 Primary + Max 2 Secondary)
  // ─────────────────────────────────────────────────────────────────────────

  const allPossibleActions = [];

  // Critical / Adaptive Action
  if (adaptiveAction) {
    allPossibleActions.push({
      id: 'action-adaptive-1',
      category: 'CURRENT_LEARNING',
      title: `${adaptiveAction.actionLabel}: ${learningSummary.nextLessonTitle || 'Current Topic'}`,
      description: adaptiveAction.message,
      actionText: adaptiveAction.actionLabel,
      actionCode: adaptiveAction.code,
      whyText: 'EDOT recommended this based on your recent course progress to help strengthen your foundation.'
    });
  } else if (learningSummary.hasActiveCourse) {
    allPossibleActions.push({
      id: 'action-continue-course',
      category: 'CURRENT_LEARNING',
      title: `Continue ${learningSummary.activeCourseTitle}`,
      description: `Resume at ${learningSummary.nextLessonTitle || 'your next module'} to maintain your learning momentum.`,
      actionText: 'Continue Learning',
      actionCode: 'CONTINUE',
      whyText: 'Continuing your active course is the most direct step toward building certified skills.'
    });
  }

  // Project Action
  if (projectSummary.activeProjectsCount > 0) {
    allPossibleActions.push({
      id: 'action-project-1',
      category: 'PROJECT_PROGRESS',
      title: `Work on Project: ${projectSummary.recentProjects[0].title}`,
      description: 'Add project milestones or request feedback to build verified portfolio evidence.',
      actionText: 'Open Project Workspace',
      actionCode: 'PROJECT',
      whyText: 'Working on practical projects turns your conceptual knowledge into demonstrated portfolio evidence.'
    });
  } else if (skillsSummary.totalSkills > 0) {
    allPossibleActions.push({
      id: 'action-build-project',
      category: 'PROJECT_PROGRESS',
      title: 'Start a Practical Hands-On Project',
      description: 'Demonstrate your skills by working on a real-world project challenge.',
      actionText: 'Explore Projects',
      actionCode: 'BUILD_PROJECT',
      whyText: 'Creating projects provides proof of your capabilities for mentors and future opportunities.'
    });
  }

  // Opportunity Action
  if (opportunitySummary.topOpportunity) {
    allPossibleActions.push({
      id: 'action-opp-1',
      category: 'OPPORTUNITY_PREPARATION',
      title: `Explore Opportunity: ${opportunitySummary.topOpportunity.title}`,
      description: opportunitySummary.topOpportunity.alignmentText,
      actionText: 'View Opportunity',
      actionCode: 'OPPORTUNITY',
      whyText: 'This opportunity aligns with your learning path and career goals.'
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. New / Empty Student Onboarding Handling
  // ─────────────────────────────────────────────────────────────────────────

  const isNewStudent = !learningSummary.hasActiveCourse && skillsSummary.totalSkills === 0;

  if (isNewStudent) {
    return {
      greeting: `Welcome to EDOT, ${user?.name || 'Learner'}!`,
      isNewStudent: true,
      journeySummary: 'Let\'s get started on your personal learning journey.',
      primaryAction: {
        id: 'action-onboard-1',
        category: 'EXPLORATION',
        title: 'Explore Courses & Learning Paths',
        description: 'Choose a course that matches your interests to start building skills today.',
        actionText: 'Browse Courses',
        actionCode: 'EXPLORE',
        whyText: 'Starting your first course provides the foundation for personal learning recommendations.'
      },
      secondaryActions: [
        {
          id: 'action-onboard-2',
          category: 'CAREER_PREPARATION',
          title: 'Set Your Career Interests',
          description: 'Tell EDOT what roles or domains interest you to tailor recommendations.',
          actionText: 'Set Career Goals',
          actionCode: 'SET_GOALS',
          whyText: 'Setting career goals helps EDOT match you with relevant projects and opportunities.'
        }
      ],
      learningSummary,
      skillsSummary: { totalSkills: 0, topSkills: [] },
      projectSummary: { activeProjectsCount: 0, recentProjects: [] },
      careerSummary: { primaryGoal: null, readinessStatus: 'NOT_STARTED' },
      opportunitySummary: { recommendedCount: 0, topOpportunity: null },
      generatedAt: new Date().toISOString()
    };
  }

  // Select 1 Primary Action + Max 2 Secondary Actions
  const primaryAction = allPossibleActions[0] || {
    id: 'action-fallback-1',
    category: 'CURRENT_LEARNING',
    title: 'Continue Your Learning Path',
    description: 'Explore available courses to build demonstrated skills.',
    actionText: 'Start Learning',
    actionCode: 'CONTINUE',
    whyText: 'Consistent learning helps strengthen your core capabilities.'
  };

  const secondaryActions = allPossibleActions.slice(1, 3); // MAX 2 LIMIT ENFORCED

  return {
    greeting,
    isNewStudent: false,
    journeySummary: 'Your learning journey is moving forward steadily.',
    primaryAction,
    secondaryActions,
    learningSummary,
    strengths: skillsSummary.topSkills.filter(s => s.statusCode === 'DEMONSTRATED' || s.statusCode === 'ADVANCING').map(s => s.name),
    areasToImprove: skillsSummary.topSkills.filter(s => s.statusCode === 'DEVELOPING' || s.statusCode === 'BUILDING').map(s => s.name),
    skillsSummary,
    projectSummary,
    careerSummary,
    opportunitySummary,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Returns simple, human-friendly "Why this?" explanation for an action.
 */
export async function getWhyThisExplanation(actionId, studentId) {
  assertValidUUID(studentId, 'studentId');

  return {
    actionId: actionId || 'action-default',
    explanation: 'EDOT recommended this based on your recent learning activity, demonstrated skills, and career interests to help you take the most effective next step.',
    humanNote: 'Recommendations adapt automatically as you complete lessons, build projects, and practice skills.'
  };
}
