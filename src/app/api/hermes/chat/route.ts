import { NextRequest, NextResponse } from 'next/server';
import { executeHermesChat } from '@/lib/hermes';
import { launchAppFromText } from '@/lib/app-launcher';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { message, sessionId, model, provider, enableTools } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Resolve direct app-launch requests before handing ordinary conversation to Hermes.
    // Both text chat and Voice HUD use this endpoint, so they share the same safe launcher.
    const appLaunch = await launchAppFromText(message);
    if (appLaunch) {
      return NextResponse.json({
        role: 'model',
        content: appLaunch.message,
        sessionId,
        appAction: {
          success: appLaunch.success,
          app: appLaunch.app,
          candidates: appLaunch.candidates,
        },
      }, { status: 200 });
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
