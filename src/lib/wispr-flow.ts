import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WisprUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  authenticated: boolean;
}

export interface WisprKeybind {
  action: string;
  keys: string;
  code: number[];
}

export interface WisprDictation {
  id: string;
  timestamp: string;
  app: string;
  url?: string;
  status?: string;
  formattedText: string;
  pastedText: string;
  duration?: number;
  numWords?: number;
  e2eLatency?: number;
  detectedLanguage?: string;
  micDevice?: string;
}

export interface WisprStatusResponse {
  installed: boolean;
  running: boolean;
  appPath: string;
  version: string;
  user: WisprUser | null;
  keybinds: WisprKeybind[];
  recentDictations: WisprDictation[];
  lastDictation: WisprDictation | null;
  totalDictationsCount: number;
}

interface WisprPaths {
  roaming: string;
  local: string;
  database: string;
  config: string;
  session: string;
  executable: string;
}

let cachedPaths: WisprPaths | null = null;

function getWisprPaths(): WisprPaths {
  if (cachedPaths) return cachedPaths;

  const usersRoot = '/mnt/c/Users';
  const excludedUsers = new Set(['all users', 'default', 'default user', 'public']);
  let users: string[] = [];
  try {
    users = fs.readdirSync(usersRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !excludedUsers.has(entry.name.toLowerCase()))
      .map((entry) => entry.name);
  } catch {}

  const preferredUser = process.env.WISPR_FLOW_WINDOWS_USER;
  if (preferredUser) users = [preferredUser, ...users.filter((user) => user !== preferredUser)];

  const candidates = users.map((user) => {
    const userRoot = path.join(usersRoot, user);
    const roaming = path.join(userRoot, 'AppData', 'Roaming', 'Wispr Flow');
    const local = path.join(userRoot, 'AppData', 'Local', 'WisprFlow');
    const database = path.join(roaming, 'flow.sqlite');
    const executable = path.join(local, 'Wispr Flow.exe');
    let modified = 0;
    try { modified = fs.statSync(database).mtimeMs; } catch {}
    const score = Number(fs.existsSync(executable)) + Number(fs.existsSync(database));
    return {
      score: preferredUser === user && score > 0 ? score + 3 : score,
      modified,
      paths: {
        roaming,
        local,
        database,
        config: path.join(roaming, 'config.json'),
        session: path.join(roaming, 'session.json'),
        executable,
      },
    };
  }).sort((a, b) => b.score - a.score || b.modified - a.modified);

  cachedPaths = candidates[0]?.paths ?? {
    roaming: path.join(usersRoot, 'Default', 'AppData', 'Roaming', 'Wispr Flow'),
    local: path.join(usersRoot, 'Default', 'AppData', 'Local', 'WisprFlow'),
    database: path.join(usersRoot, 'Default', 'AppData', 'Roaming', 'Wispr Flow', 'flow.sqlite'),
    config: path.join(usersRoot, 'Default', 'AppData', 'Roaming', 'Wispr Flow', 'config.json'),
    session: path.join(usersRoot, 'Default', 'AppData', 'Roaming', 'Wispr Flow', 'session.json'),
    executable: path.join(usersRoot, 'Default', 'AppData', 'Local', 'WisprFlow', 'Wispr Flow.exe'),
  };
  return cachedPaths;
}

function mapKeyCodeToString(codes: number[]): string {
  const map: Record<number, string> = {
    20: 'Caps Lock',
    27: 'Escape',
    160: 'Shift',
    161: 'Shift',
    16: 'Shift',
    162: 'Ctrl',
    163: 'Ctrl',
    17: 'Ctrl',
    164: 'Alt',
    165: 'Alt',
    18: 'Alt',
    86: 'V',
    88: 'X',
    90: 'Z',
    77: 'M',
    32: 'Space',
    91: 'Win',
  };
  return codes.map((c) => map[c] || `Key(${c})`).join(' + ');
}

/**
 * Read active Wispr Flow user profile from session.json
 */
export function getWisprUser(): WisprUser | null {
  try {
    const { session } = getWisprPaths();
    if (!fs.existsSync(session)) return null;
    const raw = fs.readFileSync(session, 'utf-8');
    const data = JSON.parse(raw);
    const tokenKey = Object.keys(data).find((k) => k.includes('auth-token'));
    if (!tokenKey || !data[tokenKey]) return null;

    const tokenData = typeof data[tokenKey] === 'string' ? JSON.parse(data[tokenKey]) : data[tokenKey];
    const user = tokenData?.user;
    if (!user) return null;

    const metadata = user.user_metadata || {};
    return {
      id: user.id || '',
      name: metadata.full_name || metadata.name || 'Wispr User',
      email: user.email || metadata.email || '',
      avatarUrl: metadata.avatar_url || metadata.picture || '',
      authenticated: true,
    };
  } catch {
    return null;
  }
}

/**
 * Read configured keybinds from config.json
 */
export function getWisprKeybinds(): WisprKeybind[] {
  try {
    const { config } = getWisprPaths();
    if (!fs.existsSync(config)) return [];
    const raw = fs.readFileSync(config, 'utf-8');
    const data = JSON.parse(raw);
    const keybinds: WisprKeybind[] = [];

    const rawList = data.prefs?.cache?.splitKeybinds || data.splitKeybinds || [];

    if (Array.isArray(rawList)) {
      for (const item of rawList) {
        const rawCodes = item?.shortcut;
        const codes = Array.isArray(rawCodes)
          ? rawCodes.filter((code: unknown): code is number => Number.isInteger(code))
          : Number.isInteger(rawCodes)
            ? [rawCodes as number]
            : [];
        if (codes.length > 0 && typeof item?.value === 'string') {
          keybinds.push({
            action: item.value,
            keys: mapKeyCodeToString(codes),
            code: codes,
          });
        }
      }
    }
    return keybinds;
  } catch {
    return [
      { action: 'ptt', keys: 'Caps Lock', code: [20] },
      { action: 'dismiss', keys: 'Escape', code: [27] },
    ];
  }
}

/**
 * Safely query flow.sqlite using an atomic read snapshot
 */
export function getWisprDictations(limit = 20): { dictations: WisprDictation[]; totalCount: number } {
  try {
    const { database } = getWisprPaths();
    if (!fs.existsSync(database)) return { dictations: [], totalCount: 0 };

    // Read SQLite's live WAL snapshot directly. Copying only the main file can
    // omit recent records, while a shared /tmp copy races concurrent pollers.
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(database, { readOnly: true });

    let totalCount = 0;
    let rows: any[] = [];
    try {
      try {
        const countRow = db.prepare('SELECT COUNT(*) as count FROM History').get();
        if (countRow && typeof countRow.count === 'number') {
          totalCount = countRow.count;
        }
      } catch {}

      const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
      rows = db
        .prepare(
          `SELECT transcriptEntityId, timestamp, app, url, status, formattedText, pastedText, duration, numWords, e2eLatency, detectedLanguage, micDevice
           FROM History
           ORDER BY timestamp DESC, transcriptEntityId DESC
           LIMIT ?`
        )
        .all(safeLimit);
    } finally {
      try {
        db.close();
      } catch {}
    }

    const dictations: WisprDictation[] = (rows as any[]).map((r) => {
      const formattedText = String(r.formattedText || r.pastedText || '').trim();
      const pastedText = String(r.pastedText || r.formattedText || '').trim();
      const rawTimestamp = r.timestamp;
      let timestamp = '';
      if (typeof rawTimestamp === 'number' || typeof rawTimestamp === 'bigint') {
        const numeric = Number(rawTimestamp);
        const milliseconds = numeric > 100_000_000_000_000 ? numeric / 1_000_000
          : numeric > 100_000_000_000 ? numeric
            : numeric * 1000;
        if (Number.isFinite(milliseconds)) timestamp = new Date(milliseconds).toISOString();
      } else if (rawTimestamp != null) {
        const value = String(rawTimestamp);
        const numeric = Number(value);
        if (value.trim() && Number.isFinite(numeric)) {
          const milliseconds = numeric > 100_000_000_000_000 ? numeric / 1_000_000
            : numeric > 100_000_000_000 ? numeric
              : numeric * 1000;
          if (Number.isFinite(milliseconds)) timestamp = new Date(milliseconds).toISOString();
        } else {
          const parsed = Date.parse(value);
          timestamp = Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
        }
      }

      return {
        id: String(r.transcriptEntityId || `${timestamp}:${formattedText.slice(0, 80)}`),
        timestamp,
        app: r.app || 'Unknown',
        url: r.url || undefined,
        status: r.status || 'finalized',
        formattedText,
        pastedText,
        duration: typeof r.duration === 'number' ? r.duration : undefined,
        numWords: typeof r.numWords === 'number' ? r.numWords : undefined,
        e2eLatency: typeof r.e2eLatency === 'number' ? r.e2eLatency : undefined,
        detectedLanguage: r.detectedLanguage || undefined,
        micDevice: r.micDevice || undefined,
      };
    });

    return { dictations, totalCount };
  } catch (err) {
    console.warn('Wispr dictation snapshot query notice:', err);
    return { dictations: [], totalCount: 0 };
  }
}

let lastProcessCheckTime = 0;
let cachedRunning = false;

/**
 * Check if Wispr Flow process is actively running on Windows host
 */
export async function isWisprProcessRunning(): Promise<boolean> {
  const now = Date.now();
  if (now - lastProcessCheckTime < 4000) {
    return cachedRunning;
  }
  try {
    const { stdout } = await execAsync(
      `powershell.exe -NoProfile -NonInteractive -Command "if (Get-Process 'Wispr Flow' -ErrorAction SilentlyContinue) { 'RUNNING' } else { 'STOPPED' }" < /dev/null`,
      { timeout: 3500, windowsHide: true }
    );
    cachedRunning = stdout.trim() === 'RUNNING';
  } catch {
    cachedRunning = false;
  }
  lastProcessCheckTime = now;
  return cachedRunning;
}

/**
 * Get comprehensive Wispr Flow status and latest dictations
 */
export async function getWisprStatus(): Promise<WisprStatusResponse> {
  const { executable, database, local } = getWisprPaths();
  const installed = fs.existsSync(executable) || fs.existsSync(database);
  const user = getWisprUser();
  const keybinds = getWisprKeybinds();
  const { dictations, totalCount } = getWisprDictations(15);

  let version = 'Unknown';
  try {
    const appDirs = fs.readdirSync(local).filter((d) => d.startsWith('app-'));
    if (appDirs.length > 0) {
      version = appDirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0].replace('app-', '');
    }
  } catch {}

  const running = await isWisprProcessRunning();

  return {
    installed,
    running,
    appPath: executable,
    version,
    user,
    keybinds,
    recentDictations: dictations,
    lastDictation: dictations.find((d) => (d.formattedText || d.pastedText || '').trim().length > 0) || dictations[0] || null,
    totalDictationsCount: totalCount,
  };
}

/**
 * Launch Wispr Flow on Windows host silently in background tray
 */
let wisprLaunchInFlight: Promise<{ success: boolean; message: string }> | null = null;

export function launchWisprFlowApp(): Promise<{ success: boolean; message: string }> {
  if (wisprLaunchInFlight) return wisprLaunchInFlight;
  wisprLaunchInFlight = launchWisprFlowAppOnce().finally(() => {
    wisprLaunchInFlight = null;
  });
  return wisprLaunchInFlight;
}

async function launchWisprFlowAppOnce(): Promise<{ success: boolean; message: string }> {
  try {
    const { executable } = getWisprPaths();
    if (!fs.existsSync(executable)) {
      return { success: false, message: 'Wispr Flow is not installed in the detected Windows profile' };
    }
    const windowsPath = executable
      .replace(/^\/mnt\/([a-z])\//i, (_, drive: string) => `${drive.toUpperCase()}:\\`)
      .replace(/\//g, '\\');
    const command = `$p = '${windowsPath.replace(/'/g, "''")}'; if (-not (Test-Path -LiteralPath $p)) { exit 2 }; Start-Process -FilePath $p -WindowStyle Hidden`;
    const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
    await execAsync(
      `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand} < /dev/null`,
      { timeout: 6000, windowsHide: true }
    );
    cachedRunning = false;
    lastProcessCheckTime = 0;
    return { success: true, message: 'Wispr Flow launch request sent to the Windows host' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to launch Wispr Flow' };
  }
}

/**
 * Trigger Wispr Flow Push-To-Talk via simulated hotkey (Caps Lock)
 */
export async function triggerWisprPtt(): Promise<{ success: boolean; message: string }> {
  try {
    if (!(await isWisprProcessRunning())) {
      return { success: false, message: 'Wispr Flow is not running. Launch it before triggering dictation.' };
    }
    const ptt = getWisprKeybinds().find((keybind) => keybind.action.toLowerCase() === 'ptt');
    if (!ptt || ptt.code.length === 0) {
      return { success: false, message: 'Wispr Flow has no readable push-to-talk shortcut configured.' };
    }
    const modifiers = new Set(ptt.code);
    const modifierPrefix = `${[162, 163, 17].some((code) => modifiers.has(code)) ? '^' : ''}${[160, 161, 16].some((code) => modifiers.has(code)) ? '+' : ''}${[164, 165, 18].some((code) => modifiers.has(code)) ? '%' : ''}`;
    const modifierCodes = new Set([16, 17, 18, 160, 161, 162, 163, 164, 165]);
    const keyCode = ptt.code.find((code) => !modifierCodes.has(code));
    const sendKey = keyCode === 20 ? '{CAPSLOCK}'
      : keyCode === 27 ? '{ESC}'
        : keyCode === 32 ? ' '
          : keyCode !== undefined && keyCode >= 65 && keyCode <= 90 ? String.fromCharCode(keyCode).toLowerCase()
            : keyCode !== undefined && keyCode >= 48 && keyCode <= 57 ? String.fromCharCode(keyCode)
              : keyCode !== undefined && keyCode >= 112 && keyCode <= 135 ? `{F${keyCode - 111}}`
                : '';
    if (!sendKey || ptt.code.some((code) => code === 91 || code === 92)) {
      return { success: false, message: `The configured Wispr shortcut (${ptt.keys}) cannot be triggered from this control.` };
    }
    const command = `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${`${modifierPrefix}${sendKey}`.replace(/'/g, "''")}')`;
    const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
    await execAsync(
      `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand} < /dev/null`,
      { timeout: 5000, windowsHide: true }
    );
    return { success: true, message: `Wispr Flow shortcut triggered (${ptt.keys})` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to trigger Wispr PTT' };
  }
}
