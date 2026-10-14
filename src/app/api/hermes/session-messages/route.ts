import { NextRequest, NextResponse } from 'next/server';
import { getSessionMessages } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (sessionId.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const messages = await getSessionMessages(sessionId);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve session messages', messages: [] }, { status: 500 });
  }
}
