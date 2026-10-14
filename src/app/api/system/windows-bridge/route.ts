import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

interface WindowsTelemetry {
  isWsl: boolean;
  windowsUser: string;
  hasWindowsTerminal: boolean;
  windowsTerminalPath?: string;
  installedBrowsers: Array<{ name: string; path: string; available: boolean }>;
  distroName: string;
  isStandaloneAppInstalled: boolean;
  isStandaloneAppRunning: boolean;
}

let cachedTelemetry: WindowsTelemetry | null = null;
let lastTelemetryTime = 0;

/**
 * Execute command against Windows host via powershell.exe cleanly from /mnt/c
 * Uses -WindowStyle Hidden and -NonInteractive to guarantee NO console popups on Windows desktop
 */
async function execOnWindows(psCommand: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
    { cwd: '/mnt/c', timeout: 8000, windowsHide: true, maxBuffer: 1024 * 512 }
  );
  return stdout.trim();
}

/**
 * Launch a fixed PowerShell command without passing it through a shell parser.
 * Any user-supplied values must still be validated and quoted for PowerShell.
 */
async function launchOnWindows(psCommand: string): Promise<void> {
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
    { cwd: '/mnt/c', timeout: 8000, windowsHide: true, maxBuffer: 1024 * 512 }
  );
}

/**
 * GET: Query Windows Host Telemetry & Subsystems (Cached & 100% Hidden)
 */
export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  const now = Date.now();
  if (cachedTelemetry && now - lastTelemetryTime < 15000) {
    return NextResponse.json({
      status: 'ONLINE',
      telemetry: cachedTelemetry,
      timestamp: new Date().toISOString(),
      cached: true,
    });
  }

  const telemetry: WindowsTelemetry = {
    isWsl: fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop') || fs.existsSync('/mnt/c'),
    windowsUser: process.env.USERNAME || 'unknown',
    hasWindowsTerminal: false,
    installedBrowsers: [],
    distroName: process.env.HERMES_WSL_DISTRO || 'kali-linux',
    isStandaloneAppInstalled: false,
    isStandaloneAppRunning: false,
  };

  try {
    // Single consolidated hidden batch query for zero window flashing and fast response
    const batchCmd = `$u = $env:USERNAME; $w = if (Get-Command wt.exe -ErrorAction SilentlyContinue) { (Get-Command wt.exe).Source } else { '' }; $e = if (Get-Process electron -ErrorAction SilentlyContinue) { 'RUNNING' } else { 'STOPPED' }; $root = Join-Path $env:USERPROFILE 'Hermes-Agent-OS'; $a = (Test-Path (Join-Path $root 'Hermes-Agent-OS.exe')) -or (Test-Path (Join-Path $root 'node_modules\\electron\\dist\\electron.exe')); @{ user = $u; wt = $w; electron = $e; appInstalled = $a } | ConvertTo-Json -Compress`;
    const rawJson = await execOnWindows(batchCmd);
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed.user) telemetry.windowsUser = String(parsed.user).trim();
        if (parsed.wt) {
          telemetry.hasWindowsTerminal = true;
          telemetry.windowsTerminalPath = String(parsed.wt).split('\n')[0].trim();
        }
        telemetry.isStandaloneAppRunning = parsed.electron === 'RUNNING';
        telemetry.isStandaloneAppInstalled = parsed.appInstalled === true;
      } catch {}
    }
  } catch {
    telemetry.windowsUser = process.env.USERNAME || 'unknown';
  }

  // Probe installed browsers
  const browserCandidates = [
    { name: 'Edge', path: '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
    { name: 'Chrome', path: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe' },
    { name: 'Brave', path: '/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' },
  ];

  telemetry.installedBrowsers = browserCandidates.map((b) => ({
    name: b.name,
    path: b.path,
    available: fs.existsSync(b.path),
  }));

  cachedTelemetry = telemetry;
  lastTelemetryTime = now;

  return NextResponse.json({
    status: 'ONLINE',
    telemetry,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST: Execute Windows Host Action (100% Hidden)
 */
export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || '';

    switch (action) {
      case 'open-mic-settings': {
        // Direct jump to Windows Microphone Privacy Settings
        const psCmd = "Start-Process 'ms-settings:privacy-microphone' -WindowStyle Hidden";
        await launchOnWindows(psCmd);
        return NextResponse.json({
          success: true,
          action,
          message: 'Opened Windows Microphone Privacy Settings.',
        });
      }

      case 'open-sound-settings': {
        // Opens Classic Windows Sound Recording Control Panel
        const psCmd = "Start-Process 'control.exe' -ArgumentList 'mmsys.cpl,,1' -WindowStyle Hidden";
        await launchOnWindows(psCmd);
        return NextResponse.json({
          success: true,
          action,
          message: 'Opened Windows Sound Control Panel (Recording Devices).',
        });
      }

      case 'launch-kali': {
        // Spawns native Windows Terminal or WSL Kali console directly on Windows desktop
        const psCmd = "if (Get-Command wt.exe -ErrorAction SilentlyContinue) { Start-Process wt.exe -ArgumentList 'wsl.exe -d kali-linux ~' } else { Start-Process cmd.exe -ArgumentList '/c start `\"Kali Linux - Hermes Agent OS`\" wsl.exe -d kali-linux ~' }";
        await launchOnWindows(psCmd);
        return NextResponse.json({
          success: true,
          action,
          message: 'Spawned interactive Kali Linux terminal session on Windows desktop.',
        });
      }

      case 'open-explorer': {
        const requestedPath = typeof body.path === 'string' ? body.path.trim() : '';
        if (requestedPath.length > 1024 || /[\\u0000-\\u001f]/.test(requestedPath)) {
          return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }
        const targetPath = requestedPath || '';
        const psLiteral = targetPath.replace(/'/g, "''");
        const psCmd = targetPath
          ? `Start-Process explorer.exe -ArgumentList ([char]34 + '${psLiteral}' + [char]34)`
          : "Start-Process explorer.exe -ArgumentList ([char]34 + $env:USERPROFILE + [char]34)";
        await launchOnWindows(psCmd);
        return NextResponse.json({
          success: true,
          action,
          message: targetPath ? `Opened Windows File Explorer at ${targetPath}.` : 'Opened Windows File Explorer.',
        });
      }

      case 'launch-godseye': {
        // Launch God's Eye 3D Earth in dedicated app window
        const psCmd = "if (Test-Path 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe') { Start-Process 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' -ArgumentList '--app=http://localhost:4173 --window-size=1440,900' } else { Start-Process 'http://localhost:4173' }";
        await launchOnWindows(psCmd);
        return NextResponse.json({
          success: true,
          action,
          message: "Launched God's Eye 3D Earth Viewer on Windows desktop.",
        });
      }

      case 'launch-studio-app': {
        // Launch independent standalone desktop application (NO web browser)
        const psCmd = "$root = Join-Path $env:USERPROFILE 'Hermes-Agent-OS'; $app = Join-Path $root 'Hermes-Agent-OS.exe'; $electron = Join-Path $root 'node_modules\\electron\\dist\\electron.exe'; if (Test-Path $app) { Start-Process $app -WorkingDirectory $root -WindowStyle Hidden } elseif (Test-Path $electron) { Start-Process $electron -ArgumentList '.' -WorkingDirectory $root -WindowStyle Hidden } else { Start-Process 'http://127.0.0.1:3001' -WindowStyle Hidden }";
        await launchOnWindows(psCmd);
        return NextResponse.json({
          success: true,
          action,
          message: 'Launched Hermes Agent OS standalone independent desktop application.',
        });
      }

      case 'restart-daemons': {
        const decision = authorizeAction('windows.restart-daemons', body.confirmation);
        if (!decision.allowed) {
          return NextResponse.json({ error: decision.reason, risk: decision.risk, action }, { status: decision.status });
        }
        const scriptPath = process.env.HERMES_MANAGE_SCRIPT ||
          path.join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'studio', 'scripts', 'manage-services.sh');
        await execFileAsync('bash', [scriptPath, 'restart'], { timeout: 25000, windowsHide: true });
        return NextResponse.json({
          success: true,
          action,
          message: 'Restarted all Hermes Agent OS daemons (Studio, God\'s Eye, Gateway).',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Windows bridge operation failed' },
      { status: 500 }
    );
  }
}
