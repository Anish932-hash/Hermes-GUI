import { NextResponse } from 'next/server';
import { getSystemTelemetry } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const telemetry = getSystemTelemetry();
    return NextResponse.json(telemetry);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to gather system telemetry' },
      { status: 500 }
    );
  }
}
