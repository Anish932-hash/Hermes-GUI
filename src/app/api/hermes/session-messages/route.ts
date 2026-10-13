import { NextRequest, NextResponse } from 'next/server';
import { getSessionMessages } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const messages = await getSessionMessages(sessionId);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, messages: [] }, { status: 500 });
  }
}
