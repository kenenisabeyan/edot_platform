import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkContent, rankRelevantChunks } from '../services/courseIntelligenceService.js';

test('chunkContent splits large text into manageable parts', () => {
  const text = 'Alpha beta gamma. '.repeat(300);
  const chunks = chunkContent(text, 200);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 200));
});

test('rankRelevantChunks prioritizes chunks matching the user question', () => {
  const chunks = [
    'This lesson explains neural networks and supervised learning.',
    'The course covers JavaScript fundamentals for beginners.',
    'Students learn how to debug React components.'
  ];

  const ranked = rankRelevantChunks('neural networks', chunks);
  assert.equal(ranked[0], chunks[0]);
});
