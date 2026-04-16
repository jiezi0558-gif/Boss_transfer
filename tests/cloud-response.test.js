const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeModelResult,
} = require('../cloudfunctions/analyzeChat/response');

test('defaults to align when recommendedTrackId is missing', () => {
  const normalized = normalizeModelResult({
    result: {
      analysis: {
        hiddenIntent: '先给结果。',
      },
      tracks: [
        { id: 'smooth', reply: '先接住。' },
        { id: 'align', reply: '先对齐。' },
        { id: 'reject', reply: '先收边界。' },
      ],
    },
    scenario: {
      urgent: true,
      overScope: false,
    },
    unlockPremium: false,
  });

  assert.equal(normalized.recommendedTrackId, 'align');
  assert.equal(normalized.premium, null);
});

test('keeps only valid tracks with reply content', () => {
  const normalized = normalizeModelResult({
    result: {
      recommendedTrackId: 'smooth',
      tracks: [
        { id: 'smooth', reply: '先接住。' },
        { id: 'align', reply: '' },
        { id: 'other', reply: 'ignore me' },
      ],
    },
    scenario: {
      urgent: false,
      overScope: false,
    },
    unlockPremium: true,
  });

  assert.deepEqual(
    normalized.tracks.map((track) => track.id),
    ['smooth']
  );
  assert.equal(normalized.recommendedTrackId, 'smooth');
  assert.equal(normalized.premium.escalationTip, '先给结果，再补风险和下一步时间点。');
});

test('prefers reject when scope is too broad and reject exists', () => {
  const normalized = normalizeModelResult({
    result: {
      tracks: [
        { id: 'smooth', reply: '先接住。' },
        { id: 'align', reply: '先对齐。' },
        { id: 'reject', reply: '先收边界。' },
      ],
    },
    scenario: {
      urgent: false,
      overScope: true,
    },
    unlockPremium: false,
  });

  assert.equal(normalized.recommendedTrackId, 'reject');
});
