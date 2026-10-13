import { NextResponse } from 'next/server';
import { getHermesSessions } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessions = await getHermesSessions();
    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get Hermes sessions', sessions: [] },
      { status: 500 }
    );
  }
}
