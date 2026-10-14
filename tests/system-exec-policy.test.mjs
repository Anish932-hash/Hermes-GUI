import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedDiagnosticCommand } from '../src/lib/system-exec-policy.ts';

test('allows approved read-only diagnostic command shapes', () => {
  const allowed = [
    ['uname'], ['uname', '-a'], ['uptime'], ['whoami'], ['id'], ['pwd'], ['date'], ['w'],
    ['free', '-h'], ['df', '-h'], ['top', '-b', '-n', '1'], ['ps', '-eo', 'pid,%cpu,%mem,comm'],
    ['ls'], ['ls', '-la'], ['netstat', '-an'], ['ss', '-tuln'],
    ['ip', 'addr', 'show'], ['ip', 'route', 'show'], ['systemctl', 'status', '--no-pager'],
    ['which', 'node'], ['which', 'hermes'], ['git', 'status'], ['git', 'branch', '--show-current'],
  ];
  for (const args of allowed) assert.equal(isAllowedDiagnosticCommand(args), true, args.join(' '));
});

test('rejects unknown commands and empty arguments', () => {
  assert.equal(isAllowedDiagnosticCommand([]), false);
  assert.equal(isAllowedDiagnosticCommand(['bash', '-c', 'whoami']), false);
  assert.equal(isAllowedDiagnosticCommand(['readfile', 'some-path']), false);
  assert.equal(isAllowedDiagnosticCommand(['hermes', 'chat']), false);
});

test('rejects arbitrary paths and extra arguments', () => {
  const rejected = [
    ['ls', 'some-path'], ['ls', '-la', 'some-path'], ['df', '-h', 'some-path'],
    ['ps', 'aux'], ['ps', '-ef'], ['ps', '-eo', 'pid,%cpu,%mem,comm', '--sort=cmd'], ['systemctl', 'status', 'service-name', '--no-pager'],
    ['git', 'status', '--porcelain'], ['which', 'node', 'npm'], ['ip', 'addr', 'flush'],
    ['date', '--set=tomorrow'], ['top', '-b', '-n', '1', '-p', '1'],
  ];
  for (const args of rejected) assert.equal(isAllowedDiagnosticCommand(args), false, args.join(' '));
});
