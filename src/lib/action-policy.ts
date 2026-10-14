export type ActionRisk = 'read-only' | 'routine' | 'sensitive' | 'destructive';

export type ActionDecision =
  | { allowed: true; risk: ActionRisk }
  | { allowed: false; risk: ActionRisk; status: 400 | 403 | 428; reason: string };

const RISK_BY_ACTION: Record<string, ActionRisk> = {
  'apps.list': 'read-only',
  'health.read': 'read-only',
  'gateway.start': 'routine',
  'gateway.stop': 'sensitive',
  'gateway.restart': 'sensitive',
  'system.boost': 'sensitive',
  'system.exec.diagnostic': 'routine',
  'system.exec.mutation': 'destructive',
};

export function classifyAction(action: string): ActionRisk | null {
  return RISK_BY_ACTION[action] ?? null;
}

/**
 * This is enforced by API handlers, not just by UI confirmation controls.
 * The client must explicitly acknowledge the exact action target before a
 * sensitive or destructive operation can reach its execution handler.
 */
export function authorizeAction(
  action: string,
  confirmation?: unknown,
): ActionDecision {
  const risk = classifyAction(action);
  if (!risk) {
    return { allowed: false, risk: 'destructive', status: 403, reason: 'Action is not registered in the permission policy.' };
  }

  if (risk === 'destructive') {
    return { allowed: false, risk, status: 403, reason: 'Destructive actions are disabled until a dedicated safe workflow is implemented.' };
  }

  if ((risk === 'sensitive') && confirmation !== action) {
    return {
      allowed: false,
      risk,
      status: confirmation ? 403 : 428,
      reason: 'Explicit confirmation for this exact action is required.',
    };
  }

  return { allowed: true, risk };
}

/**
 * Keep the policy check and execution boundary together so a denied action
 * cannot accidentally fall through to its side-effecting handler.
 */
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
