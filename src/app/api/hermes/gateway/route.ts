import { NextRequest, NextResponse } from 'next/server';
import { manageGateway, getGatewayLogs } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';
import { runAuthorizedAction } from '@/lib/action-policy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const logs = await getGatewayLogs(40);
    const status = await manageGateway('status');
    return NextResponse.json({
      active: status.output?.includes('active (running)') || false,
      output: status.output,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
