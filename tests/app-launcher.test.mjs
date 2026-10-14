import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAppLaunchIntent } from '../src/lib/app-launcher.ts';

test('parses a simple launch request', () => {
  assert.deepEqual(parseAppLaunchIntent('Open Notepad'), { name: 'Notepad', target: 'auto' });
});

test('parses explicit Windows and Kali targets', () => {
  assert.deepEqual(parseAppLaunchIntent('Hey Jarvis, open VS Code in Windows'), { name: 'VS Code', target: 'windows' });
  assert.deepEqual(parseAppLaunchIntent('open Wireshark in Kali Linux'), { name: 'Wireshark', target: 'kali' });
});

test('handles polite requests', () => {
  assert.deepEqual(parseAppLaunchIntent('please launch the calculator for me'), { name: 'calculator', target: 'auto' });
});

test('does not intercept ordinary conversation or incomplete commands', () => {
  assert.equal(parseAppLaunchIntent('How does gravity work?'), null);
  assert.equal(parseAppLaunchIntent(''), null);
  assert.equal(parseAppLaunchIntent('open'), null);
});

test('rejects overlong input and control characters', () => {
  assert.equal(parseAppLaunchIntent('open ' + 'x'.repeat(600)), null);
  assert.equal(parseAppLaunchIntent('open Notepad\u0000'), null);
});

test('does not accept a shell-looking string as a special command', () => {
  assert.deepEqual(parseAppLaunchIntent('open notepad; calc.exe'), { name: 'notepad; calc.exe', target: 'auto' });
});
