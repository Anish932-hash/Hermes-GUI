import { NextRequest, NextResponse } from 'next/server';
import { manageGateway } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';
import { runAuthorizedAction } from '@/lib/action-policy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const status = await manageGateway('status');
    const active = status.output?.includes('active (running)') || false;
    return NextResponse.json({
      active,
      output: status.output
        ? 'Gateway status was checked. Detailed service output is hidden to avoid exposing local paths or secrets.'
        : 'No detailed gateway status is available.',
      logs: 'Raw gateway logs are not exposed through this endpoint because they may contain prompts, provider output, or secrets.',
    });
  } catch {
    return NextResponse.json({ error: 'The requested Hermes operation failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const { action, confirmation } = body;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be start, stop, or restart' }, { status: 400 });
    }

    const execution = await runAuthorizedAction(`gateway.${action}`, confirmation, () => manageGateway(action as any));
    if (!execution.allowed) {
      return NextResponse.json({ error: execution.reason, risk: execution.risk, action }, { status: execution.status });
    }

    return NextResponse.json(execution.result);
  } catch {
    return NextResponse.json({ error: 'The requested Hermes operation failed' }, { status: 500 });
  }
}
