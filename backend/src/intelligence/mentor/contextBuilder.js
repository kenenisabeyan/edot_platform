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

/**
 * Builds a secure, sanitized context object for a student's mentor query.
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
      include: { lessons: true }
    }) : null
  ]);

  const currentCourse = courseDoc || (progressRecords[0]?.course || null);
  const lessons = currentCourse?.lessons || [];
  const currentLesson = lessonId ? lessons.find(l => l.id === lessonId) : lessons[0];

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
        // Both systems unavailable - graceful degradation
        console.warn('[ContextBuilder] Legacy knowledge also unavailable:', legacyErr.message);
      }
    }
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
    identifiedWeakSkills: weaknesses.map(w => w.topic),
    skillsMastery: skills.map(s => `${s.name} (${s.proficiencyLevel})`),
    recommendedNextAction: profile?.recommendedNextAction || 'Continue module exercises',
    groundedKnowledge: groundedKnowledge || (currentLesson ? `Lesson "${currentLesson.title}": ${currentLesson.description || currentLesson.summary || 'Core concept lesson'}` : null),
    knowledgeAvailable: Boolean(groundedKnowledge || currentLesson),
    sources: knowledgeSources.length > 0 ? knowledgeSources : [currentCourse?.title, currentLesson?.title].filter(Boolean)
  };
}
