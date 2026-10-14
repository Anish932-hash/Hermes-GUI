import { NextResponse } from 'next/server';
import { performSystemBoost } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const decision = authorizeAction('system.boost', body.confirmation);
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason, risk: decision.risk, action: 'system.boost' }, { status: decision.status });
    }

    const result = await performSystemBoost();
    return NextResponse.json({
      success: true,
      ...result,
      message: `Optimization completed. Observed memory decrease: ${result.freedMB} MB.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
