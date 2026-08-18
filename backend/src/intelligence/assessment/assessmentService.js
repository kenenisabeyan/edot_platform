/**
 * EDOT Intelligence Domain - Assessment Intelligence Service
 * Handles assessment analysis, persistence, learner reports, and instructor telemetry.
 */

import { prisma } from '../../../lib/prisma.js';
import { analyzeAssessmentData } from './assessmentAnalyzer.js';

/**
 * Analyzes and persists assessment results for learner and instructor insights.
 * 
 * @param {string} userId 
 * @param {object} submission 
 */
export async function analyzeAssessmentSubmission(userId, submission) {
  const analysis = analyzeAssessmentData(submission);

  const insight = await prisma.assessmentInsight.create({
    data: {
      userId,
      quizId: submission.quizId || null,
      assessmentId: submission.assessmentId || 'assessment-default',
      score: analysis.score,
      masteryScore: analysis.masteryScore,
      strengths: analysis.learnerReport.strengths,
      weaknesses: analysis.learnerReport.weaknesses,
      misconceptions: analysis.learnerReport.misconceptions,
      improvementPlan: analysis.learnerReport.improvementPlan,
      reassessmentReadiness: analysis.learnerReport.reassessmentReadiness
    }
  });

  // Upsert instructor quality telemetry
  if (submission.quizId) {
    await prisma.assessmentQualityTelemetry.upsert({
      where: { quizId: submission.quizId },
      update: {
        totalSubmissions: { increment: 1 },
        averageScore: analysis.score,
        difficultQuestions: analysis.instructorTelemetry.difficultQuestions,
        classMisconceptions: analysis.instructorTelemetry.classMisconceptions,
        questionDiscrimination: analysis.instructorTelemetry.questionDiscrimination
      },
      create: {
        quizId: submission.quizId,
        totalSubmissions: 1,
        averageScore: analysis.score,
        difficultQuestions: analysis.instructorTelemetry.difficultQuestions,
        classMisconceptions: analysis.instructorTelemetry.classMisconceptions,
        questionDiscrimination: analysis.instructorTelemetry.questionDiscrimination
      }
    });
  }

  return {
    id: insight.id,
    assessmentId: insight.assessmentId,
    score: insight.score,
    masteryScore: insight.masteryScore,
    learnerReport: analysis.learnerReport,
    createdAt: insight.createdAt
  };
}

/**
 * Retrieves learner assessment report.
 * 
 * @param {string} userId 
 * @param {string} assessmentId 
 */
export async function getLearnerAssessmentReport(userId, assessmentId) {
  const insight = await prisma.assessmentInsight.findFirst({
    where: { userId, OR: [{ assessmentId }, { quizId: assessmentId }] },
    orderBy: { createdAt: 'desc' }
  });

  if (!insight) {
    return {
      assessmentId,
      strengths: [],
      weaknesses: [],
      improvementPlan: { recommendedRevision: ['Complete assessment to generate insights'] },
      reassessmentReadiness: false
    };
  }

  return {
    id: insight.id,
    assessmentId: insight.assessmentId,
    score: insight.score,
    masteryScore: insight.masteryScore,
    strengths: insight.strengths,
    weaknesses: insight.weaknesses,
    misconceptions: insight.misconceptions,
    improvementPlan: insight.improvementPlan,
    reassessmentReadiness: insight.reassessmentReadiness,
    createdAt: insight.createdAt
  };
}

/**
 * Retrieves instructor quality telemetry for an assessment.
 * 
 * @param {string} assessmentId 
 */
export async function getInstructorAssessmentIntelligence(assessmentId) {
  const telemetry = await prisma.assessmentQualityTelemetry.findFirst({
    where: { quizId: assessmentId }
  });

  if (!telemetry) {
    return {
      assessmentId,
      totalSubmissions: 0,
      averageScore: 0,
      difficultQuestions: [],
      classMisconceptions: [],
      questionDiscrimination: []
    };
  }

  return telemetry;
}
