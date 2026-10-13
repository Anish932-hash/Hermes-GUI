import { NextRequest, NextResponse } from 'next/server';
import { executeHermesChat } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, model, provider, enableTools } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await executeHermesChat(message, {
      sessionId,
      model,
      provider,
      enableTools,
    });

    return NextResponse.json({
      role: 'model',
      content: result.text,
      sessionId: result.sessionId,
      error: result.error,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Hermes invocation failed',
        content: `Error interacting with Hermes in WSL: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
