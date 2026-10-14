import test from 'node:test';
import assert from 'node:assert/strict';
import { observedMemoryDecrease } from '../src/lib/system-boost-policy.ts';

test('computes only observed positive memory decrease', () => {
  assert.equal(observedMemoryDecrease(1200, 1100), 100);
});

test('reports zero when usage did not decrease', () => {
  assert.equal(observedMemoryDecrease(1100, 1200), 0);
  assert.equal(observedMemoryDecrease(1100, 1100), 0);
});

test('keeps unavailable memory measurements unknown', () => {
  assert.equal(observedMemoryDecrease(null, 1100), null);
  assert.equal(observedMemoryDecrease(1100, null), null);
  assert.equal(observedMemoryDecrease(null, null), null);
});
