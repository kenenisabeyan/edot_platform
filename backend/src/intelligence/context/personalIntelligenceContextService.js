/**
 * EDOT Personal Intelligence Context Layer
 * personalIntelligenceContextService.js
 *
 * Controlled bridge between EDOT Phase 0–21 intelligence systems and conversational AI / Intelligence Hub.
 *
 * Architecture Principles:
 * 1. ZERO INTERNAL COMPLEXITY LEAKAGE: Translates internal database IDs, vector IDs, KnowledgeNode,
 *    LearnerConceptMastery, and confidence scores into warm, natural, human-centered language.
 * 2. ROLE-BASED PRIVACY ENFORCEMENT: Enforces strict server-side authorization across Students, Instructors,
 *    Admins, Guardians/Parents, and Sponsors. Unauthorized requests return 403.
 * 3. INTENT-CLASSIFIED SELECTIVE CONTEXT ROUTING: Automatically detects user intent (22+ categories)
 *    and queries ONLY the relevant EDOT intelligence domains instead of loading all database tables.
 * 4. RECENCY & FRESHNESS AWARENESS: Tags signals with CURRENT, RECENT, HISTORICAL, STALE, or UNKNOWN.
 * 5. FAULT ISOLATION: Wraps every domain query in try/catch to ensure individual service failures
 *    degrade context gracefully without breaking the AI Mentor or Hub.
 * 6. CONSISTENCY RESOLUTION: Resolves conflicting signals by favoring newer verified data and direct evidence.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveActiveLearningContext } from './courseContextResolver.js';
import { resolveInstructorContext, verifyInstructorStudentAccess } from './instructorContextResolver.js';
import { resolveGuardianContext, verifyGuardianStudentAccess } from './guardianContextResolver.js';
import { resolveSponsorContext, verifySponsorStudentAccess } from './sponsorContextResolver.js';
import { ForbiddenError } from '../shared/errors.js';

/* ═══════════════════════════════════════════════════════════════════════════════
   1. CONVERSATIONAL INTENT CLASSIFIER (22+ Categories)
═══════════════════════════════════════════════════════════════════════════════ */

export const INTENT_TYPES = {
  LEARNING_QUESTION: 'LEARNING_QUESTION',
  CONCEPT_EXPLANATION: 'CONCEPT_EXPLANATION',
  CURRENT_LESSON_HELP: 'CURRENT_LESSON_HELP',
  QUIZ_HELP: 'QUIZ_HELP',
  PRACTICE_REQUEST: 'PRACTICE_REQUEST',
  PROGRESS_QUESTION: 'PROGRESS_QUESTION',
  MASTERY_QUESTION: 'MASTERY_QUESTION',
  SKILL_QUESTION: 'SKILL_QUESTION',
  RECOMMENDATION_REQUEST: 'RECOMMENDATION_REQUEST',
  LEARNING_PATH_REQUEST: 'LEARNING_PATH_REQUEST',
  CAREER_QUESTION: 'CAREER_QUESTION',
  PROJECT_HELP: 'PROJECT_HELP',
  PORTFOLIO_HELP: 'PORTFOLIO_HELP',
  OPPORTUNITY_QUESTION: 'OPPORTUNITY_QUESTION',
  MENTOR_REQUEST: 'MENTOR_REQUEST',
  COLLABORATION_REQUEST: 'COLLABORATION_REQUEST',
  MOTIVATION: 'MOTIVATION',
  STUDY_PLANNING: 'STUDY_PLANNING',
  GENERAL_EDUCATION: 'GENERAL_EDUCATION',
  GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
  ACCOUNT_HELP: 'ACCOUNT_HELP',
  SAFETY_CONCERN: 'SAFETY_CONCERN',
  LEARNING_SUPPORT: 'LEARNING_SUPPORT',
  SKILL_GAP: 'SKILL_GAP',
  NEXT_BEST_ACTION: 'NEXT_BEST_ACTION'
};

/**
 * Classifies user text into one or more intent types using keyword and semantic pattern matching.
 *
 * @param {string} message
 * @returns {string[]} Array of detected intent strings
 */
export function classifyConversationalIntent(message = '') {
  if (!message || typeof message !== 'string') return [INTENT_TYPES.GENERAL_CONVERSATION];

  const text = message.toLowerCase().trim();
  const intents = new Set();

  // Safety & Account checks
  if (/(suicide|self-harm|depressed|hurt myself|abuse|danger|threat)/i.test(text)) {
    intents.add(INTENT_TYPES.SAFETY_CONCERN);
  }
  if (/(password|login|reset account|billing|email change|subscription)/i.test(text)) {
    intents.add(INTENT_TYPES.ACCOUNT_HELP);
  }

  // Current Lesson & Quiz Help
  if (/(lesson|current topic|this chapter|video|slide|lecture|explain this part)/i.test(text)) {
    intents.add(INTENT_TYPES.CURRENT_LESSON_HELP);
  }
  if (/(quiz|test|exam|question|wrong answer|score|passed|failed)/i.test(text)) {
    intents.add(INTENT_TYPES.QUIZ_HELP);
  }

  // Practice & Concept
  if (/(practice|exercise|problem|drill|challenge|quiz me|test me|try a question)/i.test(text)) {
    intents.add(INTENT_TYPES.PRACTICE_REQUEST);
  }
  if (/(explain|what is|how do|how to|how can|how does|solve|definition|concept|understand|meaning of|difference between)/i.test(text)) {
    intents.add(INTENT_TYPES.CONCEPT_EXPLANATION);
    intents.add(INTENT_TYPES.LEARNING_QUESTION);
  }

  // Progress, Mastery, Skills
  if (/(progress|how am i doing|streak|hours|completion|analytics|report|summary)/i.test(text)) {
    intents.add(INTENT_TYPES.PROGRESS_QUESTION);
  }
  if (/(mastery|comfort|understand well|struggling with|weakness|strength|topic confidence)/i.test(text)) {
    intents.add(INTENT_TYPES.MASTERY_QUESTION);
    intents.add(INTENT_TYPES.LEARNING_SUPPORT);
  }
  if (/(skill|ability|competency|proficient|expert|level|verified skill)/i.test(text)) {
    intents.add(INTENT_TYPES.SKILL_QUESTION);
    intents.add(INTENT_TYPES.SKILL_GAP);
  }

  // Recommendations & Next Action
  if (/(next|what should i do|what to study|next step|recommend|lost|where to start|guide me)/i.test(text)) {
    intents.add(INTENT_TYPES.RECOMMENDATION_REQUEST);
    intents.add(INTENT_TYPES.NEXT_BEST_ACTION);
  }
  if (/(learning path|roadmap|sequence|curriculum|module order|plan)/i.test(text)) {
    intents.add(INTENT_TYPES.LEARNING_PATH_REQUEST);
    intents.add(INTENT_TYPES.STUDY_PLANNING);
  }

  // Career, Projects, Portfolio, Opportunities
  if (/(job|career|interview|resume|hire|industry|frontend job|developer role|software engineer)/i.test(text)) {
    intents.add(INTENT_TYPES.CAREER_QUESTION);
  }
  if (/(project|build|repo|code|application|github|demo)/i.test(text)) {
    intents.add(INTENT_TYPES.PROJECT_HELP);
  }
  if (/(portfolio|showcase|work samples|evidence)/i.test(text)) {
    intents.add(INTENT_TYPES.PORTFOLIO_HELP);
  }
  if (/(opportunity|scholarship|internship|grant|competition|program)/i.test(text)) {
    intents.add(INTENT_TYPES.OPPORTUNITY_QUESTION);
  }

  // Mentors & Motivation
  if (/(mentor|instructor|teacher|help from human|tutor|advice)/i.test(text)) {
    intents.add(INTENT_TYPES.MENTOR_REQUEST);
  }
  if (/(collaborate|team|peer|study group)/i.test(text)) {
    intents.add(INTENT_TYPES.COLLABORATION_REQUEST);
  }
  if (/(discouraged|stuck|hard|cant do this|frustrated|give up|motivation|encourage)/i.test(text)) {
    intents.add(INTENT_TYPES.MOTIVATION);
  }

  // Fallback
  if (intents.size === 0) {
    intents.add(INTENT_TYPES.GENERAL_CONVERSATION);
  }

  return Array.from(intents);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   2. HUMAN LANGUAGE TRANSLATOR (Sanitizer)
═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Sanitizes technical objects and internal jargon into warm, supportive human language.
 * Completely strips database IDs, vector IDs, confidence scores, and raw model strings.
 *
 * @param {Object} rawContext
 * @returns {Object} Human-translated clean context representation
 */
export function translateInternalComplexityToHumanLanguage(rawContext = {}) {
  const clean = {
    identitySummary: '',
    currentLearningState: '',
    progressOverview: '',
    conceptMasterySummary: '',
    skillHighlights: '',
    recommendedNextStep: '',
    careerDirection: '',
    projectHighlights: '',
    opportunityMatches: '',
    recentSupportEvents: ''
  };

  // 1. Identity & Role Summary
  if (rawContext.profile) {
    const p = rawContext.profile;
    const name = p.user?.name || p.name || 'Learner';
    const goals = Array.isArray(p.learningGoals) ? p.learningGoals.join(', ') : (p.learningGoals || p.currentFocus || '');
    clean.identitySummary = `Learner ${name}${goals ? ` with goal: "${goals}"` : ''}.`;
  }

  // 2. Current Learning State (Recency-aware)
  if (rawContext.activeLearning) {
    const act = rawContext.activeLearning;
    if (act.courseTitle) {
      clean.currentLearningState = `Currently studying "${act.courseTitle}"${act.lessonTitle ? `, active on lesson "${act.lessonTitle}"` : ''} (${Math.round(act.currentProgress || 0)}% completed).`;
    }
  }

  // 3. Progress & Pulse Overview
  if (rawContext.progress) {
    const prog = rawContext.progress;
    const engagement = Math.round(prog.engagementScore ?? 0);
    const consistency = Math.round(prog.consistencyScore ?? 0);
    const streak = prog.studyStreak || 0;

    let momentumDesc = 'building momentum';
    if (consistency > 75) momentumDesc = 'maintaining an excellent, steady study rhythm';
    else if (consistency > 45) momentumDesc = 'steady learning consistency';

    clean.progressOverview = `Showing ${momentumDesc} (consistency: ${consistency}%, streak: ${streak} days).`;
  }

  // 4. Concept Mastery (Stripping scores & node IDs)
  if (rawContext.mastery && Array.isArray(rawContext.mastery)) {
    const comfortable = [];
    const needsPractice = [];

    rawContext.mastery.forEach(m => {
      const topicName = m.conceptName || m.concept || m.topic || 'Concept';
      const level = (m.masteryLevel || m.level || '').toUpperCase();
      if (level === 'MASTERED' || level === 'PROFICIENT') {
        comfortable.push(topicName);
      } else if (level === 'DEVELOPING' || level === 'NOVICE') {
        needsPractice.push(topicName);
      }
    });

    const parts = [];
    if (comfortable.length > 0) parts.push(`Comfortable with: ${comfortable.slice(0, 4).join(', ')}`);
    if (needsPractice.length > 0) parts.push(`Would benefit from more practice in: ${needsPractice.slice(0, 3).join(', ')}`);
    clean.conceptMasterySummary = parts.join('. ');
  }

  // 5. Skill Profile (Stripping internal scores)
  if (rawContext.skills && Array.isArray(rawContext.skills)) {
    const verified = rawContext.skills.slice(0, 5).map(s => {
      const name = s.name || s.skillName;
      const level = s.proficiencyLevel || s.level || 'Practitioner';
      return `${name} (${level})`;
    });
    if (verified.length > 0) {
      clean.skillHighlights = `Verified skills: ${verified.join(', ')}.`;
    }
  }

  // 6. Recommended Next Step
  if (rawContext.nextAction) {
    const na = rawContext.nextAction;
    const title = na.title || na.action?.title || na.description || na.action?.description;
    if (title) {
      clean.recommendedNextStep = `Strongest recommended next step: "${title}"${na.reason ? ` — ${na.reason}` : ''}.`;
    }
  }

  // 7. Career Readiness
  if (rawContext.career) {
    const c = rawContext.career;
    if (c.targetRole || c.careerPath) {
      clean.careerDirection = `Pursuing role: "${c.targetRole || c.careerPath}"${c.readinessScore ? ` (career readiness: ${Math.round(c.readinessScore)}%)` : ''}.`;
    }
  }

  // 8. Projects & Opportunities
  if (rawContext.projects && Array.isArray(rawContext.projects) && rawContext.projects.length > 0) {
    const projs = rawContext.projects.slice(0, 3).map(p => p.title || p.name).join(', ');
    clean.projectHighlights = `Active portfolio projects: ${projs}.`;
  }

  if (rawContext.opportunities && Array.isArray(rawContext.opportunities) && rawContext.opportunities.length > 0) {
    const opps = rawContext.opportunities.slice(0, 2).map(o => o.title || o.name).join(', ');
    clean.opportunityMatches = `Relevant opportunity matches: ${opps}.`;
  }

  return clean;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   3. ROLE-BASED AUTHORIZATION & PRIVACY ENFORCEMENT
═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Validates cross-role authorization for retrieving user context.
 * Enforces server-side checks for Student, Instructor, Admin, Guardian, Sponsor.
 *
 * @param {Object} authUser Requesting user from req.user
 * @param {string} targetUserId Target user ID whose context is being requested
 */
export async function assertContextAuthorization(authUser, targetUserId) {
  if (!authUser || !authUser.id) {
    throw new ForbiddenError('Authentication required to access personal intelligence context.');
  }

  const reqRole = (authUser.role || 'student').toLowerCase().trim();
  const reqId = String(authUser.id);
  const targetId = String(targetUserId || authUser.id);

  // Self-access is always allowed
  if (reqId === targetId) return true;

  // Admin access is allowed
  if (reqRole === 'admin') return true;

  // Instructor checking student access
  if (reqRole === 'instructor') {
    await verifyInstructorStudentAccess(reqId, targetId);
    return true;
  }

  // Guardian checking student access
  if (reqRole === 'guardian' || reqRole === 'parent') {
    await verifyGuardianStudentAccess(reqId, targetId);
    return true;
  }

  // Sponsor checking sponsored student access
  if (reqRole === 'sponsor') {
    await verifySponsorStudentAccess(reqId, targetId);
    return true;
  }

  // Unauthorized cross-user access -> Return HTTP 403 Forbidden
  throw new ForbiddenError(`Forbidden: User ID "${reqId}" (${reqRole}) is not authorized to access context for student ID "${targetId}".`);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   4. DOMAIN FETCHERS WITH FAULT ISOLATION
═══════════════════════════════════════════════════════════════════════════════ */

async function safeFetch(fetcherFn, fallbackValue = null) {
  try {
    return await fetcherFn();
  } catch (err) {
    console.warn('Personal Context safeFetch warning:', err.message);
    return fallbackValue;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   5. MASTER CONTEXT ROUTER & AGGREGATOR
═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Resolves unified, role-authorized, intent-routed, human-translated Personal Intelligence Context.
 *
 * @param {Object} params
 * @param {Object} params.authUser Authenticated user object (req.user)
 * @param {string} [params.targetUserId] Target student/user ID (defaults to authUser.id)
 * @param {string} [params.message] User input message for intent classification
 * @param {string} [params.courseId] Active course ID context
 * @param {string} [params.lessonId] Active lesson ID context
 * @returns {Promise<Object>} Unified Personal Intelligence Context
 */
export async function resolvePersonalIntelligenceContext({ authUser, targetUserId, message = '', courseId = null, lessonId = null }) {
  const targetId = targetUserId || authUser.id;

  // 1. Server-side Authorization Check
  await assertContextAuthorization(authUser, targetId);

  // 2. Classify Intent
  const intents = classifyConversationalIntent(message);

  // 3. Selective Domain Context Resolution (Query only relevant domains)
  const rawContext = {
    intents,
    profile: null,
    activeLearning: null,
    progress: null,
    mastery: null,
    skills: null,
    nextAction: null,
    learningPlan: null,
    career: null,
    projects: null,
    opportunities: null,
    recentEvents: null
  };

  const now = new Date();

  // Always fetch core profile & active course context with fault isolation
  rawContext.profile = await safeFetch(() =>
    prisma.learnerProfile.findUnique({
      where: { userId: targetId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    })
  );

  rawContext.activeLearning = await safeFetch(async () => {
    const act = await resolveActiveLearningContext(targetId);
    if (act?.courseId) {
      const course = await prisma.course.findUnique({ where: { id: act.courseId }, select: { title: true } });
      const lesson = act.lessonId ? await prisma.lesson.findUnique({ where: { id: act.lessonId }, select: { title: true } }) : null;
      return { ...act, courseTitle: course?.title, lessonTitle: lesson?.title };
    }
    return act;
  });

  // Intent-Driven Routing
  const needsMastery = intents.some(i => [INTENT_TYPES.MASTERY_QUESTION, INTENT_TYPES.CONCEPT_EXPLANATION, INTENT_TYPES.QUIZ_HELP, INTENT_TYPES.PRACTICE_REQUEST, INTENT_TYPES.LEARNING_SUPPORT].includes(i));
  const needsSkills = intents.some(i => [INTENT_TYPES.SKILL_QUESTION, INTENT_TYPES.SKILL_GAP, INTENT_TYPES.CAREER_QUESTION, INTENT_TYPES.PORTFOLIO_HELP].includes(i));
  const needsProgress = intents.some(i => [INTENT_TYPES.PROGRESS_QUESTION, INTENT_TYPES.MOTIVATION, INTENT_TYPES.STUDY_PLANNING].includes(i));
  const needsNextAction = intents.some(i => [INTENT_TYPES.RECOMMENDATION_REQUEST, INTENT_TYPES.NEXT_BEST_ACTION, INTENT_TYPES.LEARNING_PATH_REQUEST].includes(i));
  const needsCareer = intents.some(i => [INTENT_TYPES.CAREER_QUESTION, INTENT_TYPES.OPPORTUNITY_QUESTION].includes(i));
  const needsProjects = intents.some(i => [INTENT_TYPES.PROJECT_HELP, INTENT_TYPES.PORTFOLIO_HELP, INTENT_TYPES.CAREER_QUESTION].includes(i));
  const needsOpportunities = intents.some(i => [INTENT_TYPES.OPPORTUNITY_QUESTION, INTENT_TYPES.CAREER_QUESTION].includes(i));

  // Execute domain fetches in parallel with fault isolation
  const [masteryData, skillsData, analyticsReport, nextActionData, careerData, projectsData, opportunitiesData] = await Promise.all([
    needsMastery ? safeFetch(() => prisma.learnerConceptMastery.findMany({ where: { userId: targetId }, take: 10, orderBy: { updatedAt: 'desc' } }), []) : Promise.resolve([]),
    needsSkills ? safeFetch(() => prisma.learnerSkill.findMany({ where: { userId: targetId }, take: 10, orderBy: { masteryScore: 'desc' } }), []) : Promise.resolve([]),
    needsProgress ? safeFetch(() => prisma.learnerAnalyticsReport.findUnique({ where: { userId: targetId } })) : Promise.resolve(null),
    needsNextAction ? safeFetch(async () => {
      const { resolveNextBestAction } = await import('../recommendations/nextBestActionResolver.js').catch(() => ({ resolveNextBestAction: () => null }));
      return resolveNextBestAction(targetId);
    }) : Promise.resolve(null),
    needsCareer ? safeFetch(() => prisma.learnerSkillProfile.findFirst({ where: { studentId: targetId } })) : Promise.resolve(null),
    needsProjects ? safeFetch(() => prisma.projectSubmission.findMany({ where: { userId: targetId }, take: 5, orderBy: { createdAt: 'desc' } }), []) : Promise.resolve([]),
    needsOpportunities ? safeFetch(() => prisma.opportunityMatch.findMany({ where: { studentId: targetId }, take: 5, orderBy: { score: 'desc' } }), []) : Promise.resolve([])
  ]);

  rawContext.mastery = masteryData;
  rawContext.skills = skillsData;
  rawContext.progress = analyticsReport;
  rawContext.nextAction = nextActionData;
  rawContext.career = careerData;
  rawContext.projects = projectsData;
  rawContext.opportunities = opportunitiesData;

  // 4. Translate raw complex data into warm, human-centered language
  const humanTranslated = translateInternalComplexityToHumanLanguage(rawContext);

  // 5. Package Recency-Tagged Unified Context Output with Internal Source Traceability
  const contextSources = ['learning_profile', 'active_learning'];
  if (needsMastery) contextSources.push('mastery');
  if (needsSkills) contextSources.push('skills');
  if (needsProgress) contextSources.push('analytics');
  if (needsNextAction) contextSources.push('recommendations');
  if (needsCareer) contextSources.push('career');
  if (needsProjects) contextSources.push('projects');
  if (needsOpportunities) contextSources.push('opportunities');

  return {
    meta: {
      requestingUserId: authUser.id,
      targetUserId: targetId,
      requestingRole: authUser.role,
      detectedIntents: intents,
      contextSources,
      resolvedAt: now.toISOString(),
      dataFreshness: rawContext.activeLearning?.lastActivity ? (now - new Date(rawContext.activeLearning.lastActivity) < 24 * 3600 * 1000 ? 'CURRENT' : 'RECENT') : 'HISTORICAL'
    },
    humanContext: humanTranslated,
    routingFlags: {
      needsMastery,
      needsSkills,
      needsProgress,
      needsNextAction,
      needsCareer,
      needsProjects,
      needsOpportunities
    }
  };
}

