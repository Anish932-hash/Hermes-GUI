import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appCatalogHealthState,
  gatewayHealthState,
  processHealthState,
  summarizeHealth,
} from '../src/lib/system-health.ts';

test('gateway state reflects observed service state without optimistic defaults', () => {
  assert.equal(gatewayHealthState('running'), 'online');
  assert.equal(gatewayHealthState('stopped'), 'offline');
  assert.equal(gatewayHealthState('unknown'), 'unknown');
  assert.equal(gatewayHealthState(undefined), 'unknown');
});

test('empty app catalog is degraded while a failed catalog check is unknown', () => {
  assert.equal(appCatalogHealthState(12), 'online');
  assert.equal(appCatalogHealthState(0), 'degraded');
  assert.equal(appCatalogHealthState(null), 'unknown');
  assert.equal(appCatalogHealthState(-1), 'unknown');
});

test('a missing process is not misreported as offline or uninstalled', () => {
  assert.equal(processHealthState(true), 'online');
  assert.equal(processHealthState(false), 'unknown');
  assert.equal(processHealthState(undefined), 'unknown');
});

test('health summary counts all states', () => {
  assert.deepEqual(summarizeHealth(['online', 'online', 'offline', 'degraded', 'unknown']), {
    online: 2, offline: 1, degraded: 1, unknown: 1,
  });
});
