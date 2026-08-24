/**
 * EDOT Intelligence Domain - Adaptive Learning Sequencer
 * 
 * Computes non-destructive adaptive learning paths and recommendations.
 */

import { prisma } from '../../../lib/prisma.js';
import { getCourseLearningSummary } from '../analytics/learningAnalyticsService.js';
import { detectAndRegisterMisconceptions } from '../understanding/misconceptionEngine.js';

export async function generateAdaptiveSequence(studentId, courseId = null) {
  if (!studentId) return null;

  // Resolve active course if courseId not provided
  let targetCourseId = courseId;
  if (!targetCourseId) {
    const activeProgress = await prisma.userCourseProgress.findFirst({
      where: { userId: studentId, completed: false },
      orderBy: { updatedAt: 'desc' }
    });
    targetCourseId = activeProgress?.courseId || null;
  }

  if (!targetCourseId) {
    return {
      adaptiveMode: 'STANDARD_CURRICULUM',
      confidence: 0.5,
      dataStatus: 'INSUFFICIENT',
      recommendations: [],
      message: 'No active course identified for adaptive sequencing.'
    };
  }

  const [summary, misconceptions] = await Promise.all([
    getCourseLearningSummary(studentId, targetCourseId),
    detectAndRegisterMisconceptions(studentId)
  ]);

  const quizAvg = summary.courseSummary.quizAverage || 75;
  const progress = summary.courseSummary.progressPercentage || 0;

  let adaptiveMode = 'STANDARD_CURRICULUM';
  let sequenceReason = 'Proceed with regular module sequence.';
  const recommendations = [];

  if (misconceptions.hasMisconceptions && quizAvg < 65) {
    adaptiveMode = 'REMEDIAL_SUPPORT';
    sequenceReason = `Quiz performance (${quizAvg}%) and ${misconceptions.misconceptionsCount} identified concept gap(s) suggest focusing on foundational review.`;
    
    misconceptions.misconceptions.slice(0, 2).forEach(m => {
      recommendations.push({
        type: 'REMEDIAL_PRACTICE',
        title: `Review Topic: ${m.topic}`,
        description: m.improvementPlan,
        priority: 'HIGH'
      });
    });
  } else if (quizAvg >= 85 && progress >= 30) {
    adaptiveMode = 'ENRICHMENT_FAST_TRACK';
    sequenceReason = `Strong performance (${quizAvg}%) qualifies you for accelerated learning and portfolio challenges.`;

    recommendations.push({
      type: 'PORTFOLIO_CHALLENGE',
      title: 'Apply Skills in Portfolio Project',
      description: 'Test your advanced mastery with a hands-on real-world application.',
      priority: 'MEDIUM'
    });
  } else {
    recommendations.push({
      type: 'SEQUENTIAL_MODULE',
      title: 'Continue Sequential Module',
      description: 'Maintain steady pace through core lessons.',
      priority: 'MEDIUM'
    });
  }

  return {
    sourceType: 'ADAPTIVE_SEQUENCER',
    studentId,
    courseId: targetCourseId,
    adaptiveMode,
    sequenceReason,
    currentProgress: progress,
    quizAverage: summary.courseSummary.quizAverage,
    recommendations,
    generatedAt: new Date()
  };
}
