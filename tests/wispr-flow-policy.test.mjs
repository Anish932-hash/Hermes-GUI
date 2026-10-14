import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DICTATION_LIMIT, parseDictationLimit } from '../src/lib/wispr-flow-policy.ts';

test('uses the default dictation limit for missing or blank values', () => {
  assert.equal(parseDictationLimit(null), 15);
  assert.equal(parseDictationLimit(''), 15);
  assert.equal(parseDictationLimit('   '), 15);
});

test('accepts only whole-number limits in the supported range', () => {
  assert.equal(parseDictationLimit('1'), 1);
  assert.equal(parseDictationLimit('15'), 15);
  assert.equal(parseDictationLimit(String(MAX_DICTATION_LIMIT)), MAX_DICTATION_LIMIT);
  for (const value of ['0', '51', '-1', '1.5', '12abc', 'abc', '\\\\d', '1e2']) {
    assert.equal(parseDictationLimit(value), null, value);
  }
});
