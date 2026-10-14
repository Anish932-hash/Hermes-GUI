import { NextResponse } from 'next/server';
import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';
import { launchAppFromText, listKaliApplications, listWindowsApplications } from '@/lib/app-launcher';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  const [windows, kali] = await Promise.all([
    listWindowsApplications().catch(() => []),
    Promise.resolve(listKaliApplications()),
  ]);
  return NextResponse.json({
    success: true,
    applications: [...windows, ...kali],
    counts: { windows: windows.length, kali: kali.length },
  });
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
  }
  const command = typeof body.command === 'string' ? body.command : '';
  if (!command || command.length > 500) {
    return NextResponse.json({ error: 'Provide a launch command up to 500 characters.' }, { status: 400 });
  }
  const decision = authorizeAction('apps.launch');
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason, risk: decision.risk }, { status: decision.status });
  }
  const result = await launchAppFromText(command);
  if (!result) return NextResponse.json({ error: 'Command must start with open, launch, start, or run.' }, { status: 400 });
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
