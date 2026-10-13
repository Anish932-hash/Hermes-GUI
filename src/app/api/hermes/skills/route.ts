import { NextResponse } from 'next/server';
import { getHermesSkills } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
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
