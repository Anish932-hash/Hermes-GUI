import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

async function runWindowsPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ],
    {
      cwd: '/mnt/c',
      timeout: 12000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  );
  return stdout.trim();
}

/**
 * Lists applications discoverable from the current user's and machine-wide
 * Start Menus, plus registered packaged Windows apps. This never scans for or
 * executes arbitrary executable paths.
 */
export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

  try {
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$items = @{}
Get-StartApps | ForEach-Object {
  if ($_.Name -and $_.AppID) {
    $key = [string]$_.Name
    if (-not $items.ContainsKey($key)) {
      $items[$key] = @{ name = $key; source = 'registered-app'; appId = [string]$_.AppID }
    }
  }
}
$roots = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
)
foreach ($root in $roots) {
  if (Test-Path -LiteralPath $root) {
    Get-ChildItem -LiteralPath $root -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue |
      ForEach-Object {
        $name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
        if ($name -and -not $items.ContainsKey($name)) {
          $items[$name] = @{ name = $name; source = 'start-menu-shortcut'; appId = '' }
        }
      }
  }
}
$appPathRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths'
)
foreach ($registryRoot in $appPathRoots) {
  if (Test-Path -LiteralPath $registryRoot) {
    Get-ChildItem -LiteralPath $registryRoot -ErrorAction SilentlyContinue | ForEach-Object {
      $exeName = [IO.Path]::GetFileNameWithoutExtension($_.PSChildName)
      $registryKey = Get-Item -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
      $exePath = if ($registryKey) { $registryKey.GetValue('') }
      if ($exeName -and $exePath -and (Test-Path -LiteralPath $exePath -PathType Leaf) -and -not $items.ContainsKey($exeName)) {
        $items[$exeName] = @{ name = $exeName; source = 'app-path'; appId = '' }
      }
    }
  }
}
@($items.Values | Sort-Object -Property name | Select-Object -First 400) | ConvertTo-Json -Compress
`;
    const output = await runWindowsPowerShell(script);
    const applications = output ? JSON.parse(output) : [];
    return NextResponse.json({
      success: true,
      applications: Array.isArray(applications) ? applications : [applications],
      truncated: Array.isArray(applications) && applications.length >= 400,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not enumerate Windows applications';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Launch an application by its exact Start Menu/registered-app name.
 * User input is base64-encoded before being inserted into a fixed PowerShell
 * program; it is never interpreted as PowerShell code or a command line.
 */
export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) {
      return NextResponse.json(
        { error: 'Provide an application name between 1 and 200 characters.' },
        { status: 400 },
      );
    }

    const decision = authorizeAction('apps.launch');
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason, risk: decision.risk }, { status: decision.status });
    }

    const encodedName = Buffer.from(name, 'utf8').toString('base64');
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedName}'))
$registered = @(Get-StartApps | Where-Object { $_.Name -ieq $name })
if ($registered.Count -eq 1) {
  Start-Process -FilePath explorer.exe -ArgumentList ('shell:AppsFolder\' + [string]$registered[0].AppID)
  @{ success = $true; name = [string]$registered[0].Name; source = 'registered-app' } | ConvertTo-Json -Compress
  exit 0
}
$appPathMatches = @()
$appPathRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths'
)
foreach ($registryRoot in $appPathRoots) {
  if (Test-Path -LiteralPath $registryRoot) {
    $appPathMatches += Get-ChildItem -LiteralPath $registryRoot -ErrorAction SilentlyContinue | Where-Object {
      [IO.Path]::GetFileNameWithoutExtension($_.PSChildName) -ieq $name
    } | ForEach-Object {
      $registryKey = Get-Item -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
      $exePath = if ($registryKey) { $registryKey.GetValue('') }
      if ($exePath -and (Test-Path -LiteralPath $exePath -PathType Leaf)) { $exePath }
    }
  }
}
$appPathMatches = @($appPathMatches | Sort-Object -Unique)
if ($appPathMatches.Count -eq 1) {
  Start-Process -FilePath $appPathMatches[0]
  @{ success = $true; name = $name; source = 'app-path' } | ConvertTo-Json -Compress
  exit 0
}
if ($appPathMatches.Count -gt 1) {
  @{ success = $false; error = 'More than one registered application matches that name.'; candidates = $appPathMatches } | ConvertTo-Json -Compress
  exit 3
}
$roots = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
)
$matches = @()
foreach ($root in $roots) {
  if (Test-Path -LiteralPath $root) {
    $matches += Get-ChildItem -LiteralPath $root -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { [IO.Path]::GetFileNameWithoutExtension($_.Name) -ieq $name }
  }
}
$matches = @($matches | Sort-Object -Property FullName -Unique)
if ($matches.Count -eq 1) {
  Start-Process -FilePath $matches[0].FullName
  @{ success = $true; name = [IO.Path]::GetFileNameWithoutExtension($matches[0].Name); source = 'start-menu-shortcut' } | ConvertTo-Json -Compress
  exit 0
}
if ($matches.Count -gt 1) {
  @{ success = $false; error = 'More than one Start Menu shortcut has that name.'; candidates = @($matches | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_.Name) + ' — ' + $_.DirectoryName }) } | ConvertTo-Json -Compress
  exit 3
}
@{ success = $false; error = 'Application not found in registered Windows apps or Start Menu shortcuts. Add a Start Menu shortcut, then retry.' } | ConvertTo-Json -Compress
exit 2
`;

    const output = await runWindowsPowerShell(script);
    const result = JSON.parse(output || '{}');
    if (!result.success) {
      const status = result.candidates ? 409 : 404;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as { message?: string; stdout?: string; stderr?: string };
    const output = error.stdout || '';
    if (output) {
      try {
        const result = JSON.parse(output);
        return NextResponse.json(result, { status: result.candidates ? 409 : 404 });
      } catch {}
    }
    return NextResponse.json(
      { error: error.stderr || error.message || 'Windows application launch failed' },
      { status: 502 },
    );
  }
}
