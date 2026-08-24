/**
 * EDOT Intelligence Domain - Misconception Detection & Concept Mastery Engine
 * 
 * Detects conceptual misunderstandings from quiz attempt telemetry and registers LearnerWeakness entries.
 */

import { prisma } from '../../../lib/prisma.js';
import { ensureLearnerInitialized } from '../profile/dynamicLearnerIntelligenceEngine.js';

export async function detectAndRegisterMisconceptions(studentId) {
  if (!studentId) return [];

  const profileId = await ensureLearnerInitialized(studentId);

  // Query wrong quiz attempts for the student
  const wrongAttempts = await prisma.quizAttempt.findMany({
    where: { userId: studentId, isCorrect: false, topic: { not: null } },
    select: { topic: true, courseId: true, createdAt: true }
  });

  if (wrongAttempts.length === 0) {
    return {
      hasMisconceptions: false,
      dataStatus: 'SUFFICIENT',
      misconceptions: []
    };
  }

  // Aggregate wrong attempts by topic
  const topicCounts = {};
  wrongAttempts.forEach(att => {
    const topic = att.topic.trim();
    if (!topicCounts[topic]) {
      topicCounts[topic] = { count: 0, lastObserved: att.createdAt, courseId: att.courseId };
    }
    topicCounts[topic].count += 1;
    if (new Date(att.createdAt) > new Date(topicCounts[topic].lastObserved)) {
      topicCounts[topic].lastObserved = att.createdAt;
    }
  });

  // Filter topics with >= 2 wrong attempts
  const detectedTopics = Object.entries(topicCounts).filter(([_, data]) => data.count >= 2);

  const misconceptions = [];

  for (const [topic, data] of detectedTopics) {
    const severity = data.count >= 5 ? 'high' : (data.count >= 3 ? 'medium' : 'low');
    const impactScore = Math.min(100, data.count * 15);
    const improvementPlan = `Review key explanations and attempt practice exercises for "${topic}" before retrying quizzes.`;

    await prisma.learnerWeakness.upsert({
      where: {
        profileId_topic: { profileId, topic }
      },
      update: {
        severity,
        impactScore,
        improvementPlan,
        lastObservedAt: new Date(data.lastObserved)
      },
      create: {
        profileId,
        userId: studentId,
        topic,
        category: 'Conceptual Understanding',
        severity,
        impactScore,
        improvementPlan,
        lastObservedAt: new Date(data.lastObserved)
      }
    });

    misconceptions.push({
      topic,
      errorCount: data.count,
      severity,
      impactScore,
      improvementPlan,
      lastObservedAt: data.lastObserved
    });
  }

  return {
    hasMisconceptions: misconceptions.length > 0,
    dataStatus: 'SUFFICIENT',
    misconceptionsCount: misconceptions.length,
    misconceptions
  };
}
