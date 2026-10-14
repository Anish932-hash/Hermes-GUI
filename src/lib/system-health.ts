export type HealthState = 'online' | 'offline' | 'degraded' | 'unknown';

export function gatewayHealthState(state: 'running' | 'stopped' | 'unknown' | null | undefined): HealthState {
  if (state === 'running') return 'online';
  if (state === 'stopped') return 'offline';
  return 'unknown';
}

export function appCatalogHealthState(count: number | null | undefined): HealthState {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return 'unknown';
  return count > 0 ? 'online' : 'degraded';
}

export function processHealthState(running: boolean | null | undefined): HealthState {
  if (running === true) return 'online';
  return 'unknown';
}

export function summarizeHealth(states: HealthState[]): Record<HealthState, number> {
  return states.reduce<Record<HealthState, number>>((counts, state) => {
    counts[state] += 1;
    return counts;
  }, { online: 0, offline: 0, degraded: 0, unknown: 0 });
}
