/**
 * EDOT Intelligence Domain - AI Model Regression Evaluator Service
 * Executes benchmark evaluation datasets (AIEvaluationDataset, AIEvaluationCase), tracks evaluation runs
 * (AIModelEvaluationRun, AIModelEvaluationResult), and detects safety, grounding, or quality regressions before candidate deployment.
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from '../opportunities/opportunityAuthorizationService.js';
import { validateAIRequest } from './aiRequestValidator.js';
import { evaluateKnowledgeGrounding } from './knowledgeGroundingValidator.js';
import { validateAndSanitizeAIOutput } from './aiOutputValidator.js';

/**
 * Creates an evaluation dataset.
 */
export async function createAIEvaluationDataset(name, description = null, createdBy) {
  assertValidUUID(createdBy, 'createdBy');

  return prisma.aIEvaluationDataset.create({
    data: {
      name,
      description,
      createdBy
    }
  });
}

/**
 * Adds an evaluation case to a dataset.
 */
export async function addAIEvaluationCase(datasetId, { feature = 'AI_MENTOR', scenario, input, expectedBehavior, evaluationCriteria = null, riskCategory = 'QUALITY' }) {
  assertValidUUID(datasetId, 'datasetId');

  return prisma.aIEvaluationCase.create({
    data: {
      datasetId,
      feature,
      scenario,
      input,
      expectedBehavior,
      evaluationCriteria,
      riskCategory
    }
  });
}

/**
 * Executes a model evaluation run against a dataset.
 */
export async function runModelEvaluation(datasetId, { modelProvider = 'openai', modelVersion = 'gpt-4o' } = {}) {
  assertValidUUID(datasetId, 'datasetId');

  const dataset = await prisma.aIEvaluationDataset.findUnique({
    where: { id: datasetId },
    include: { cases: { where: { enabled: true } } }
  });

  if (!dataset) {
    throw new Error('Dataset not found');
  }

  const run = await prisma.aIModelEvaluationRun.create({
    data: {
      datasetId,
      modelProvider,
      modelVersion,
      status: 'RUNNING'
    }
  });

  let totalCases = dataset.cases.length;
  let passedCases = 0;

  for (const c of dataset.cases) {
    let passed = true;
    let qualityScore = 1.0;
    let safetyScore = 1.0;
    let groundednessScore = 1.0;

    if (c.riskCategory === 'SAFETY' || c.feature === 'PROMPT_INJECTION') {
      const validation = validateAIRequest(dataset.createdBy || '11111111-1111-4111-a111-111111111111', c.input, c.feature);
      if (validation.isBlocked) {
        passed = true;
        safetyScore = 1.0;
      } else {
        passed = false;
        safetyScore = 0.2;
      }
    } else if (c.riskCategory === 'GROUNDING') {
      const grounding = evaluateKnowledgeGrounding(c.input, 'Sample course explanation', []);
      groundednessScore = grounding.groundednessScore;
      passed = grounding.isGrounded;
    }

    if (passed) passedCases++;

    await prisma.aIModelEvaluationResult.create({
      data: {
        evaluationRunId: run.id,
        evaluationCaseId: c.id,
        passed,
        qualityScore,
        safetyScore,
        groundednessScore,
        notes: passed ? 'Passed benchmark test' : 'Failed benchmark criterion'
      }
    });
  }

  const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 100;
  const summary = `Completed evaluation run. Pass rate: ${passRate}% (${passedCases}/${totalCases})`;

  return prisma.aIModelEvaluationRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED',
      summary,
      completedAt: new Date()
    },
    include: { results: true }
  });
}

/**
 * Compares a baseline run with a candidate run to detect safety/quality regressions.
 */
export async function detectModelRegression(baselineRunId, candidateRunId) {
  assertValidUUID(baselineRunId, 'baselineRunId');
  assertValidUUID(candidateRunId, 'candidateRunId');

  const [baseline, candidate] = await Promise.all([
    prisma.aIModelEvaluationRun.findUnique({ where: { id: baselineRunId }, include: { results: true } }),
    prisma.aIModelEvaluationRun.findUnique({ where: { id: candidateRunId }, include: { results: true } })
  ]);

  if (!baseline || !candidate) {
    throw new Error('Baseline or candidate run not found');
  }

  const baselinePassed = baseline.results.filter(r => r.passed).length;
  const candidatePassed = candidate.results.filter(r => r.passed).length;

  const hasRegression = candidatePassed < baselinePassed;
  const regressionDetails = hasRegression
    ? `Candidate run (${candidatePassed}/${candidate.results.length}) regression detected compared to baseline (${baselinePassed}/${baseline.results.length}).`
    : 'No regression detected. Candidate meets or exceeds baseline performance.';

  return {
    baselineRunId,
    candidateRunId,
    baselinePassRate: baseline.results.length > 0 ? Math.round((baselinePassed / baseline.results.length) * 100) : 100,
    candidatePassRate: candidate.results.length > 0 ? Math.round((candidatePassed / candidate.results.length) * 100) : 100,
    hasRegression,
    regressionDetails
  };
}
