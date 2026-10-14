import { NextRequest, NextResponse } from 'next/server';
import {
  getWisprStatus,
  getWisprDictations,
  launchWisprFlowApp,
  triggerWisprPtt,
} from '@/lib/wispr-flow';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

const MAX_DICTATION_LIMIT = 50;

function parseDictationLimit(value: string | null): number | null {
  if (value === null || value.trim() === '') return 15;
  if (!/^\\d+$/.test(value)) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_DICTATION_LIMIT
    ? limit
    : null;
}

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseDictationLimit(searchParams.get('limit'));
    if (limit === null) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_DICTATION_LIMIT}` },
        { status: 400 },
      );
    }

    const status = await getWisprStatus();
    if (limit !== 15) {
      const custom = getWisprDictations(limit);
      status.recentDictations = custom.dictations;
      status.totalDictationsCount = custom.totalCount;
    }

    return NextResponse.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error querying Wispr Flow';
    console.error('Error fetching Wispr Flow status:', message);
    return NextResponse.json(
      { installed: false, running: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body: unknown = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action === undefined ? 'status' : payload.action;
    if (
      typeof action !== 'string' ||
      !['launch', 'ptt', 'trigger', 'sync', 'status'].includes(action)
    ) {
      return NextResponse.json({ error: 'Unknown Wispr Flow action' }, { status: 400 });
    }

    if (action === 'launch') {
      return NextResponse.json(await launchWisprFlowApp());
    }

    if (action === 'ptt' || action === 'trigger') {
      return NextResponse.json(await triggerWisprPtt());
    }

    if (action === 'sync') {
      const lastKnownId = payload.lastKnownId;
      if (
        lastKnownId !== undefined &&
        (typeof lastKnownId !== 'string' ||
          lastKnownId.length > 256 ||
          /[\\u0000-\\u001f\\u007f]/.test(lastKnownId))
      ) {
        return NextResponse.json({ error: 'Invalid lastKnownId' }, { status: 400 });
      }

      const { dictations, totalCount } = getWisprDictations(10);
      const latest = dictations[0] || null;
      const isNew = latest && (!lastKnownId || latest.id !== lastKnownId);

      return NextResponse.json({
        latest,
        isNew,
        recentDictations: dictations,
        totalCount,
      });
    }

    return NextResponse.json(await getWisprStatus());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Wispr Flow action failed';
    console.error('Wispr Flow action error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
