import { NextRequest, NextResponse } from 'next/server';
import {
  getWisprStatus,
  getWisprDictations,
  launchWisprFlowApp,
  triggerWisprPtt,
} from '@/lib/wispr-flow';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const status = await getWisprStatus();

    if (limit && limit !== 15) {
      const custom = getWisprDictations(limit);
      status.recentDictations = custom.dictations;
      status.totalDictationsCount = custom.totalCount;
    }

    return NextResponse.json(status);
  } catch (err: any) {
    console.error('Error fetching Wispr Flow status:', err);
    return NextResponse.json(
      {
        installed: false,
        running: false,
        error: err.message || 'Internal error querying Wispr Flow',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    if (action === 'launch') {
      const res = await launchWisprFlowApp();
      return NextResponse.json(res);
    }

    if (action === 'ptt' || action === 'trigger') {
      const res = await triggerWisprPtt();
      return NextResponse.json(res);
    }

    if (action === 'sync') {
      const lastKnownId = body.lastKnownId as string | undefined;
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

    // Default: Return current status
    const status = await getWisprStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error('Wispr Flow action error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
