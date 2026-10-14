import { NextResponse } from 'next/server';
import { getSystemTelemetry } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const telemetry = getSystemTelemetry();
    return NextResponse.json(telemetry);
  } catch {
    return NextResponse.json(
      { error: 'Failed to gather system telemetry' },
      { status: 500 }
    );
  }
}
