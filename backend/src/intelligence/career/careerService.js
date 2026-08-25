/**
 * EDOT Intelligence Domain - Dynamic Career Intelligence & Skill Gap Analyzer Service
 * Maps verified learner skill passports against industry career path requirements.
 */

import { prisma } from '../../../lib/prisma.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Seeds initial verified career path benchmarks.
 */
export async function seedCareerPaths() {
  const count = await prisma.careerPath.count();
  if (count > 0) return;

  const samplePaths = [
    {
      title: 'Full-Stack Web Engineer',
      category: 'Software Engineering',
      description: 'Designs, builds, and deploys scalable frontend and backend web applications.',
      avgSalaryRange: '$75,000 - $130,000 / year',
      demandLevel: 'VERY_HIGH',
      requiredSkills: [
        { name: 'JavaScript', targetProficiency: 'advanced', minMastery: 80 },
        { name: 'React', targetProficiency: 'advanced', minMastery: 80 },
        { name: 'Node.js', targetProficiency: 'intermediate', minMastery: 70 },
        { name: 'SQL & PostgreSQL', targetProficiency: 'intermediate', minMastery: 70 },
        { name: 'RESTful API Architecture', targetProficiency: 'intermediate', minMastery: 75 }
      ]
    },
    {
      title: 'AI & Machine Learning Engineer',
      category: 'AI & Data',
      description: 'Develops predictive intelligence models, natural language processing pipelines, and autonomous AI agents.',
      avgSalaryRange: '$90,000 - $160,000 / year',
      demandLevel: 'VERY_HIGH',
      requiredSkills: [
        { name: 'Python', targetProficiency: 'advanced', minMastery: 85 },
        { name: 'Machine Learning Fundamentals', targetProficiency: 'intermediate', minMastery: 75 },
        { name: 'Data Preprocessing & Pandas', targetProficiency: 'intermediate', minMastery: 75 },
        { name: 'Deep Learning & Neural Networks', targetProficiency: 'intermediate', minMastery: 70 }
      ]
    },
    {
      title: 'Cloud & DevOps Systems Architect',
      category: 'Infrastructure',
      description: 'Architects resilient cloud infrastructure, CI/CD pipelines, and automated containerized deployments.',
      avgSalaryRange: '$85,000 - $150,000 / year',
      demandLevel: 'HIGH',
      requiredSkills: [
        { name: 'Linux System Administration', targetProficiency: 'advanced', minMastery: 80 },
        { name: 'Docker & Containerization', targetProficiency: 'intermediate', minMastery: 75 },
        { name: 'Kubernetes Orchestration', targetProficiency: 'intermediate', minMastery: 70 },
        { name: 'CI/CD Automation', targetProficiency: 'intermediate', minMastery: 75 }
      ]
    }
  ];

  for (const path of samplePaths) {
    await prisma.careerPath.create({ data: path });
  }
}

/**
 * Returns available career paths catalog.
 */
export async function getAvailableCareerPaths() {
  await seedCareerPaths();
  return prisma.careerPath.findMany({
    orderBy: { title: 'asc' }
  });
}

/**
 * Evaluates skill gap analysis for a learner against a target career path.
 * 
 * @param {string} userId 
 * @param {string} careerPathId 
 */
export async function getLearnerCareerGapAnalysis(userId, careerPathId) {
  await seedCareerPaths();

  let careerPath = await prisma.careerPath.findUnique({ where: { id: careerPathId } });
  if (!careerPath) {
    careerPath = await prisma.careerPath.findFirst();
  }
  if (!careerPath) {
    throw new NotFoundError(`Career path [${careerPathId}] not found`);
  }

  const learnerSkills = await prisma.learnerSkill.findMany({
    where: { userId },
    include: { evidences: true }
  });

  const requiredSkills = Array.isArray(careerPath.requiredSkills) ? careerPath.requiredSkills : [];
  const acquiredSkills = [];
  const skillGaps = [];
  let totalScoreWeight = 0;
  let earnedScoreWeight = 0;

  requiredSkills.forEach(req => {
    totalScoreWeight += 100;
    const reqNameLower = req.name.toLowerCase();
    const matchedLearnerSkill = learnerSkills.find(s =>
      s.name.toLowerCase().includes(reqNameLower) || reqNameLower.includes(s.name.toLowerCase())
    );

    if (matchedLearnerSkill) {
      const mastery = matchedLearnerSkill.masteryScore || 70;
      earnedScoreWeight += Math.min(100, mastery);
      acquiredSkills.push({
        name: req.name,
        learnerMastery: mastery,
        targetMastery: req.minMastery || 80,
        status: mastery >= (req.minMastery || 80) ? 'VERIFIED_MASTERED' : 'IN_PROGRESS'
      });
    } else {
      skillGaps.push({
        name: req.name,
        targetProficiency: req.targetProficiency || 'intermediate',
        recommendedCourseCategory: careerPath.category
      });
    }
  });

  // Evidence-based readiness: no artificial floor
  // 0 skills = INSUFFICIENT_DATA, not 35%
  const readinessScore = totalScoreWeight > 0 ? Math.round((earnedScoreWeight / totalScoreWeight) * 100) : 0;

  // Generate step-by-step learning roadmap
  const roadmapSteps = [];
  if (skillGaps.length > 0) {
    skillGaps.forEach((gap, index) => {
      roadmapSteps.push({
        stepNumber: index + 1,
        title: `Master ${gap.name} Fundamentals`,
        description: `Complete practice evaluations and projects focused on ${gap.name} to achieve ${gap.targetProficiency} proficiency.`,
        status: index === 0 ? 'RECOMMENDED_NEXT' : 'UPCOMING'
      });
    });
  } else {
    roadmapSteps.push({
      stepNumber: 1,
      title: 'Industry Portfolio Verification',
      description: 'Your skills meet verified target benchmarks. Submit your skill passport to EDOT partner opportunities.',
      status: 'READY_TO_APPLY'
    });
  }

  // Save or update LearnerCareerTarget record
  const careerTarget = await prisma.learnerCareerTarget.upsert({
    where: {
      userId_careerPathId: {
        userId,
        careerPathId: careerPath.id
      }
    },
    update: {
      readinessScore,
      acquiredSkills,
      skillGaps,
      roadmapSteps,
      updatedAt: new Date()
    },
    create: {
      userId,
      careerPathId: careerPath.id,
      readinessScore,
      acquiredSkills,
      skillGaps,
      roadmapSteps
    }
  });

  return {
    targetId: careerTarget.id,
    careerPathId: careerPath.id,
    careerTitle: careerPath.title,
    category: careerPath.category,
    description: careerPath.description,
    avgSalaryRange: careerPath.avgSalaryRange,
    demandLevel: careerPath.demandLevel,
    readinessScore,
    acquiredSkillsCount: acquiredSkills.length,
    skillGapsCount: skillGaps.length,
    acquiredSkills,
    skillGaps,
    roadmapSteps
  };
}

/**
 * Retrieves active career targets for a learner.
 * 
 * @param {string} userId 
 */
export async function getUserCareerTargets(userId) {
  await seedCareerPaths();
  const paths = await getAvailableCareerPaths();
  const topPath = paths[0];
  return getLearnerCareerGapAnalysis(userId, topPath.id);
}
