import { NextResponse } from 'next/server';
import { performSystemBoost } from '@/lib/hermes';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const result = await performSystemBoost();
    return NextResponse.json({
      success: true,
      ...result,
      message: `Optimization completed. Observed memory decrease: ${result.freedMB} MB.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
