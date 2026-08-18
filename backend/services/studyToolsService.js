export function buildPersonalizedStudyContext({ profile = {}, enrollments = [] } = {}) {
  const strengths = Array.isArray(profile?.strengths) ? profile.strengths : [];
  const weaknesses = Array.isArray(profile?.weaknesses) ? profile.weaknesses : [];
  const activeCourses = enrollments
    .map((entry) => entry.course?.title)
    .filter(Boolean)
    .slice(0, 4);

  const studyTopics = [
    ...(weaknesses || []),
    ...(activeCourses || []),
    ...(strengths || [])
  ].filter(Boolean);

  const currentFocus = profile?.currentFocus || activeCourses[0] || 'personal growth';

  return {
    currentFocus,
    activeCourses,
    studyTopics,
    strengths,
    weaknesses,
    personalizationSummary: `Personalized study support for ${currentFocus} with focus on ${studyTopics.slice(0, 3).join(', ')}`
  };
}

export function normalizeQuizQuestions(questions = []) {
  return (Array.isArray(questions) ? questions : []).map((question) => {
    const normalized = {
      question: question?.question || '',
      type: question?.type === 'short_answer' ? 'short_answer' : (question?.type === 'true_false' ? 'true_false' : 'mcq'),
      correctAnswer: question?.correctAnswer || '',
      explanation: question?.explanation || '',
      options: Array.isArray(question?.options) ? question.options : []
    };

    if (normalized.type === 'short_answer') {
      normalized.options = [];
      normalized.acceptableAnswers = Array.isArray(question?.acceptableAnswers)
        ? question.acceptableAnswers.map((answer) => String(answer).trim()).filter(Boolean)
        : [String(question?.correctAnswer || '').trim()].filter(Boolean);
    } else if (normalized.type === 'true_false') {
      normalized.options = ['True', 'False'];
      normalized.correctAnswer = String(question?.correctAnswer || 'True');
    } else {
      normalized.options = Array.isArray(question?.options) ? question.options.slice(0, 4) : [];
      normalized.correctAnswer = String(question?.correctAnswer || '');
    }

    return normalized;
  });
}

export default {
  buildPersonalizedStudyContext,
  normalizeQuizQuestions
};
