/**
 * universalRoleIntelligenceService.js
 * 
 * EDOT Universal Role Intelligence Ecosystem Core Service
 * 
 * Dynamically computes role-aware, privacy-protected, relationship-aware intelligence DTOs
 * answering the 3 Core Philosophy questions for every EDOT role:
 *   1. What is happening? (Clear Status)
 *   2. Why does it matter? (Understandable Explanation)
 *   3. What should I do next? (Recommended Action)
 * 
 * Primary Supported Roles:
 *   - 🎓 Student
 *   - 👨‍🏫 Instructor / Teacher
 *   - 🏛️ Administrator
 *   - 👨‍👩‍👧 Parent / Guardian
 *   - 🤝 Sponsor
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Main entry point: Resolves Universal Role Intelligence for a given authenticated user.
 * 
 * @param {object} authUser - The authenticated user object (req.user)
 * @param {string} [requestedRole] - Optional override role for multi-role preview (e.g. admin)
 * @returns {Promise<object>} Role Intelligence DTO
 */
export async function getUniversalRoleIntelligence(authUser, requestedRole = null) {
  if (!authUser || !authUser.id) {
    throw new Error('Authentication required for Universal Role Intelligence.');
  }

  const role = (requestedRole && authUser.role === 'admin') ? requestedRole : (authUser.role || 'student');
  const userId = authUser.id;

  try {
    switch (role.toLowerCase()) {
      case 'student':
        return await computeStudentIntelligence(userId, authUser);
      case 'instructor':
      case 'teacher':
        return await computeInstructorIntelligence(userId, authUser);
      case 'admin':
      case 'administrator':
        return await computeAdminIntelligence(userId, authUser);
      case 'parent':
      case 'guardian':
        return await computeParentIntelligence(userId, authUser);
      case 'sponsor':
        return await computeSponsorIntelligence(userId, authUser);
      default:
        return await computeStudentIntelligence(userId, authUser);
    }
  } catch (error) {
    console.error(`Error computing intelligence for role [${role}] (User: ${userId}):`, error);
    // Failure isolation fallback
    return getFallbackRoleIntelligence(role, authUser);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎓 1. STUDENT INTELLIGENCE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
async function computeStudentIntelligence(userId, authUser) {
  const [
    userProgresses,
    learnerProfile,
    recentEvents,
    weaknesses
  ] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, mainCategory: true } } }
    }).catch(() => []),
    prisma.learnerProfile.findUnique({ where: { userId } }).catch(() => null),
    prisma.learningEvent.findMany({
      where: { userId, timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { timestamp: 'desc' },
      take: 20
    }).catch(() => []),
    prisma.learnerWeakness.findMany({
      where: { userId, isResolved: false },
      take: 3
    }).catch(() => [])
  ]);

  const activeCoursesCount = userProgresses.length;
  const totalProgress = userProgresses.reduce((acc, p) => acc + (p.progress || 0), 0);
  const avgProgress = activeCoursesCount > 0 ? Math.round(totalProgress / activeCoursesCount) : 0;
  const completedCoursesCount = userProgresses.filter(p => p.progress >= 100 || p.completed).length;

  const currentStatus = avgProgress >= 80 ? 'HIGH_MOMENTUM' : (avgProgress >= 40 ? 'ON_TRACK' : (activeCoursesCount === 0 ? 'NOT_ENROLLED' : 'NEEDS_ATTENTION'));

  let statusSummary = 'Making steady academic progress across enrolled courses.';
  if (activeCoursesCount === 0) statusSummary = 'No active course enrollments yet. Explore courses to begin.';
  else if (currentStatus === 'HIGH_MOMENTUM') statusSummary = `Exceptional momentum! ${avgProgress}% average completion rate across ${activeCoursesCount} active courses.`;
  else if (currentStatus === 'NEEDS_ATTENTION') statusSummary = `Learning pace has slowed. Average course progress is currently ${avgProgress}%.`;

  let explanation = 'Your intelligence profile tracks real-time lesson completions, quiz attempts, and study consistency.';
  if (weaknesses.length > 0) {
    explanation = `Analysis shows ${weaknesses.length} topic gap(s) identified in recent exercises (e.g. ${weaknesses[0].topic || 'recent module'}). Reviewing these will boost mastery.`;
  } else if (recentEvents.length > 10) {
    explanation = 'High study activity detected in the past 7 days. Consistency is accelerating your concept retention.';
  } else if (activeCoursesCount > 0) {
    explanation = 'Regular short study sessions (15-30 mins) help maintain retention momentum across your modules.';
  }

  const primaryNextCourse = userProgresses.find(p => p.progress < 100) || userProgresses[0];
  let recommendedAction = {
    title: primaryNextCourse ? `Resume: ${primaryNextCourse.course?.title || 'Active Course'}` : 'Browse Available Courses',
    description: primaryNextCourse ? `Continue your current progress (${primaryNextCourse.progress}% completed)` : 'Enroll in a new course to build job-ready skills.',
    buttonText: primaryNextCourse ? 'Continue Learning' : 'Explore Catalog',
    actionUrl: primaryNextCourse ? `/course/${primaryNextCourse.courseId}` : '/courses'
  };

  return {
    role: 'student',
    user: { id: userId, name: authUser.name, avatar: authUser.avatar },
    questions: {
      whatIsHappening: {
        statusBadge: currentStatus,
        summary: statusSummary,
        metrics: [
          { label: 'Active Courses', value: activeCoursesCount, icon: 'BookOpen' },
          { label: 'Avg Progress', value: `${avgProgress}%`, icon: 'TrendingUp' },
          { label: 'Completed', value: completedCoursesCount, icon: 'CheckCircle2' },
          { label: 'Focus Topics', value: weaknesses.length > 0 ? weaknesses.length : 'All Clear', icon: 'Target' }
        ]
      },
      whyItMatters: {
        title: 'Academic Intelligence Insight',
        explanation: explanation,
        groundingSources: ['Course Completion Telemetry', 'Learner Profile Engine', 'Quiz Attempt Logs']
      },
      whatToDoNext: recommendedAction
    },
    generatedAt: new Date()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 👨‍🏫 2. INSTRUCTOR INTELLIGENCE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
async function computeInstructorIntelligence(userId, authUser) {
  const [
    coursesTaught,
    userProgresses,
    recentEvents
  ] = await Promise.all([
    prisma.course.findMany({
      where: { instructorId: userId },
      select: { id: true, title: true, totalStudents: true, category: true }
    }).catch(() => []),
    prisma.userCourseProgress.findMany({
      where: { course: { instructorId: userId } },
      select: { userId: true, progress: true, courseId: true }
    }).catch(() => []),
    prisma.learningEvent.findMany({
      where: { course: { instructorId: userId }, timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { userId: true }
    }).catch(() => [])
  ]);

  const activeCourseCount = coursesTaught.length;
  const enrolledUserIds = new Set(userProgresses.map(p => p.userId));
  const totalEnrolledStudents = enrolledUserIds.size;
  const activeStudentSet = new Set(recentEvents.map(e => e.userId));
  const activeStudents7d = activeStudentSet.size;

  const strugglingStudentsCount = userProgresses.filter(p => p.progress < 25).length;
  const totalProgress = userProgresses.reduce((acc, p) => acc + (p.progress || 0), 0);
  const avgClassProgress = userProgresses.length > 0 ? Math.round(totalProgress / userProgresses.length) : 0;

  const healthStatus = strugglingStudentsCount > 5 ? 'ATTENTION_NEEDED' : (activeCourseCount === 0 ? 'NO_COURSES' : 'HEALTHY');

  let summary = `Managing ${activeCourseCount} active course(s) with ${totalEnrolledStudents} total student enrollment(s).`;
  if (activeCourseCount === 0) summary = 'No courses currently assigned or authored. Create a course to view teaching intelligence.';
  else if (healthStatus === 'ATTENTION_NEEDED') summary = `${strugglingStudentsCount} student(s) currently need targeted academic intervention in your classes.`;

  let explanation = `Class engagement index shows ${activeStudents7d} out of ${totalEnrolledStudents} students active in the past 7 days.`;
  if (strugglingStudentsCount > 0) {
    explanation += ` Early support for students with <25% progress significantly improves course completion rates.`;
  }

  return {
    role: 'instructor',
    user: { id: userId, name: authUser.name, avatar: authUser.avatar },
    questions: {
      whatIsHappening: {
        statusBadge: healthStatus,
        summary: summary,
        metrics: [
          { label: 'Active Courses', value: activeCourseCount, icon: 'GraduationCap' },
          { label: 'Total Students', value: totalEnrolledStudents, icon: 'Users' },
          { label: 'Active (7d)', value: activeStudents7d, icon: 'Activity' },
          { label: 'Avg Class Progress', value: `${avgClassProgress}%`, icon: 'BarChart3' }
        ]
      },
      whyItMatters: {
        title: 'Teaching Performance Intelligence',
        explanation: explanation,
        groundingSources: ['Class Roster Telemetry', 'Student Progress Logs', 'Course Activity Feed']
      },
      whatToDoNext: {
        title: activeCourseCount > 0 ? 'Review Students Needing Support' : 'Create New Course',
        description: activeCourseCount > 0 ? `Identify and message ${strugglingStudentsCount} student(s) who may need assistance.` : 'Build new lessons and quizzes using the Course Builder.',
        buttonText: activeCourseCount > 0 ? 'Open Class Manager' : 'Open Course Builder',
        actionUrl: activeCourseCount > 0 ? '/dashboard/my-courses' : '/dashboard/builder'
      }
    },
    generatedAt: new Date()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏛️ 3. ADMINISTRATOR INTELLIGENCE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
async function computeAdminIntelligence(userId, authUser) {
  const [
    totalStudents,
    totalInstructors,
    totalCourses,
    totalEnrollments,
    recentEvents,
    userProgresses
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }).catch(() => 0),
    prisma.user.count({ where: { role: 'instructor' } }).catch(() => 0),
    prisma.course.count().catch(() => 0),
    prisma.enrollment.count({ where: { status: 'approved' } }).catch(() => 0),
    prisma.learningEvent.findMany({
      where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { userId: true }
    }).catch(() => []),
    prisma.userCourseProgress.findMany({ select: { progress: true } }).catch(() => [])
  ]);

  const activeStudentSet = new Set(recentEvents.map(e => e.userId));
  const activeStudents7d = activeStudentSet.size;
  const activeRatio = totalStudents > 0 ? Math.round((activeStudents7d / totalStudents) * 100) : 0;

  const totalProgress = userProgresses.reduce((acc, p) => acc + (p.progress || 0), 0);
  const globalCompletionRate = userProgresses.length > 0 ? Math.round(totalProgress / userProgresses.length) : 0;

  const platformHealth = activeRatio >= 50 ? 'EXCELLENT' : (activeRatio >= 25 ? 'HEALTHY' : 'WATCH');

  return {
    role: 'admin',
    user: { id: userId, name: authUser.name, avatar: authUser.avatar },
    questions: {
      whatIsHappening: {
        statusBadge: platformHealth,
        summary: `Platform institutional overview: ${totalStudents} students, ${totalInstructors} instructors across ${totalCourses} active courses.`,
        metrics: [
          { label: 'Total Learners', value: totalStudents, icon: 'Users' },
          { label: 'Active (7d)', value: `${activeRatio}%`, icon: 'Flame' },
          { label: 'Total Courses', value: totalCourses, icon: 'BookOpen' },
          { label: 'Global Completion', value: `${globalCompletionRate}%`, icon: 'TrendingUp' }
        ]
      },
      whyItMatters: {
        title: 'Institutional Macro Intelligence',
        explanation: `${activeStudents7d} learners engaged with course content in the past 7 days. Platform health is rated ${platformHealth} based on retention and completion metrics.`,
        groundingSources: ['Institutional Telemetry Engine', 'Enrollment Matrix', 'Global Learning Pulse']
      },
      whatToDoNext: {
        title: 'Manage Platform Governance',
        description: 'Review pending course approvals, instructor rosters, and institutional performance reports.',
        buttonText: 'Open Admin Hub',
        actionUrl: '/dashboard/users'
      }
    },
    generatedAt: new Date()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 👨‍👩‍👧 4. PARENT / GUARDIAN INTELLIGENCE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
async function computeParentIntelligence(userId, authUser) {
  const children = await prisma.user.findMany({
    where: { parentId: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      userCourseProgress: {
        include: { course: { select: { title: true } } }
      }
    }
  }).catch(() => []);

  const linkedCount = children.length;
  let totalChildProgress = 0;
  let totalChildCourses = 0;

  children.forEach(child => {
    child.userCourseProgress.forEach(cp => {
      totalChildProgress += cp.progress || 0;
      totalChildCourses++;
    });
  });

  const avgChildProgress = totalChildCourses > 0 ? Math.round(totalChildProgress / totalChildCourses) : 0;
  const status = linkedCount > 0 ? 'CONNECTED' : 'NO_LINKED_STUDENTS';

  let summary = linkedCount > 0 ? `Monitoring learning progress for ${linkedCount} linked child(ren).` : 'No linked student accounts found. Connect your child to view guardian intelligence.';
  let explanation = linkedCount > 0
    ? `Combined course completion average is ${avgChildProgress}% across ${totalChildCourses} enrolled course(s). Regular parental support improves study consistency.`
    : 'Linking your student account enables non-judgmental progress tracking and direct encouragement messaging.';

  const firstChild = children[0];

  return {
    role: 'parent',
    user: { id: userId, name: authUser.name, avatar: authUser.avatar },
    questions: {
      whatIsHappening: {
        statusBadge: status,
        summary: summary,
        metrics: [
          { label: 'Linked Students', value: linkedCount, icon: 'Users' },
          { label: 'Enrolled Courses', value: totalChildCourses, icon: 'BookOpen' },
          { label: 'Avg Completion', value: `${avgChildProgress}%`, icon: 'TrendingUp' },
          { label: 'Support Status', value: 'Active', icon: 'ShieldCheck' }
        ]
      },
      whyItMatters: {
        title: 'Guardian Supportive Intelligence',
        explanation: explanation,
        groundingSources: ['Student Progress Logs', 'Guardian Consent Layer', 'Encouragement Telemetry']
      },
      whatToDoNext: {
        title: firstChild ? `View Progress for ${firstChild.name}` : 'Link Student Account',
        description: firstChild ? 'Check recent achievements and send a word of encouragement.' : 'Enter your child\'s student ID or email to link accounts.',
        buttonText: firstChild ? 'View Child Progress' : 'Link Account',
        actionUrl: firstChild ? `/dashboard/child` : '/dashboard/settings'
      }
    },
    generatedAt: new Date()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🤝 5. SPONSOR INTELLIGENCE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
async function computeSponsorIntelligence(userId, authUser) {
  const sponsorships = await prisma.sponsorship.findMany({
    where: { sponsorId: userId },
    include: {
      targetStudent: {
        select: { id: true, name: true, avatar: true }
      }
    }
  }).catch(() => []);

  const supportedStudentsCount = sponsorships.length;
  const totalContributions = sponsorships.reduce((sum, s) => sum + (s.amount || 0), 0);

  const status = supportedStudentsCount > 0 ? 'ACTIVE_IMPACT' : 'NO_ACTIVE_SPONSORSHIPS';
  let summary = supportedStudentsCount > 0
    ? `Sponsoring ${supportedStudentsCount} student(s) with $${totalContributions.toLocaleString()} in educational support.`
    : 'No active student sponsorships found. Partner with EDOT to fund learning initiatives.';

  let explanation = supportedStudentsCount > 0
    ? `Your sponsorship directly funds course materials, certificates, and academic resources for high-potential learners.`
    : 'Sponsoring students creates high-impact educational opportunities and career advancement.';

  return {
    role: 'sponsor',
    user: { id: userId, name: authUser.name, avatar: authUser.avatar },
    questions: {
      whatIsHappening: {
        statusBadge: status,
        summary: summary,
        metrics: [
          { label: 'Supported Students', value: supportedStudentsCount, icon: 'Users' },
          { label: 'Total Impact', value: `$${totalContributions.toLocaleString()}`, icon: 'Award' },
          { label: 'Active Programs', value: supportedStudentsCount > 0 ? 1 : 0, icon: 'Rocket' },
          { label: 'Impact Status', value: 'High', icon: 'Sparkles' }
        ]
      },
      whyItMatters: {
        title: 'Sponsorship Human Impact',
        explanation: explanation,
        groundingSources: ['Sponsorship Ledger', 'Student Progress Metrics', 'Impact Analytics']
      },
      whatToDoNext: {
        title: supportedStudentsCount > 0 ? 'View Sponsored Cohort' : 'Support a Student',
        description: supportedStudentsCount > 0 ? 'Review recent progress updates and thank-you messages from supported learners.' : 'Explore student sponsorship programs and make an impact.',
        buttonText: supportedStudentsCount > 0 ? 'View Sponsor Dashboard' : 'Sponsor Students',
        actionUrl: supportedStudentsCount > 0 ? '/dashboard/sponsor' : '/sponsorship'
      }
    },
    generatedAt: new Date()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ FAILURE ISOLATION FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function getFallbackRoleIntelligence(role, authUser) {
  return {
    role: role || 'student',
    user: { id: authUser?.id || 'guest', name: authUser?.name || 'User' },
    questions: {
      whatIsHappening: {
        statusBadge: 'INITIALIZING',
        summary: `EDOT ${role.toUpperCase()} Intelligence Ecosystem initialized.`,
        metrics: [
          { label: 'System Status', value: 'Ready', icon: 'CheckCircle2' },
          { label: 'Role Context', value: role.toUpperCase(), icon: 'User' }
        ]
      },
      whyItMatters: {
        title: 'Role Intelligence System',
        explanation: 'Your dynamic role intelligence provides status, explanation, and next action recommendations tailored to your account.',
        groundingSources: ['EDOT Core Platform']
      },
      whatToDoNext: {
        title: 'Explore EDOT Platform',
        description: 'Navigate to your dashboard to view active learning services.',
        buttonText: 'Open Dashboard',
        actionUrl: '/dashboard'
      }
    },
    generatedAt: new Date()
  };
}
