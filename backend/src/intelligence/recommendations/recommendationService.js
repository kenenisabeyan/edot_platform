/**
 * EDOT Intelligence Domain - Recommendation Service
 * Produces personalized learning paths, courses, and project recommendations from intelligence signals.
 */

import { prisma } from '../../../lib/prisma.js';
import { validateRecommendationFeedbackPayload } from '../shared/validation.js';

/**
 * Computes live recommendations for a student.
 */
export async function getPersonalizedRecommendations(userId) {
  const [profile, progressRecords, enrollments, publishedCourses] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { id: true, mainCategory: true, title: true } } },
      take: 10
    }),
    prisma.enrollment.findMany({
      where: { studentId: userId },
      select: { courseId: true }
    }),
    prisma.course.findMany({
      where: { status: 'active', isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        mainCategory: true,
        subCategory: true,
        level: true,
        thumbnail: true,
        rating: true,
        totalStudents: true,
        tags: true,
        instructor: { select: { name: true } }
      },
      take: 50,
      orderBy: { totalStudents: 'desc' }
    })
  ]);

  const enrolledIds = new Set(enrollments.map(e => e.courseId));
  const candidateCourses = publishedCourses.filter(c => !enrolledIds.has(c.id));

  const goals = (profile?.learningGoals || []).map(g => String(g).toLowerCase());
  const interests = (profile?.interests || []).map(i => String(i).toLowerCase());
  const weaknesses = (profile?.weaknesses || []).map(w => String(w).toLowerCase());
  const strengths = (profile?.strengths || []).map(s => String(s).toLowerCase());

  // Score candidate courses
  const scoredCourses = candidateCourses.map((course) => {
    const courseTags = (course.tags || []).map(t => t.toLowerCase());
    const courseCat = (course.mainCategory || '').toLowerCase();
    const courseTitle = (course.title || '').toLowerCase();

    let score = 50; // baseline

    // Weakness matching (highest weight - bridge gaps)
    const matchesWeakness = weaknesses.some(w => courseTitle.includes(w) || courseTags.some(t => t.includes(w)));
    if (matchesWeakness) score += 25;

    // Interest & Goal matching
    const matchesGoal = goals.some(g => courseTitle.includes(g) || courseTags.some(t => t.includes(g)));
    if (matchesGoal) score += 20;

    const matchesInterest = interests.some(i => courseCat.includes(i) || courseTags.some(t => t.includes(i)));
    if (matchesInterest) score += 15;

    // Reinforce strength
    if (strengths.some(s => courseCat.includes(s))) score += 8;

    score = Math.min(100, score);

    let reason = `${course.title} helps build mastery in ${course.mainCategory}.`;
    if (matchesWeakness) {
      reason = `Recommended to address detected learning gap in ${weaknesses[0] || course.mainCategory}.`;
    } else if (matchesGoal) {
      reason = `Directly aligns with your current learning goal.`;
    }

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      mainCategory: course.mainCategory,
      level: course.level,
      thumbnail: course.thumbnail,
      rating: course.rating,
      instructor: course.instructor?.name || 'EDOT Instructor',
      tags: course.tags || [course.mainCategory],
      score,
      reason
    };
  }).sort((a, b) => b.score - a.score);

  const topCourses = scoredCourses.slice(0, 5);

  // Synthesize learning paths
  const uniqueCategories = [...new Set(topCourses.map(c => c.mainCategory))].slice(0, 2);
  const learningPaths = uniqueCategories.map((category) => {
    const pathSteps = scoredCourses.filter(c => c.mainCategory === category).slice(0, 4).map(c => c.title);
    return {
      title: `${category} Accelerated Mastery Path`,
      description: `Structured progression tailored to your pace and strength profile.`,
      steps: pathSteps.length > 0 ? pathSteps : [`${category} Core`, `${category} Advanced Projects`],
      score: 88
    };
  });

  return {
    courses: topCourses,
    learningPaths,
    skills: (profile?.weaknesses || []).slice(0, 3).map(w => ({
      name: w,
      reason: `Targeted practice for ${w} will boost your overall confidence index.`,
      priority: 'high'
    })),
    metadata: {
      generatedAt: new Date(),
      confidence: profile?.confidenceScore || 75,
      candidateCount: candidateCourses.length
    }
  };
}

/**
 * Records student reaction to recommendation for closed-loop evaluation.
 */
export async function recordRecommendationFeedback(userId, feedbackPayload) {
  validateRecommendationFeedbackPayload(feedbackPayload);

  const { recommendationType = 'course', targetId, targetTitle, reason, score, actionType } = feedbackPayload;

  return prisma.recommendationResult.create({
    data: {
      userId,
      recommendationType,
      targetId: targetId || null,
      targetTitle,
      reason: reason || '',
      score: Number(score) || 0,
      wasActedOn: actionType !== 'dismissed',
      actionType,
      actedAt: new Date()
    }
  });
}
