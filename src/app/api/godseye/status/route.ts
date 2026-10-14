import { NextRequest, NextResponse } from 'next/server';

import { isLocalRequest } from '@/lib/local-request';

const LOCAL_BIND_HOST = process.env.HERMES_BIND_HOST || '127.0.0.1';

export const dynamic = 'force-dynamic';

/**
 * Read-only status probe. Service startup belongs to an explicit, confirmed
 * action—not a GET request that may be triggered by polling or page loading.
 */
export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`http://${LOCAL_BIND_HOST}:4173/`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });

    if (res.ok) {
      return NextResponse.json({
        running: true,
        port: 4173,
        url: 'http://localhost:4173',
        status: 'online',
      });
    }

    return NextResponse.json({
      running: false,
      port: 4173,
      url: 'http://localhost:4173',
      status: 'offline',
      httpStatus: res.status,
    });
  } catch {
    return NextResponse.json({
      running: false,
      port: 4173,
      url: 'http://localhost:4173',
      status: 'offline',
    });
  } finally {
    clearTimeout(timeout);
  }
}
