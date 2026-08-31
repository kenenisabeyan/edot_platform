/**
 * progressIntelligenceTranslator.js
 * 
 * EDOT Universal Progress Explainer
 * 
 * Translates identical underlying telemetry into non-judgmental, role-tailored language:
 *   - 🎓 Student: Supportive, empowering encouragement (e.g. "Your activity has slowed recently. Would you like help?")
 *   - 👨‍🏫 Instructor: Pedagogical check-in suggestion (e.g. "Recent activity has decreased. A supportive check-in may be helpful.")
 *   - 👨‍👩‍👧 Parent: Positive family guidance (e.g. "Your student has been less active recently. Encouragement may help.")
 *   - 🤝 Sponsor: Impact summary (e.g. "Some sponsored learners have shown reduced activity recently.")
 *   - 🏛️ Admin: Macro trend overview (e.g. "Reduced learner activity detected across multiple areas.")
 */

export function translateProgressForRole({ statusCode, avgProgress, daysInactive, weaknessCount, viewerRole, studentName }) {
  const role = (viewerRole || 'student').toLowerCase().trim();
  const name = studentName || 'the student';

  switch (role) {
    case 'student':
      return translateForStudent(statusCode, avgProgress, daysInactive, weaknessCount);
    case 'instructor':
    case 'teacher':
      return translateForInstructor(statusCode, name, daysInactive, weaknessCount);
    case 'parent':
    case 'guardian':
      return translateForParent(statusCode, name, daysInactive);
    case 'sponsor':
      return translateForSponsor(statusCode, name, avgProgress);
    case 'admin':
    case 'administrator':
      return translateForAdmin(statusCode, avgProgress);
    default:
      return translateForStudent(statusCode, avgProgress, daysInactive, weaknessCount);
  }
}

function translateForStudent(statusCode, avgProgress, daysInactive, weaknessCount) {
  switch (statusCode) {
    case 'ON_TRACK':
      return {
        statusLabel: '🟢 On Track',
        humanSummary: 'You are making steady, consistent progress across your enrolled courses!',
        recommendedAction: 'Keep up your current study routine to solidify concept retention.'
      };
    case 'ACHIEVEMENT_MILESTONE':
      return {
        statusLabel: '🟣 Milestone Reached',
        humanSummary: 'Congratulations! You recently unlocked an achievement in your learning journey.',
        recommendedAction: 'Share your achievement or tackle the next advanced topic.'
      };
    case 'RETURNING':
      return {
        statusLabel: '🔵 Welcome Back',
        humanSummary: 'Great to see you back! Resuming your study session will help rebuild momentum.',
        recommendedAction: 'Complete a quick 10-minute quiz to refresh recent concepts.'
      };
    case 'NEEDS_ATTENTION':
      return {
        statusLabel: '🟡 Making Progress',
        humanSummary: 'Your learning pace has slowed slightly recently. Would you like help getting into a comfortable routine?',
        recommendedAction: 'Review your next recommended short lesson.'
      };
    case 'SUPPORT_RECOMMENDED':
      return {
        statusLabel: '🟠 Assistance Available',
        humanSummary: `You have ${weaknessCount > 0 ? `${weaknessCount} focus area(s)` : 'topics'} where quick extra review will boost confidence.`,
        recommendedAction: 'Ask your AI Mentor for a step-by-step breakdown.'
      };
    default:
      return {
        statusLabel: '⚪ Ready to Begin',
        humanSummary: 'Welcome! Start exploring your course modules to build your learning profile.',
        recommendedAction: 'Open your first lesson video or module.'
      };
  }
}

function translateForInstructor(statusCode, studentName, daysInactive, weaknessCount) {
  switch (statusCode) {
    case 'ON_TRACK':
      return {
        statusLabel: '🟢 Progressing Well',
        humanSummary: `${studentName} is actively engaged and completing lessons on schedule.`,
        recommendedAction: 'Continue positive encouragement during class sessions.'
      };
    case 'NEEDS_ATTENTION':
    case 'SUPPORT_RECOMMENDED':
      return {
        statusLabel: '🟠 Support Recommended',
        humanSummary: `${studentName}'s recent course activity has decreased (${daysInactive} days inactive). A supportive check-in may be helpful.`,
        recommendedAction: 'Send a quick encouraging message or review session invite.'
      };
    default:
      return {
        statusLabel: '🟡 Steady Activity',
        humanSummary: `${studentName} is maintaining steady participation in assigned course modules.`,
        recommendedAction: 'Monitor progress on upcoming assignments.'
      };
  }
}

function translateForParent(statusCode, studentName, daysInactive) {
  switch (statusCode) {
    case 'ON_TRACK':
    case 'ACHIEVEMENT_MILESTONE':
      return {
        statusLabel: '🟢 Doing Great',
        humanSummary: `${studentName} has been consistently learning and achieving milestones this week!`,
        recommendedAction: 'Send a word of praise to celebrate their hard work.'
      };
    case 'NEEDS_ATTENTION':
    case 'SUPPORT_RECOMMENDED':
      return {
        statusLabel: '🟡 Encouragement Helpful',
        humanSummary: `${studentName} has been less active recently. Encouragement may help them return to their learning routine.`,
        recommendedAction: 'Send a supportive reminder message.'
      };
    default:
      return {
        statusLabel: '🟢 Learning Steadily',
        humanSummary: `${studentName} is continuing their educational activities at EDOT.`,
        recommendedAction: 'Check in on what they learned today.'
      };
  }
}

function translateForSponsor(statusCode, studentName, avgProgress) {
  switch (statusCode) {
    case 'ON_TRACK':
    case 'ACHIEVEMENT_MILESTONE':
      return {
        statusLabel: '🟢 High Impact',
        humanSummary: `${studentName} is achieving strong milestone completion (${avgProgress}% average progress).`,
        recommendedAction: 'Review cohort achievement updates.'
      };
    default:
      return {
        statusLabel: '🟡 In Progress',
        humanSummary: `${studentName} is progressing through sponsored learning modules.`,
        recommendedAction: 'Check sponsorship impact reports.'
      };
  }
}

function translateForAdmin(statusCode, avgProgress) {
  return {
    statusLabel: statusCode,
    humanSummary: `Platform learner activity index: ${avgProgress}% average completion rate across tracked cohorts.`,
    recommendedAction: 'Review institutional support and growth metrics.'
  };
}
