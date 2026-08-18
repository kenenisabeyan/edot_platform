import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalizedStudyContext, normalizeQuizQuestions } from '../services/studyToolsService.js';

test('buildPersonalizedStudyContext derives personalized study topics', () => {
  const context = buildPersonalizedStudyContext({
    profile: {
      currentFocus: 'React development',
      strengths: ['HTML', 'CSS'],
      weaknesses: ['JavaScript', 'State management']
    },
    enrollments: [
      { course: { title: 'Frontend Foundations', mainCategory: 'Programming & Technology' } },
      { course: { title: 'Modern JavaScript', mainCategory: 'Programming & Technology' } }
    ]
  });

  assert.equal(context.currentFocus, 'React development');
  assert.ok(context.activeCourses.includes('Frontend Foundations'));
  assert.ok(context.studyTopics.includes('JavaScript'));
  assert.ok(context.personalizationSummary.includes('React development'));
});

test('normalizeQuizQuestions preserves short-answer questions with acceptable answers', () => {
  const normalized = normalizeQuizQuestions([
    {
      question: 'What is the powerhouse of the cell?',
      type: 'short_answer',
      correctAnswer: 'Mitochondria',
      acceptableAnswers: ['mitochondria', 'the mitochondria']
    }
  ]);

  assert.equal(normalized[0].type, 'short_answer');
  assert.deepEqual(normalized[0].acceptableAnswers, ['mitochondria', 'the mitochondria']);
  assert.deepEqual(normalized[0].options, []);
});
