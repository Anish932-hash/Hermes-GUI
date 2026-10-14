import { NextResponse } from 'next/server';
import { performSystemBoost } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';
import { runAuthorizedAction } from '@/lib/action-policy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const execution = await runAuthorizedAction('system.boost', body.confirmation, () => performSystemBoost());
    if (!execution.allowed) {
      return NextResponse.json({ error: execution.reason, risk: execution.risk, action: 'system.boost' }, { status: execution.status });
    }
    const result = execution.result;
    return NextResponse.json({
      success: true,
      ...result,
      message: `Optimization completed. Observed memory decrease: ${result.freedMB} MB.`,
    });
  } catch {
    return NextResponse.json({ error: 'System optimization failed' }, { status: 500 });
  }
}
