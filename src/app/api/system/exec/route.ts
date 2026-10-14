import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { HERMES_PATH } from '@/lib/hermes';
import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';

const execFileAsync = promisify(execFile);

// Conservative read-only diagnostic command prefixes; never expose a general-purpose shell
const SAFE_PREFIXES = [
  'uname',
  'uptime',
  'free',
  'df',
  'top',
  'ps',
  'w',
  'whoami',
  'id',
  'ls',
  'pwd',
  'date',
  'ip addr',
  'ip route',
  'netstat',
  'ss',
  'systemctl status',
  'which',
  'git status',
  'git branch --show-current',
];

function parseCommand(command: string): string[] | null {
  // Reject shell operators and execute the parsed arguments directly with execFile.
  if (/[;&|<>\x60$()\n\r]/.test(command)) return null;

  const args: string[] = [];
  let token = '';
  let quote: "'" | '"' | null = null;
  let started = false;

  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      started = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        args.push(token);
        token = '';
        started = false;
      }
    } else {
      token += char;
      started = true;
    }
  }

  if (quote) return null;
  if (started) args.push(token);
  return args.length ? args : null;
}

function isAllowedCommand(args: string[]): boolean {
  return SAFE_PREFIXES.some((prefix) => {
    const expected = prefix.split(' ');
    return expected.every((part, index) => args[index] === part);
  });
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const decision = authorizeAction('system.exec.diagnostic');
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason, risk: decision.risk }, { status: decision.status });
    }
    const command = body?.command;
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command string is required' }, { status: 400 });
    }

    const trimmed = command.trim();
    if (trimmed.length > 4096) {
      return NextResponse.json({ stdout: '', stderr: 'Command exceeds the 4096 character limit.', exitCode: 1 }, { status: 413 });
    }
    if (!trimmed) {
      return NextResponse.json({ stdout: '', stderr: '', exitCode: 0 });
    }

    // Safety filter: prevent dangerous destructive commands like rm -rf / or mkfs
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('rm -rf') ||
      lower.includes('mkfs') ||
      lower.includes(':(){ :|:& };:') ||
      lower.includes('shutdown') ||
      lower.includes('reboot') ||
      lower.includes('> /dev/sda') ||
      lower.match(/^kill\s+(-9\s+)?1(\s|$)/) // Protect PID 1
    ) {
      return NextResponse.json(
        {
          stdout: '',
          stderr: 'EXECUTION_DENIED: Destructive or system-critical alteration commands are restricted by Stark Protocol.',
          exitCode: 1,
        },
        { status: 403 }
      );
    }

    const args = parseCommand(trimmed);
    if (
      !args ||
      args.length > 12 ||
      args.some((arg) => arg.length > 256 || /[\\u0000-\\u001f\\u007f]/.test(arg)) ||
      args.some((arg) => /^--?(?:output|exec|upload-pack|receive-pack|config|work-tree|git-dir)(?:=|$)/i.test(arg)) ||
      !isAllowedCommand(args)
    ) {
      return NextResponse.json(
        {
          stdout: '',
          stderr: 'EXECUTION_DENIED: Use a supported diagnostic command. Shell operators and command chaining are not allowed.',
          exitCode: 1,
        },
        { status: 403 }
      );
    }

    const { stdout, stderr } = await execFileAsync(args[0], args.slice(1), {
      env: {
        ...process.env,
        PATH: HERMES_PATH,
        TERM: 'xterm-256color',
      },
      timeout: 10000,
      maxBuffer: 1024 * 512,
    });

    return NextResponse.json({
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Execution error',
      exitCode: err.code || 1,
      executedAt: new Date().toISOString(),
    });
  }
}
