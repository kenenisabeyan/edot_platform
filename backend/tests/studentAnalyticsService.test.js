import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentIntelligenceSummary } from '../services/studentAnalyticsService.js';

test('buildStudentIntelligenceSummary derives behavior-aware insights', () => {
  const summary = buildStudentIntelligenceSummary({
    enrollments: [
      { progress: 85, course: { title: 'AI Foundations' } },
      { progress: 45, course: { title: 'Data Structures' } }
    ],
    progressLogs: [
      { updatedAt: new Date('2026-07-10') },
      { updatedAt: new Date('2026-07-11') },
      { updatedAt: new Date('2026-07-12') }
    ],
    profile: { quizAverage: 82, weaknesses: ['recursion', 'debugging'] },
    historyEvents: [{ score: 70 }, { score: 88 }]
  });

  assert.equal(summary.courseProgress, 65);
  assert.equal(summary.quizPerformance, 82);
  assert.ok(summary.weakConcepts.includes('recursion'));
  assert.ok(summary.recommendedAction.includes('recursion'));
  assert.ok(summary.learningPattern.includes('consistent'));
});
