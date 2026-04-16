const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveRecommendedTrackId,
  buildInsightTags,
} = require('../utils/interaction');

test('uses backend recommended track when it exists', () => {
  const tracks = [{ id: 'smooth' }, { id: 'align' }, { id: 'reject' }];

  assert.equal(resolveRecommendedTrackId(tracks, 'reject'), 'reject');
});

test('falls back to align when backend recommendation is missing', () => {
  const tracks = [{ id: 'smooth' }, { id: 'align' }, { id: 'reject' }];

  assert.equal(resolveRecommendedTrackId(tracks), 'align');
});

test('builds concise insight tags for high-pressure messages', () => {
  const tags = buildInsightTags({
    urgencyText: '高，需要立刻给出时间点',
    emotionText: '表面克制，实则不接受解释',
    riskLevelText: '高压场景',
  });

  assert.deepEqual(tags, ['高压', '不接受解释']);
});
