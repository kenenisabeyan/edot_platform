/**
 * EDOT Intelligence Domain - Opportunity Matching Engine
 * Evaluates authorized learner context (career goals, skills, project evidence, portfolio items)
 * against opportunity requirements to generate explainable recommendations (STRONG_ALIGNMENT, PROMISING, DEVELOPING_ALIGNMENT, EXPLORATORY).
 */

import { prisma } from '../../../lib/prisma.js';
import { assertValidUUID } from './opportunityAuthorizationService.js';

/**
 * Recommends explainable, context-aligned opportunities for a student.
 */
export async function getRecommendedOpportunities(studentId) {
  assertValidUUID(studentId, 'studentId');

  // Fetch student career goals, skills, and project evidences
  const [goals, interests, projectEvidences, portfolioItems, opportunities] = await Promise.all([
    prisma.careerGoal.findMany({ where: { userId: studentId, status: 'ACTIVE' } }),
    prisma.learnerCareerInterest.findMany({ where: { userId: studentId, status: 'ACTIVE' } }),
    prisma.projectEvidence.findMany({ where: { studentId } }),
    prisma.portfolioItem.findMany({ where: { userId: studentId } }),
    prisma.opportunity.findMany({
      where: { status: 'ACTIVE' },
      include: { source: true, partner: true }
    })
  ]);

  const targetAreas = [
    ...goals.map(g => g.title),
    ...interests.map(i => i.interestText)
  ];

  const recommendations = opportunities.map(opp => {
    const oppTypeStr = (opp.opportunityType || opp.type || 'OTHER').replace('_', ' ').toLowerCase();
    const matchedGoal = targetAreas.find(target =>
      opp.title.toLowerCase().includes(target.toLowerCase()) ||
      opp.description.toLowerCase().includes(target.toLowerCase()) ||
      opp.organization.toLowerCase().includes(target.toLowerCase())
    );

    let alignmentCategory = 'EXPLORATORY';
    let matchScore = 0.55;

    if (matchedGoal && projectEvidences.length > 0) {
      alignmentCategory = 'STRONG_ALIGNMENT';
      matchScore = 0.92;
    } else if (matchedGoal || projectEvidences.length > 0) {
      alignmentCategory = 'PROMISING';
      matchScore = 0.78;
    } else if (portfolioItems.length > 0) {
      alignmentCategory = 'DEVELOPING_ALIGNMENT';
      matchScore = 0.65;
    }

    const verificationLabel = opp.source?.confidenceStatus === 'VERIFIED'
      ? 'Source verification status: VERIFIED'
      : opp.source?.confidenceStatus === 'PARTNER'
      ? 'Source verification status: PARTNER'
      : 'Source verification status: PENDING';

    const matchReasons = [
      matchedGoal ? `Aligns with your career goal: "${matchedGoal}"` : `Matches general ${oppTypeStr} exploration`,
      projectEvidences.length > 0 ? `Supported by ${projectEvidences.length} verified project evidence record(s)` : 'Opportunity offers hands-on practical application',
      portfolioItems.length > 0 ? `Portfolio includes ${portfolioItems.length} published work sample(s)` : 'Building portfolio evidence is recommended prior to applying'
    ];

    return {
      opportunityId: opp.id,
      title: opp.title,
      organization: opp.organization,
      opportunityType: opp.opportunityType || opp.type || 'OTHER',
      locationType: opp.locationType || 'REMOTE',
      location: opp.location,
      deadline: opp.deadline,
      alignmentCategory,
      matchScore,
      verificationLabel,
      whyRecommended: `This ${oppTypeStr} opportunity may align with your learning path because: ${matchReasons.join('; ')}.`,
      matchReasons,
      disclaimer: 'Opportunity recommendations indicate internal capability evidence alignment and do not guarantee external selection or employment.'
    };
  });

  // Sort by match score descending
  recommendations.sort((a, b) => b.matchScore - a.matchScore);

  return recommendations;
}
