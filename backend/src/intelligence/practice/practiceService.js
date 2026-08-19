/**
 * practiceService.js
 * 
 * EDOT Dynamic Practice Service.
 * Manages session creation with AI-generated questions, adaptive evaluation,
 * weakness-driven remediation, and instructor review.
 * 
 * Works dynamically for any course, lesson, or skill without manual configuration.
 */

import { prisma } from '../../../lib/prisma.js';
import { generatePracticeQuestions, evaluateAnswersAndAdapt } from './practiceGenerator.js';
import { publishLearningEvent } from '../events/learningEventService.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Creates a new AI-generated practice session with dynamically generated questions.
 */
export async function createPracticeSession(userId, {
  courseId = null,
  lessonId = null,
  skillName = null,
  practiceType = 'APPLICATION',
  difficulty = 'INTERMEDIATE',
  questionCount = 4
}) {
  // Resolve skill name dynamically if not provided
  if (!skillName && courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, mainCategory: true }
    });
    skillName = course?.mainCategory || course?.title || 'General Knowledge';
  }
  if (!skillName) skillName = 'General Knowledge';

  // Fetch previous performance for adaptive difficulty
  let previousPerformance = null;
  const lastSession = await prisma.aIPracticeSession.findFirst({
    where: { userId, skillName },
    orderBy: { createdAt: 'desc' },
    select: { score: true, adaptiveAdjustment: true }
  }).catch(() => null);

  if (lastSession) {
    previousPerformance = { scorePercent: lastSession.score };
  }

  // Generate questions dynamically
  const questions = await generatePracticeQuestions({
    userId,
    courseId,
    lessonId,
    skillName,
    practiceType,
    difficulty,
    questionCount,
    previousPerformance
  });

  const session = await prisma.aIPracticeSession.create({
    data: {
      userId,
      courseId,
      lessonId,
      skillName,
      practiceType,
      difficulty,
      isAiGenerated: true,
      instructorApproved: false,
      status: 'ACTIVE',
      questions
    }
  });

  // Publish event for analytics (non-blocking)
  publishLearningEvent({
    userId,
    eventType: 'PRACTICE_SESSION_STARTED',
    courseId,
    lessonId,
    metadata: {
      sessionId: session.id,
      skillName,
      practiceType,
      difficulty,
      questionCount: questions.length
    }
  }).catch(() => {});

  return {
    sessionId: session.id,
    skillName: session.skillName,
    practiceType: session.practiceType,
    difficulty: session.difficulty,
    isAiGenerated: session.isAiGenerated,
    status: session.status,
    questions: questions.map(q => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      difficulty: q.difficulty,
      topic: q.topic,
      isAiGenerated: q.isAiGenerated
    })),
    createdAt: session.createdAt
  };
}

/**
 * Evaluates student answers for a practice session and updates adaptive state.
 * Publishes weakness detections and skill evidence to the learner intelligence engine.
 */
export async function evaluatePracticeSession(userId, sessionId, answers = []) {
  const session = await prisma.aIPracticeSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Practice session not found');
  }

  const evaluation = evaluateAnswersAndAdapt(session.questions, answers);

  const updated = await prisma.aIPracticeSession.update({
    where: { id: sessionId },
    data: {
      score: evaluation.scorePercent,
      feedback: evaluation.adaptiveFeedback,
      adaptiveAdjustment: evaluation.adaptiveAdjustment,
      status: 'COMPLETED'
    }
  });

  // Record weakness detections for targeted remediation
  if (evaluation.weakTopics.length > 0) {
    for (const topic of evaluation.weakTopics) {
      await prisma.learnerWeakness.upsert({
        where: {
          userId_topic: { userId, topic }
        },
        update: {
          description: `Struggled in practice session (${evaluation.scorePercent}% score)`,
          detectedAt: new Date()
        },
        create: {
          userId,
          topic,
          description: `Detected via AI practice session (${evaluation.scorePercent}% score)`,
          severity: evaluation.scorePercent < 40 ? 'HIGH' : 'MEDIUM',
          courseId: session.courseId
        }
      }).catch(() => {});
    }
  }

  // Update skill mastery based on practice performance
  if (session.skillName) {
    await prisma.learnerSkill.upsert({
      where: {
        userId_name: { userId, name: session.skillName }
      },
      update: {
        masteryScore: { increment: evaluation.scorePercent >= 80 ? 2 : evaluation.scorePercent >= 60 ? 1 : -1 },
        lastPracticedAt: new Date()
      },
      create: {
        userId,
        name: session.skillName,
        masteryScore: evaluation.scorePercent,
        proficiencyLevel: evaluation.scorePercent >= 80 ? 'INTERMEDIATE' : 'BEGINNER',
        source: 'AI_PRACTICE',
        lastPracticedAt: new Date()
      }
    }).catch(() => {});
  }

  // Publish evaluation event for analytics (non-blocking)
  publishLearningEvent({
    userId,
    eventType: 'PRACTICE_SESSION_COMPLETED',
    courseId: session.courseId,
    lessonId: session.lessonId,
    metadata: {
      sessionId: session.id,
      skillName: session.skillName,
      scorePercent: evaluation.scorePercent,
      adaptiveAdjustment: evaluation.adaptiveAdjustment,
      weakTopics: evaluation.weakTopics
    }
  }).catch(() => {});

  return {
    sessionId: updated.id,
    scorePercent: evaluation.scorePercent,
    correctCount: evaluation.correctCount,
    totalQuestions: evaluation.totalQuestions,
    adaptiveAdjustment: evaluation.adaptiveAdjustment,
    adaptiveFeedback: evaluation.adaptiveFeedback,
    weakTopics: evaluation.weakTopics,
    itemResults: evaluation.itemResults,
    isOfficialAssessment: false,
    label: 'AI-Generated Practice Evaluation',
    completedAt: updated.updatedAt
  };
}

/**
 * Retrieves a practice session by ID.
 */
export async function getPracticeSession(sessionId) {
  const session = await prisma.aIPracticeSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Practice session not found');
  }
  return session;
}

/**
 * List student's practice sessions for a course or skill.
 */
export async function listPracticeSessions(userId, { courseId = null, skillName = null, limit = 10 } = {}) {
  const where = { userId };
  if (courseId) where.courseId = courseId;
  if (skillName) where.skillName = skillName;

  const sessions = await prisma.aIPracticeSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      skillName: true,
      practiceType: true,
      difficulty: true,
      score: true,
      status: true,
      adaptiveAdjustment: true,
      isAiGenerated: true,
      createdAt: true
    }
  });

  return sessions;
}

/**
 * Instructor review capability to approve/reject generated practice items.
 */
export async function reviewPracticeSessionByInstructor(sessionId, instructorId, approved = true, notes = '') {
  const session = await prisma.aIPracticeSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Practice session not found');
  }

  const updated = await prisma.aIPracticeSession.update({
    where: { id: sessionId },
    data: {
      instructorApproved: approved,
      status: approved ? 'REVIEWED' : 'PENDING_REVIEW',
      feedback: notes ? `Instructor Notes: ${notes}` : session.feedback
    }
  });

  return {
    sessionId: updated.id,
    instructorApproved: updated.instructorApproved,
    status: updated.status,
    reviewedBy: instructorId,
    updatedAt: updated.updatedAt
  };
}
