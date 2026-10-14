import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeAction, classifyAction } from '../src/lib/action-policy.ts';

test('classifies supported actions by risk', () => {
  assert.equal(classifyAction('health.read'), 'read-only');
  assert.equal(classifyAction('gateway.start'), 'routine');
  assert.equal(classifyAction('gateway.restart'), 'sensitive');
  assert.equal(classifyAction('system.boost'), 'sensitive');
  assert.equal(classifyAction('system.exec.mutation'), 'destructive');
});

test('allows read-only and routine actions without confirmation', () => {
  assert.deepEqual(authorizeAction('health.read'), { allowed: true, risk: 'read-only' });
  assert.deepEqual(authorizeAction('gateway.start'), { allowed: true, risk: 'routine' });
});

test('blocks sensitive actions before execution when confirmation is missing', () => {
  const decision = authorizeAction('gateway.restart');
  assert.equal(decision.allowed, false);
  assert.equal(decision.status, 428);
  assert.match(decision.reason, /confirmation/i);
});

test('requires confirmation to name the exact sensitive action', () => {
  assert.equal(authorizeAction('gateway.restart', 'gateway.stop').allowed, false);
  assert.equal(authorizeAction('gateway.restart', true).allowed, false);
  assert.deepEqual(authorizeAction('gateway.restart', 'gateway.restart'), {
    allowed: true,
    risk: 'sensitive',
  });
});

test('fails closed for unregistered and destructive actions', () => {
  assert.equal(authorizeAction('shell.run').allowed, false);
  const destructive = authorizeAction('system.exec.mutation', 'system.exec.mutation');
  assert.equal(destructive.allowed, false);
  assert.equal(destructive.status, 403);
});
