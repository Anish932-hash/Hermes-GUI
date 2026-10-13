import { NextResponse } from 'next/server';
import { getHermesStatus } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
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
