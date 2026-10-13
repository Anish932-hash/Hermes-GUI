import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

import { isLocalRequest } from '@/lib/local-request';

const execAsync = promisify(exec);

const LOCAL_BIND_HOST = process.env.HERMES_BIND_HOST || '127.0.0.1';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`http://${LOCAL_BIND_HOST}:4173/`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      return NextResponse.json({
        running: true,
        port: 4173,
        url: 'http://localhost:4173',
        status: 'online',
      });
    }
  } catch {
    // Process might be stopped, attempt auto-launch
    try {
      exec('cd /home/thecyberexpert/gods-eye-view && npm run dev &');
    } catch {}
  }

  return NextResponse.json({
    running: false,
    port: 4173,
    url: 'http://localhost:4173',
    status: 'starting',
  });
}
