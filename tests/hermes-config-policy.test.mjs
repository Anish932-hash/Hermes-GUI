import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStructuredConfigUpdates } from '../src/lib/hermes-config-policy.ts';

const validYaml = `model:
  default: 'provider/model'
  provider: 'openrouter'
  temperature: 0.7
  max_tokens: 2048
  streaming: true
  reasoning: 'on'
  max_concurrent_sessions: 5
`;

test('accepts structured updates when all requested settings exist', () => {
  assert.equal(validateStructuredConfigUpdates(validYaml, {
    model: 'provider/new-model',
    provider: 'openrouter',
    temperature: 1.1,
    maxTokens: 4096,
    streaming: false,
    reasoning: 'off',
    maxSessions: 10,
  }), null);
});

test('rejects updates when the requested setting is absent', () => {
  assert.match(
    validateStructuredConfigUpdates('model:\n  default: old\n', { maxTokens: 1024 }) || '',
    /maxTokens.*missing/,
  );
  assert.match(
    validateStructuredConfigUpdates('provider: openrouter\n', { model: 'new-model' }) || '',
    /model.*missing/,
  );
});

test('allows inserting temperature only when a model section exists', () => {
  assert.equal(validateStructuredConfigUpdates('model:\n  default: old\n', { temperature: 0.9 }), null);
  assert.match(
    validateStructuredConfigUpdates('provider: openrouter\n', { temperature: 0.9 }) || '',
    /temperature.*no model section/,
  );
});

test('does not reject an empty update object', () => {
  assert.equal(validateStructuredConfigUpdates(validYaml, {}), null);
});
