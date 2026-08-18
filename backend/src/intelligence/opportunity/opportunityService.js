/**
 * EDOT Intelligence Domain - Opportunity & Growth Intelligence Service
 * Manages verified opportunity catalog, learner matching, and persistence.
 */

import { prisma } from '../../../lib/prisma.js';
import { evaluateOpportunityMatch } from './opportunityMatcher.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Seeds initial verified opportunities if catalog is empty.
 */
export async function seedVerifiedOpportunities() {
  const count = await prisma.opportunity.count();
  if (count > 0) return;

  const sampleOpportunities = [
    {
      title: 'EDOT Frontend Engineering Internship',
      type: 'internships',
      organization: 'EDOT Educational Platform',
      location: 'Remote',
      description: 'Hands-on frontend development internship focusing on React, JavaScript, and modern web UI component architecture.',
      applyUrl: 'https://edot.org/careers/frontend-internship',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isVerified: true,
      requirements: {
        create: [
          { requirementType: 'skill', name: 'JavaScript', isMandatory: true },
          { requirementType: 'skill', name: 'React', isMandatory: true },
          { requirementType: 'skill', name: 'Portfolio', isMandatory: true },
          { requirementType: 'skill', name: 'TypeScript', isMandatory: false }
        ]
      }
    },
    {
      title: 'Global Tech Leadership Scholarship',
      type: 'scholarships',
      organization: 'Future Leaders Foundation',
      location: 'Hybrid',
      description: 'Merit-based scholarship covering full tuition for high-performing technology and software engineering students.',
      applyUrl: 'https://edot.org/scholarships/tech-leaders',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      isVerified: true,
      requirements: {
        create: [
          { requirementType: 'skill', name: 'Software Architecture', isMandatory: true },
          { requirementType: 'interest', name: 'Technology', isMandatory: true }
        ]
      }
    },
    {
      title: 'African AI & Tech Competition 2026',
      type: 'competitions',
      organization: 'Pan-African Tech Alliance',
      location: 'Online',
      description: 'Pan-African hackathon for building innovative educational and AI tools.',
      applyUrl: 'https://edot.org/competitions/ai-hackathon',
      deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      isVerified: true,
      requirements: {
        create: [
          { requirementType: 'skill', name: 'Python', isMandatory: true },
          { requirementType: 'interest', name: 'Artificial Intelligence', isMandatory: false }
        ]
      }
    }
  ];

  for (const opp of sampleOpportunities) {
    await prisma.opportunity.create({ data: opp });
  }
}

/**
 * Evaluates and returns verified opportunity matches for a learner.
 * 
 * @param {string} userId 
 * @returns {Promise<Array>} Array of LearnerOpportunityMatch DTOs
 */
export async function getUserOpportunityMatches(userId) {
  await seedVerifiedOpportunities();

  const [opportunities, userSkills, userProfile] = await Promise.all([
    prisma.opportunity.findMany({
      where: { status: 'active', isVerified: true },
      include: { requirements: true }
    }),
    prisma.learnerSkill.findMany({ where: { userId } }),
    prisma.learnerProfile.findUnique({
      where: { userId },
      include: { goals: true, learnerInterests: true }
    })
  ]);

  const learnerData = {
    skills: userSkills,
    interests: userProfile?.interests || [],
    goals: userProfile?.goals || []
  };

  const matches = [];

  for (const opp of opportunities) {
    const evalResult = evaluateOpportunityMatch(opp, learnerData);

    const matchRecord = await prisma.learnerOpportunityMatch.upsert({
      where: {
        userId_opportunityId: {
          userId,
          opportunityId: opp.id
        }
      },
      update: {
        matchScore: evalResult.matchScore,
        matchingReasons: evalResult.matchingReasons,
        missingRequirements: evalResult.missingRequirements,
        recommendedPreparation: evalResult.recommendedPreparation,
        calculatedAt: new Date()
      },
      create: {
        userId,
        opportunityId: opp.id,
        matchScore: evalResult.matchScore,
        matchingReasons: evalResult.matchingReasons,
        missingRequirements: evalResult.missingRequirements,
        recommendedPreparation: evalResult.recommendedPreparation
      }
    });

    matches.push({
      matchId: matchRecord.id,
      opportunityId: opp.id,
      title: opp.title,
      type: opp.type,
      organization: opp.organization,
      location: opp.location,
      description: opp.description,
      applyUrl: opp.applyUrl,
      deadline: opp.deadline,
      matchScore: evalResult.matchScore,
      matchingReasons: evalResult.matchingReasons,
      missingRequirements: evalResult.missingRequirements,
      recommendedPreparation: evalResult.recommendedPreparation
    });
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Gets detailed match evaluation for a single opportunity.
 * 
 * @param {string} userId 
 * @param {string} opportunityId 
 */
export async function getOpportunityMatchById(userId, opportunityId) {
  const matches = await getUserOpportunityMatches(userId);
  const match = matches.find(m => m.opportunityId === opportunityId || m.matchId === opportunityId);
  if (!match) {
    throw new NotFoundError(`Opportunity match [${opportunityId}] not found`);
  }
  return match;
}
