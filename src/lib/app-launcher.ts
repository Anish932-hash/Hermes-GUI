import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);
export type AppTarget = 'auto' | 'windows' | 'kali';
export interface DiscoveredApp { name: string; target: 'windows' | 'kali'; source: string; desktopId?: string }
export interface AppLaunchIntent { name: string; target: AppTarget }
export interface AppLaunchResult { handled: true; success: boolean; message: string; app?: DiscoveredApp; candidates?: DiscoveredApp[] }

async function powershell(script: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: '/mnt/c', timeout: 12000, windowsHide: true, maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

const WINDOWS_DISCOVERY_SCRIPT = [
  "$ErrorActionPreference = 'Stop'; $items = @{}",
  "Get-StartApps | ForEach-Object { if ($_.Name -and $_.AppID) { $n = [string]$_.Name; if (-not $items.ContainsKey($n)) { $items[$n] = @{ name=$n; source='registered-app' } } } }",
  "$roots = @((Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),(Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs'))",
  "foreach ($root in $roots) { if (Test-Path -LiteralPath $root) { Get-ChildItem -LiteralPath $root -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $n=[IO.Path]::GetFileNameWithoutExtension($_.Name); if ($n -and -not $items.ContainsKey($n)) { $items[$n]=@{name=$n;source='start-menu-shortcut'} } } } }",
  "$appRoots = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths')",
  "foreach ($root in $appRoots) { if (Test-Path -LiteralPath $root) { Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object { $n=[IO.Path]::GetFileNameWithoutExtension($_.PSChildName); $k=Get-Item -LiteralPath $_.PSPath -ErrorAction SilentlyContinue; $p=if($k){$k.GetValue('')}; if($n -and $p -and (Test-Path -LiteralPath $p -PathType Leaf) -and -not $items.ContainsKey($n)){$items[$n]=@{name=$n;source='app-path'}} } } }",
  "@($items.Values | Sort-Object -Property name | Select-Object -First 800) | ConvertTo-Json -Compress",
].join('\n');

export async function listWindowsApplications(): Promise<DiscoveredApp[]> {
  if (!fs.existsSync('/mnt/c')) return [];
  const output = await powershell(WINDOWS_DISCOVERY_SCRIPT);
  if (!output) return [];
  const parsed = JSON.parse(output);
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((x) => typeof x?.name === 'string')
    .map((x) => ({ name: String(x.name), target: 'windows' as const, source: String(x.source || 'registered-app') }));
}

function desktopFiles(root: string, depth = 0, result: string[] = []): string[] {
  if (depth > 5 || result.length >= 2500) return result;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return result; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) desktopFiles(full, depth + 1, result);
    else if (entry.isFile() && entry.name.endsWith('.desktop')) result.push(full);
    if (result.length >= 2500) break;
  }
  return result;
}

export function listKaliApplications(): DiscoveredApp[] {
  const roots = ['/usr/share/applications', '/usr/local/share/applications', path.join(os.homedir(), '.local/share/applications'), '/var/lib/flatpak/exports/share/applications', '/var/lib/snapd/desktop/applications'];
  const apps = new Map<string, DiscoveredApp>();
  for (const root of roots) for (const file of desktopFiles(root)) {
    try {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
      const nameLine = lines.find((line) => line.startsWith('Name='));
      if (!nameLine || !lines.some((line) => line.startsWith('Exec=')) || lines.some((line) => /^Hidden=true$/i.test(line) || /^NoDisplay=true$/i.test(line))) continue;
      const name = nameLine.slice(5).trim();
      if (!name || name.length > 160) continue;
      const desktopId = path.relative(root, file).split(path.sep).join('-').replace(/\.desktop$/i, '');
      if (!apps.has(desktopId)) apps.set(desktopId, { name, target: 'kali', source: 'desktop-entry', desktopId });
    } catch { /* Skip malformed desktop entries. */ }
  }
  return [...apps.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 800);
}

const aliases: Record<string, string[]> = {
  vscode: ['visual studio code', 'code'], code: ['visual studio code', 'code'],
  chrome: ['google chrome', 'chrome'], edge: ['microsoft edge', 'edge'],
  calc: ['calculator'], explorer: ['file explorer', 'windows explorer', 'explorer'],
  firefox: ['firefox', 'firefox esr'], terminal: ['windows terminal', 'xfce terminal', 'qterminal', 'terminal'],
};
const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

export function parseAppLaunchIntent(text: string): AppLaunchIntent | null {
  if (typeof text !== 'string' || text.length > 500) return null;
  const match = text.trim().replace(/[.!?]+$/, '').match(/^(?:(?:hey|hi|okay|ok)\s+)?(?:(?:hermes|jarvis)[,\s]+)?(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?(.+)$/i);
  if (!match) return null;
  let name = match[1].trim();
  let target: AppTarget = 'auto';
  const targetMatch = name.match(/\s+(?:on|in|under|using)\s+(?:the\s+)?(windows|win(?:dows)?\s+host|kali(?:\s+linux)?|linux|wsl(?:2)?(?:\s+kali(?:\s+linux)?)?)$/i);
  if (targetMatch) {
    target = /^(?:kali|linux|wsl)/i.test(targetMatch[1]) ? 'kali' : 'windows';
    name = name.slice(0, targetMatch.index).trim();
  }
  name = name.replace(/\s+(?:please|for me|right now|now)$/i, '').replace(/^(?:my\s+)?(?:app|application|program)\s+/i, '').trim();
  if (!name || name.length > 160 || /[\r\n\0]/.test(name)) return null;
  return { name, target };
}

function resolve(name: string, apps: DiscoveredApp[]) {
  const terms = [norm(name), ...(aliases[norm(name)] || []).map(norm)];
  const exact = apps.filter((app) => terms.includes(norm(app.name)));
  if (exact.length === 1) return { app: exact[0] };
  if (exact.length > 1) return { candidates: exact };
  const partial = apps.filter((app) => terms.some((term) => term.length >= 3 && (norm(app.name).startsWith(term) || norm(app.name).endsWith(term))));
  if (partial.length === 1) return { app: partial[0] };
  if (partial.length > 1) return { candidates: partial.slice(0, 12) };
  return {};
}

async function launchWindows(app: DiscoveredApp): Promise<void> {
  const encoded = Buffer.from(app.name, 'utf8').toString('base64');
  const script = [
    "$ErrorActionPreference='Stop'; $name=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + encoded + "'))",
    "$registered=@(Get-StartApps | Where-Object {$_.Name -ieq $name}); if($registered.Count -eq 1){Start-Process explorer.exe -ArgumentList ('shell:AppsFolder\\' + [string]$registered[0].AppID); exit 0}",
    "$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths'); $paths=@()",
    "foreach($root in $roots){if(Test-Path -LiteralPath $root){$paths+=Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | Where-Object {[IO.Path]::GetFileNameWithoutExtension($_.PSChildName) -ieq $name} | ForEach-Object {$k=Get-Item -LiteralPath $_.PSPath -ErrorAction SilentlyContinue; $p=if($k){$k.GetValue('')}; if($p -and (Test-Path -LiteralPath $p -PathType Leaf)){$p}}}}",
    "$paths=@($paths | Sort-Object -Unique); if($paths.Count -eq 1){Start-Process -FilePath $paths[0]; exit 0}",
    "$roots=@((Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),(Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs')); $matches=@()",
    "foreach($root in $roots){if(Test-Path -LiteralPath $root){$matches+=Get-ChildItem -LiteralPath $root -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue | Where-Object {[IO.Path]::GetFileNameWithoutExtension($_.Name) -ieq $name}}}",
    "$matches=@($matches | Sort-Object -Property FullName -Unique); if($matches.Count -eq 1){Start-Process -FilePath $matches[0].FullName; exit 0}; throw 'Application not found or ambiguous'",
  ].join('\n');
  await powershell(script);
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', env: process.env });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
async function launchKali(app: DiscoveredApp): Promise<void> {
  if (!app.desktopId) throw new Error('Kali app has no safe desktop launcher ID.');
  try { await spawnDetached('gtk-launch', [app.desktopId]); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await spawnDetached('gio', ['launch', '/usr/share/applications/' + app.desktopId + '.desktop']);
  }
}

async function performAppLaunch(intent: AppLaunchIntent): Promise<AppLaunchResult> {
  let windows: DiscoveredApp[] = [];
  let kali: DiscoveredApp[] = [];
  if (intent.target !== 'kali') try { windows = await listWindowsApplications(); } catch { windows = []; }
  if (intent.target !== 'windows') kali = listKaliApplications();
  const winMatch = intent.target !== 'kali' ? resolve(intent.name, windows) : {};
  const kaliMatch = intent.target !== 'windows' ? resolve(intent.name, kali) : {};
  const app = winMatch.app || kaliMatch.app;
  const candidates = winMatch.candidates || kaliMatch.candidates;
  if (!app && candidates?.length) return {
    handled: true, success: false,
    message: 'More than one app matches "' + intent.name + '": ' + candidates.map((a) => a.name + ' (' + a.target + ')').join(', ') + '. Please specify a more exact name or say "in Windows" / "in Kali".',
    candidates,
  };
  if (!app) {
    const target = intent.target === 'auto' ? 'Windows or Kali Linux' : intent.target === 'windows' ? 'Windows' : 'Kali Linux';
    return { handled: true, success: false, message: 'I could not find "' + intent.name + '" among discovered ' + target + ' apps. It may need to be installed or have a Start Menu / .desktop launcher.' };
  }
  try {
    if (app.target === 'windows') await launchWindows(app); else await launchKali(app);
    return { handled: true, success: true, app, message: 'Launch request sent to ' + app.name + ' on ' + (app.target === 'windows' ? 'Windows' : 'Kali Linux') + '.' };
  } catch (error) {
    return { handled: true, success: false, app, message: 'Found ' + app.name + ' on ' + app.target + ', but launch failed: ' + (error instanceof Error ? error.message : 'unknown error') };
  }
}


const inFlightLaunches = new Map<string, Promise<AppLaunchResult>>();
const recentLaunches = new Map<string, { at: number; result: AppLaunchResult }>();

export async function launchAppFromText(text: string): Promise<AppLaunchResult | null> {
  const intent = parseAppLaunchIntent(text);
  if (!intent) return null;
  const key = intent.target + ':' + norm(intent.name);
  const recent = recentLaunches.get(key);
  if (recent && Date.now() - recent.at < 2500 && recent.result.success) return recent.result;
  const active = inFlightLaunches.get(key);
  if (active) return active;
  const operation = performAppLaunch(intent);
  inFlightLaunches.set(key, operation);
  try {
    const result = await operation;
    if (result.success) recentLaunches.set(key, { at: Date.now(), result });
    return result;
  } finally {
    inFlightLaunches.delete(key);
  }
}
