const test = require('node:test');
const assert = require('node:assert/strict');

const { parseModelJson } = require('../tools/local_preview');

test('parses clean json content', () => {
  const parsed = parseModelJson('{"analysis":{"hiddenIntent":"先给结果"},"tracks":[{"id":"align","reply":"收到，我先给版本。"}]}');

  assert.equal(parsed.analysis.hiddenIntent, '先给结果');
  assert.equal(parsed.tracks[0].id, 'align');
});

test('parses json wrapped in extra content', () => {
  const parsed = parseModelJson('好的，结果如下： {"tracks":[{"id":"align","reply":"收到"}]}');

  assert.equal(parsed.tracks[0].reply, '收到');
});
