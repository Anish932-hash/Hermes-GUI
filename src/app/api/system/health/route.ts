import { NextResponse } from 'next/server';
import { getHermesStatus } from '@/lib/hermes';
import { listKaliApplications } from '@/lib/app-launcher';
import { isWisprProcessRunning } from '@/lib/wispr-flow';
import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

type HealthState = 'online' | 'offline' | 'degraded' | 'unknown';
type HealthItem = {
  id: string;
  label: string;
  state: HealthState;
  message: string;
  checkedAt: string;
};

function item(id: string, label: string, state: HealthState, message: string): HealthItem {
  return { id, label, state, message, checkedAt: new Date().toISOString() };
}

function isWslRuntime(): boolean {
  return process.platform === 'linux' && (
    process.env.WSL_DISTRO_NAME !== undefined ||
    process.env.HERMES_WSL_DISTRO !== undefined
  );
}

async function checkGodsEye(): Promise<HealthItem> {
  const checkedAt = new Date().toISOString();
  const host = process.env.HERMES_BIND_HOST || '127.0.0.1';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(`http://${host}:4173/`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
      cache: 'no-store',
    });
    return {
      id: 'godseye',
      label: "God's Eye",
      state: response.ok ? 'online' : 'degraded',
      message: response.ok ? 'Viewer responded successfully.' : `Viewer returned HTTP ${response.status}.`,
      checkedAt,
    };
  } catch {
    return {
      id: 'godseye',
      label: "God's Eye",
      state: 'offline',
      message: 'Viewer did not respond. It was not started or modified by this check.',
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

  const checkedAt = new Date().toISOString();
  const checks = await Promise.allSettled([
    getHermesStatus(),
    checkGodsEye(),
    Promise.resolve().then(() => listKaliApplications().length),
    isWisprProcessRunning(),
  ]);

  const hermesResult = checks[0];
  const hermes = hermesResult.status === 'fulfilled' ? hermesResult.value : null;
  const gatewayState: HealthState = !hermes
    ? 'unknown'
    : hermes.gatewayState === 'running'
      ? 'online'
      : hermes.gatewayState === 'stopped'
        ? 'offline'
        : 'unknown';

  const godseyeResult = checks[1];
  const appsResult = checks[2];
  const wisprResult = checks[3];

  const services: HealthItem[] = [
    item('studio', 'Hermes Studio API', 'online', 'This health endpoint is responding.'),
    item(
      'wsl',
      'Kali / WSL runtime',
      isWslRuntime() ? 'online' : 'unknown',
      isWslRuntime()
        ? `Running in Linux runtime${process.env.WSL_DISTRO_NAME ? ` (${process.env.WSL_DISTRO_NAME})` : ''}.`
        : 'WSL could not be confirmed from runtime environment variables.'
    ),
    item(
      'gateway',
      'Hermes Gateway',
      gatewayState,
      hermes
        ? hermes.gatewayState === 'running'
          ? `Gateway process detected; Hermes version: ${hermes.version || 'unknown'}.`
          : hermes.gatewayState === 'stopped'
            ? 'Gateway service is stopped.'
            : 'Gateway state could not be determined.'
        : 'Hermes status check failed.'
    ),
    godseyeResult.status === 'fulfilled'
      ? godseyeResult.value
      : item('godseye', "God's Eye", 'unknown', 'Health check failed unexpectedly.'),
    item(
      'kali-apps',
      'Kali app discovery',
      appsResult.status === 'fulfilled'
        ? appsResult.value > 0 ? 'online' : 'degraded'
        : 'unknown',
      appsResult.status === 'fulfilled'
        ? `${appsResult.value} Linux desktop applications discovered.`
        : 'Linux desktop application catalog could not be read.'
    ),
    item(
      'wispr',
      'Wispr Flow',
      wisprResult.status === 'fulfilled' && wisprResult.value ? 'online' : 'unknown',
      wisprResult.status === 'fulfilled' && wisprResult.value
        ? 'Wispr Flow process detected on the Windows host.'
        : 'Wispr Flow process was not detected; installation state is not checked here.'
    ),
    item(
      'sarvam',
      'Sarvam cloud voice',
      process.env.SARVAM_API_KEY ? 'online' : 'unknown',
      process.env.SARVAM_API_KEY
        ? 'A server-side API key is configured. Provider reachability has not been tested.'
        : 'No server-side key detected. A key saved in browser settings is not visible to this check.'
    ),
  ];

  const counts = services.reduce<Record<HealthState, number>>((total, service) => {
    total[service.state] += 1;
    return total;
  }, { online: 0, offline: 0, degraded: 0, unknown: 0 });

  return NextResponse.json({ checkedAt, services, counts });
}
