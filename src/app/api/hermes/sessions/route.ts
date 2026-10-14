import { NextResponse } from 'next/server';
import { getHermesSessions } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const sessions = await getHermesSessions();
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve Hermes sessions', sessions: [] },
      { status: 500 }
    );
  }
}
