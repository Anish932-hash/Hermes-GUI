export type ActionRisk = 'read-only' | 'routine' | 'sensitive' | 'destructive';

export type ActionDecision =
  | { allowed: true; risk: ActionRisk }
  | { allowed: false; risk: ActionRisk; status: 400 | 403 | 428; reason: string };

const RISK_BY_ACTION: Record<string, ActionRisk> = {
  'apps.list': 'read-only',
  'apps.launch': 'routine',
  'audio.test-tone': 'routine',
  'audio.diagnostics': 'read-only',
  'health.read': 'read-only',
  'gateway.start': 'routine',
  'gateway.stop': 'sensitive',
  'gateway.restart': 'sensitive',
  'system.boost': 'sensitive',
  'system.auto-setup': 'sensitive',
  'windows.restart-daemons': 'sensitive',
  'config.raw-write': 'sensitive',
  'config.soul-write': 'sensitive',
  'system.exec.diagnostic': 'routine',
  'system.exec.mutation': 'destructive',
};

export function classifyAction(action: string): ActionRisk | null {
  return RISK_BY_ACTION[action] ?? null;
}

/** Enforced by API handlers, never only by UI confirmation controls. */
export function authorizeAction(action: string, confirmation?: unknown): ActionDecision {
  const risk = classifyAction(action);
  if (!risk) {
    return { allowed: false, risk: 'destructive', status: 403, reason: 'Action is not registered in the permission policy.' };
  }

  if (risk === 'destructive') {
    return { allowed: false, risk, status: 403, reason: 'Destructive actions are disabled until a dedicated safe workflow is implemented.' };
  }

  if (risk === 'sensitive' && confirmation !== action) {
    return {
      allowed: false,
      risk,
      status: confirmation ? 403 : 428,
      reason: 'Explicit confirmation for this exact action is required.',
    };
  }

  return { allowed: true, risk };
}

/** A denied action cannot fall through to its side-effecting handler. */
export async function runAuthorizedAction<T>(
  action: string,
  confirmation: unknown,
  execute: () => Promise<T> | T,
): Promise<
  | { allowed: true; risk: ActionRisk; result: T }
  | { allowed: false; risk: ActionRisk; status: 400 | 403 | 428; reason: string }
> {
  const decision = authorizeAction(action, confirmation);
  if (!decision.allowed) return decision;
  return { ...decision, result: await execute() };
}
