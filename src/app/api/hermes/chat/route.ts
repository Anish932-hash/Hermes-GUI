import { NextRequest, NextResponse } from 'next/server';
import { executeHermesChat } from '@/lib/hermes';
import { launchAppFromText, parseAppLaunchIntent } from '@/lib/app-launcher';
import { authorizeAction } from '@/lib/action-policy';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const { message, sessionId, model, provider, enableTools } = body;

    if (typeof message !== 'string' || !message.trim() || message.length > 20000) {
      return NextResponse.json({ error: 'Message must contain 1–20000 characters' }, { status: 400 });
    }
    if (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId.length > 256 || !/^[A-Za-z0-9_-]+$/.test(sessionId))) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }
    if (model !== undefined && (typeof model !== 'string' || model.length > 160 || [...model].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) {
      return NextResponse.json({ error: 'Invalid model identifier' }, { status: 400 });
    }
    if (provider !== undefined && (typeof provider !== 'string' || provider.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(provider))) {
      return NextResponse.json({ error: 'Invalid provider identifier' }, { status: 400 });
    }
    if (enableTools !== undefined && typeof enableTools !== 'boolean') {
      return NextResponse.json({ error: 'enableTools must be a boolean' }, { status: 400 });
    }

    // Resolve direct app-launch requests before handing ordinary conversation to Hermes.
    // Both text chat and Voice HUD use this endpoint, so they share the same safe launcher.
    const launchIntent = parseAppLaunchIntent(message);
    if (launchIntent) {
      // Keep natural-language app launches behind the same server-side policy as the launcher API.
      const decision = authorizeAction('apps.launch');
      if (!decision.allowed) {
        return NextResponse.json({ error: decision.reason, risk: decision.risk, action: 'apps.launch' }, { status: decision.status });
      }
    }
    const appLaunch = launchIntent ? await launchAppFromText(message) : null;
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
  } catch {
    // Avoid exposing internal paths, process output, or provider details to the browser.
    return NextResponse.json(
      {
        error: 'Hermes invocation failed',
        content: 'Unable to complete the Hermes request. Check local service diagnostics for details.',
      },
      { status: 500 }
    );
  }
}
