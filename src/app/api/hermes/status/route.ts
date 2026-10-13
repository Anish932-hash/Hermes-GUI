import { NextResponse } from 'next/server';
import { getHermesStatus } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const status = await getHermesStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get Hermes status' },
      { status: 500 }
    );
  }
}
