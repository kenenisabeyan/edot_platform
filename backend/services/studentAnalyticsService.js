export function buildStudentIntelligenceSummary({
  enrollments = [],
  progressLogs = [],
  profile = null,
  historyEvents = [],
  weaknesses = [],
  weeklyStudyData = []
} = {}) {
  const courseCount = enrollments.length || 0;
  const averageProgress = courseCount > 0
    ? Math.round(enrollments.reduce((sum, course) => sum + Number(course.progress || 0), 0) / courseCount)
    : 0;

  const completedCourses = enrollments.filter((course) => {
    const progress = Number(course.progress || 0);
    return progress >= 100 || course.completed || course.passedFinalExam;
  }).length;

  const quizPerformance = Number(profile?.quizAverage || 0);
  const derivedQuizAverage = quizPerformance > 0
    ? quizPerformance
    : Math.round(
        enrollments.reduce((sum, course) => sum + Number(course.score || 0), 0) / Math.max(courseCount, 1)
      );

  const weakConcepts = [
    ...(Array.isArray(profile?.weaknesses) ? profile.weaknesses : []),
    ...weaknesses.map((entry) => entry.topic || entry.name || entry).filter(Boolean)
  ].filter(Boolean);

  const strongestSkill = profile?.strengths?.[0] ||
    enrollments
      .filter((course) => Number(course.score || 0) > 0)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0]?.course?.title ||
    'Consistency and momentum';

  const improvementArea = weakConcepts[0] ||
    enrollments
      .filter((course) => Number(course.progress || 0) > 0)
      .sort((left, right) => Number(left.progress || 0) - Number(right.progress || 0))[0]?.course?.title ||
    'Foundational concepts';

  const recentActivityCount = historyEvents.length || progressLogs.length;
  const totalStudyHours = weeklyStudyData.reduce((sum, day) => sum + Number(day.hours || 0), 0)
    || Math.max(1, Math.round((recentActivityCount + completedCourses) / 3));

  const learningPattern = progressLogs.length >= 3 || recentActivityCount >= 3
    ? 'consistent'
    : 'building';

  const improvement = Math.max(0, Math.round(derivedQuizAverage - 40));

  const recommendedAction = weakConcepts.length > 0
    ? `Revisit ${weakConcepts[0]} with one focused practice session this week.`
    : averageProgress >= 70
      ? 'Maintain your stride and reinforce the latest lesson with a quick review.'
      : 'Increase your weekly study sessions and focus on one weak topic at a time.';

  const nextStep = averageProgress >= 70
    ? 'Complete the next milestone lesson and reinforce it with a short recap.'
    : 'Start with the next lesson in your active course and build a daily streak.';

  return {
    courseProgress: averageProgress,
    completedCourses,
    quizPerformance: derivedQuizAverage,
    totalStudyHours,
    improvement,
    strongestSkill,
    weakConcept: improvementArea,
    weakConcepts,
    recommendedAction,
    nextStep,
    learningPattern,
    studyMomentum: Math.min(100, Math.round(averageProgress + (derivedQuizAverage / 4)))
  };
}

export default {
  buildStudentIntelligenceSummary
};
