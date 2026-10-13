import { NextResponse } from 'next/server';
import { getHermesSkills } from '@/lib/hermes';

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
    const skills = await getHermesSkills();
    return NextResponse.json({ skills });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get Hermes skills', skills: [] },
      { status: 500 }
    );
  }
}
