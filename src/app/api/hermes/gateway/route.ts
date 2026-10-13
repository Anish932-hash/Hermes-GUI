import { NextRequest, NextResponse } from 'next/server';
import { manageGateway, getGatewayLogs } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
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
  try {
    const { action } = await req.json();
    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be start, stop, or restart' }, { status: 400 });
    }

    const result = await manageGateway(action as any);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
