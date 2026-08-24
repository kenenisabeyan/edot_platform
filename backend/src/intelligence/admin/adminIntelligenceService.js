/**
 * EDOT Intelligence Domain - Admin Institutional Intelligence Service
 * 
 * Provides macro platform analytics, category growth tracking, course engagement/completion matrix,
 * cross-course systemic problem detection (min 2-course threshold), instructor support detection,
 * and institutional action recommendation engines. Grounded 100% in real DB telemetry.
 */

import { prisma } from '../../../lib/prisma.js';

const MIN_CROSS_COURSE_PROBLEM_THRESHOLD = 2; // Requires learning problem to appear in >=2 distinct courses

/**
 * Computes macro-level platform intelligence overview metrics.
 */
export async function getPlatformOverview() {
  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    totalCourses,
    totalEnrollments,
    recentEvents,
    userProgresses,
    courseProfiles
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.course.count(),
    prisma.enrollment.count({ where: { status: 'approved' } }),
    prisma.learningEvent.findMany({
      where: { timestamp: { gte: SEVEN_DAYS_AGO } },
      select: { userId: true, timestamp: true }
    }),
    prisma.userCourseProgress.findMany({
      select: { progress: true, completed: true }
    }),
    prisma.courseLearnerProfile.findMany({
      select: { learningStatus: true }
    })
  ]);

  const activeStudentSet = new Set(recentEvents.map(e => e.userId));
  const activeStudents7d = activeStudentSet.size;

  const totalProgress = userProgresses.reduce((acc, p) => acc + (p.progress || 0), 0);
  const globalCompletionRate = userProgresses.length > 0 ? Math.round(totalProgress / userProgresses.length) : 0;

  const attentionCount = courseProfiles.filter(p => p.learningStatus === 'NEEDS_ATTENTION' || p.learningStatus === 'SUPPORT_RECOMMENDED').length;
  const totalTracked = courseProfiles.length || 1;
  const attentionRatio = attentionCount / totalTracked;

  let platformHealthIndex = 'HEALTHY';
  if (attentionRatio >= 0.35) platformHealthIndex = 'NEEDS_ATTENTION';
  else if (attentionRatio >= 0.15) platformHealthIndex = 'WATCH';

  const totalStudyHours = Math.round(recentEvents.length * 0.25); // Estimated study hours from telemetry volume

  return {
    sourceType: 'PLATFORM_INSTITUTIONAL_OVERVIEW',
    generatedAt: now,
    platformHealthIndex,
    totalStudents,
    activeStudents7d,
    activeStudentRatio: totalStudents > 0 ? Math.round((activeStudents7d / totalStudents) * 100) : 0,
    totalCourses,
    totalEnrollments,
    globalCompletionRate,
    totalStudyHours,
    dataStatus: totalStudents > 0 ? 'SUFFICIENT' : 'INSUFFICIENT'
  };
}

/**
 * Computes category growth, enrollment distribution, and momentum analytics.
 */
export async function getCategoryGrowthAnalytics() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      mainCategory: true,
      totalStudents: true,
      createdAt: true,
      enrollments: { select: { id: true, createdAt: true } },
      userProgress: { select: { progress: true } }
    }
  });

  if (courses.length === 0) {
    return { dataStatus: 'INSUFFICIENT', categories: [] };
  }

  const categoryMap = {};

  courses.forEach(c => {
    const cat = c.mainCategory || 'General Studies';
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        categoryName: cat,
        totalCourses: 0,
        totalEnrollments: 0,
        totalProgressSum: 0,
        progressCount: 0
      };
    }

    categoryMap[cat].totalCourses += 1;
    categoryMap[cat].totalEnrollments += c.enrollments.length;

    c.userProgress.forEach(up => {
      categoryMap[cat].totalProgressSum += (up.progress || 0);
      categoryMap[cat].progressCount += 1;
    });
  });

  const categories = Object.values(categoryMap).map(cat => {
    const averageCompletion = cat.progressCount > 0 ? Math.round(cat.totalProgressSum / cat.progressCount) : 0;
    let momentum = 'STABLE';
    if (cat.totalEnrollments >= 10) momentum = 'HIGH_GROWTH';
    else if (cat.totalEnrollments >= 3) momentum = 'MODERATE';

    return {
      categoryName: cat.categoryName,
      totalCourses: cat.totalCourses,
      totalEnrollments: cat.totalEnrollments,
      averageCompletionRate: averageCompletion,
      momentum
    };
  });

  return {
    dataStatus: 'SUFFICIENT',
    totalCategories: categories.length,
    categories: categories.sort((a, b) => b.totalEnrollments - a.totalEnrollments)
  };
}

/**
 * Analyzes all platform courses and maps them into 4 risk/performance quadrants:
 * - HIGH_ENGAGEMENT_HIGH_COMPLETION
 * - HIGH_ENGAGEMENT_LOW_COMPLETION
 * - LOW_ENGAGEMENT_HIGH_COMPLETION
 * - CRITICAL_REVIEW
 */
export async function getCourseEngagementCompletionMatrix() {
  const now = new Date();
  const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const courses = await prisma.course.findMany({
    include: {
      instructor: { select: { id: true, name: true } },
      enrollments: { select: { studentId: true } },
      userProgress: { select: { progress: true } }
    }
  });

  if (courses.length === 0) {
    return { dataStatus: 'INSUFFICIENT', matrix: [] };
  }

  const matrix = await Promise.all(
    courses.map(async (c) => {
      const recentEvents = await prisma.learningEvent.findMany({
        where: { courseId: c.id, timestamp: { gte: SEVEN_DAYS_AGO } },
        select: { userId: true }
      });

      const activeStudentSet = new Set(recentEvents.map(e => e.userId));
      const totalEnrolled = c.enrollments.length;
      const engagementRatio = totalEnrolled > 0 ? Math.round((activeStudentSet.size / totalEnrolled) * 100) : 0;

      const totalProgressSum = c.userProgress.reduce((acc, p) => acc + (p.progress || 0), 0);
      const averageCompletion = c.userProgress.length > 0 ? Math.round(totalProgressSum / c.userProgress.length) : 0;

      let quadrant = 'HIGH_ENGAGEMENT_HIGH_COMPLETION';
      if (engagementRatio >= 40 && averageCompletion >= 50) quadrant = 'HIGH_ENGAGEMENT_HIGH_COMPLETION';
      else if (engagementRatio >= 40 && averageCompletion < 50) quadrant = 'HIGH_ENGAGEMENT_LOW_COMPLETION';
      else if (engagementRatio < 40 && averageCompletion >= 50) quadrant = 'LOW_ENGAGEMENT_HIGH_COMPLETION';
      else quadrant = 'CRITICAL_REVIEW';

      return {
        courseId: c.id,
        courseTitle: c.title,
        instructorName: c.instructor?.name || 'Unassigned',
        totalEnrolled,
        activeStudents7d: activeStudentSet.size,
        engagementRatio,
        averageCompletion,
        quadrant
      };
    })
  );

  return {
    dataStatus: 'SUFFICIENT',
    totalCourses: matrix.length,
    matrix: matrix.sort((a, b) => a.engagementRatio - b.engagementRatio)
  };
}

/**
 * Aggregates student support needs grouped by category/department.
 */
export async function getStudentGroupsNeedingSupport() {
  const courseProfiles = await prisma.courseLearnerProfile.findMany({
    where: { learningStatus: { in: ['NEEDS_ATTENTION', 'SUPPORT_RECOMMENDED'] } },
    include: {
      user: { select: { id: true, name: true, department: true } },
      course: { select: { id: true, title: true, mainCategory: true } }
    }
  });

  const groupMap = {};

  courseProfiles.forEach(cp => {
    const groupKey = cp.course?.mainCategory || 'General Studies';
    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        groupName: groupKey,
        category: groupKey,
        studentsNeedingSupportCount: 0,
        courses: new Set(),
        sampleStudents: []
      };
    }

    groupMap[groupKey].studentsNeedingSupportCount += 1;
    if (cp.course?.title) groupMap[groupKey].courses.add(cp.course.title);
    if (groupMap[groupKey].sampleStudents.length < 3) {
      groupMap[groupKey].sampleStudents.push(cp.user?.name || 'Student');
    }
  });

  const groups = Object.values(groupMap).map(g => ({
    groupName: g.groupName,
    category: g.category,
    studentsNeedingSupportCount: g.studentsNeedingSupportCount,
    affectedCourses: Array.from(g.courses),
    sampleStudents: g.sampleStudents
  }));

  return {
    dataStatus: groups.length > 0 ? 'SUFFICIENT' : 'HEALTHY',
    totalGroupsNeedingSupport: groups.length,
    groups: groups.sort((a, b) => b.studentsNeedingSupportCount - a.studentsNeedingSupportCount)
  };
}

/**
 * Detects learning misconceptions or problems that appear across multiple courses.
 * Enforces MIN_CROSS_COURSE_PROBLEM_THRESHOLD (>=2 distinct courses) to isolate platform-wide problems.
 */
export async function getCrossCourseLearningProblems() {
  const weaknesses = await prisma.learnerWeakness.findMany({
    include: {
      profile: { select: { userId: true } }
    }
  });

  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { isCorrect: false }
  });

  const topicCourseMap = {};

  // Map topic to set of courses
  weaknesses.forEach(w => {
    const topic = w.topic || 'General Concepts';
    if (!topicCourseMap[topic]) topicCourseMap[topic] = { topic, courseSet: new Set(), totalOccurrences: 0 };
    if (w.courseId) topicCourseMap[topic].courseSet.add(w.courseId);
    topicCourseMap[topic].totalOccurrences += 1;
  });

  quizAttempts.forEach(q => {
    const topic = q.topic || 'General Concepts';
    if (!topicCourseMap[topic]) topicCourseMap[topic] = { topic, courseSet: new Set(), totalOccurrences: 0 };
    if (q.courseId) topicCourseMap[topic].courseSet.add(q.courseId);
    topicCourseMap[topic].totalOccurrences += 1;
  });

  const crossCourseProblems = [];

  Object.values(topicCourseMap).forEach(item => {
    const courseCount = item.courseSet.size;
    // Enforce 2+ course threshold
    if (courseCount >= MIN_CROSS_COURSE_PROBLEM_THRESHOLD) {
      crossCourseProblems.push({
        topic: item.topic,
        affectedCoursesCount: courseCount,
        totalOccurrences: item.totalOccurrences,
        evidenceSignal: `Learning problem "${item.topic}" identified across ${courseCount} distinct platform courses.`,
        recommendedInstitutionalAction: `Conduct institutional curriculum review or workshop for topic "${item.topic}".`
      });
    }
  });

  return {
    dataStatus: crossCourseProblems.length > 0 ? 'SUFFICIENT' : 'NO_CROSS_COURSE_PROBLEMS',
    totalCrossCourseProblems: crossCourseProblems.length,
    crossCourseProblems: crossCourseProblems.sort((a, b) => b.affectedCoursesCount - a.affectedCoursesCount)
  };
}

/**
 * Identifies instructors whose assigned courses exhibit low retention or completion rates.
 * Uses supportive, non-judgmental framing (e.g. "May benefit from TA allocation").
 */
export async function getInstructorsNeedingSupport() {
  const instructors = await prisma.user.findMany({
    where: { role: 'instructor' },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      coursesTaught: {
        select: {
          id: true,
          title: true,
          enrollments: { select: { id: true } },
          userProgress: { select: { progress: true } }
        }
      }
    }
  });

  const supportList = [];

  instructors.forEach(inst => {
    let totalCourses = inst.coursesTaught.length;
    if (totalCourses === 0) return;

    let strugglingCourseCount = 0;
    const courseDetails = [];

    inst.coursesTaught.forEach(c => {
      const totalProgressSum = c.userProgress.reduce((acc, p) => acc + (p.progress || 0), 0);
      const avgCompletion = c.userProgress.length > 0 ? Math.round(totalProgressSum / c.userProgress.length) : 0;

      if (avgCompletion < 40 && c.enrollments.length >= 1) {
        strugglingCourseCount += 1;
        courseDetails.push({ courseId: c.id, courseTitle: c.title, averageCompletion: avgCompletion });
      }
    });

    if (strugglingCourseCount > 0) {
      supportList.push({
        instructorId: inst.id,
        instructorName: inst.name,
        instructorAvatar: inst.avatar || 'default-avatar.png',
        strugglingCourseCount,
        totalAssignedCourses: totalCourses,
        supportReason: `${strugglingCourseCount} course(s) exhibit low average completion rate (<40%).`,
        recommendedInstitutionalAction: 'Allocate Teaching Assistant (TA) support or conduct instructional content review.',
        affectedCourses: courseDetails
      });
    }
  });

  return {
    dataStatus: supportList.length > 0 ? 'SUFFICIENT' : 'ALL_INSTRUCTORS_SUPPORTED',
    instructorsNeedingSupportCount: supportList.length,
    instructors: supportList
  };
}

/**
 * Generates macro-level institutional action recommendations for platform administrators.
 */
export async function getInstitutionalRecommendations() {
  const recommendations = [];

  const [
    crossProblems,
    instructorSupport,
    matrixData
  ] = await Promise.all([
    getCrossCourseLearningProblems(),
    getInstructorsNeedingSupport(),
    getCourseEngagementCompletionMatrix()
  ]);

  if (crossProblems.crossCourseProblems && crossProblems.crossCourseProblems.length > 0) {
    crossProblems.crossCourseProblems.forEach(cp => {
      recommendations.push({
        id: `rec-inst-prob-${cp.topic.replace(/\s+/g, '-').toLowerCase()}`,
        recommendationType: 'INSTITUTIONAL_CURRICULUM_REVIEW',
        priority: 'HIGH',
        title: `Curriculum Review: ${cp.topic}`,
        reason: cp.evidenceSignal,
        actionLabel: 'Schedule Institutional Curriculum Review',
        dataStatus: 'SUFFICIENT'
      });
    });
  }

  if (instructorSupport.instructors && instructorSupport.instructors.length > 0) {
    instructorSupport.instructors.forEach(inst => {
      recommendations.push({
        id: `rec-inst-supp-${inst.instructorId}`,
        recommendationType: 'FACULTY_RESOURCE_ALLOCATION',
        priority: 'MEDIUM',
        title: `TA Resource Allocation: ${inst.instructorName}`,
        reason: inst.supportReason,
        actionLabel: 'Allocate TA / Instructional Support',
        dataStatus: 'SUFFICIENT'
      });
    });
  }

  return {
    dataStatus: recommendations.length > 0 ? 'SUFFICIENT' : 'OPTIMAL_PLATFORM_HEALTH',
    totalRecommendations: recommendations.length,
    recommendations
  };
}
