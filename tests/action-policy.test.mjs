import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeAction, classifyAction, runAuthorizedAction } from '../src/lib/action-policy.ts';

test('classifies supported actions by risk', () => {
  assert.equal(classifyAction('health.read'), 'read-only');
  assert.equal(classifyAction('gateway.start'), 'routine');
  assert.equal(classifyAction('gateway.restart'), 'sensitive');
  assert.equal(classifyAction('system.boost'), 'sensitive');
  assert.equal(classifyAction('system.auto-setup'), 'sensitive');
  assert.equal(classifyAction('windows.restart-daemons'), 'sensitive');
  assert.equal(classifyAction('config.raw-write'), 'sensitive');
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

test('a denied action never invokes its execution handler', async () => {
  let executions = 0;
  const result = await runAuthorizedAction('gateway.restart', undefined, () => {
    executions += 1;
    return 'restarted';
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 428);
  assert.equal(executions, 0);
});

test('an explicitly confirmed action invokes its handler once', async () => {
  let executions = 0;
  const result = await runAuthorizedAction('system.boost', 'system.boost', () => {
    executions += 1;
    return 'completed';
  });
  assert.equal(result.allowed, true);
  assert.equal(result.result, 'completed');
  assert.equal(executions, 1);
});

test('new mutating actions require exact-action confirmation', () => {
  for (const action of ['system.auto-setup', 'windows.restart-daemons', 'config.raw-write', 'config.soul-write']) {
    assert.equal(authorizeAction(action).allowed, false, action);
    assert.equal(authorizeAction(action, action).allowed, true, action);
    assert.equal(authorizeAction(action, 'some-other-action').allowed, false, action);
  }
});
