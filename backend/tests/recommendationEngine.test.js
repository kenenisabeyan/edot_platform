import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendationBundle } from '../services/recommendationEngineService.js';

test('buildRecommendationBundle recommends progression for front-end learners', () => {
  const bundle = buildRecommendationBundle({
    goals: ['Become a full stack developer'],
    interests: ['Web development', 'Programming'],
    strengths: ['HTML', 'CSS', 'JavaScript'],
    weaknesses: ['React'],
    quizAverage: 82,
    completedCourses: 3,
    progressSignals: [
      { title: 'HTML Essentials', category: 'Web Development' },
      { title: 'CSS Foundations', category: 'Web Development' },
      { title: 'JavaScript Basics', category: 'Web Development' }
    ],
    feedback: []
  });

  const skillNames = bundle.skills.map((skill) => skill.name);
  assert.ok(skillNames.includes('React'));
  assert.ok(skillNames.includes('Backend Development'));
  assert.ok(bundle.projects.some((project) => project.name.includes('Full Stack')));
  assert.ok(bundle.learningPaths.some((path) => path.title.includes('Full Stack')));
});
