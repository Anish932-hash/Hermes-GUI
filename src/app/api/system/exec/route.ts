import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { HERMES_PATH } from '@/lib/hermes';

const execAsync = promisify(exec);

// Allowed command list prefixes or safe commands to run in WSL
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
  'cat',
  'head',
  'tail',
  'grep',
  'echo',
  'date',
  'ip',
  'netstat',
  'ss',
  'hermes',
  'systemctl status',
  'which',
  'git status',
  'git diff',
  'git log',
  'git branch --show-current',
];

function isAllowedCommand(command: string): boolean {
  // This endpoint invokes a shell for the interactive terminal. Do not allow
  // shell composition, substitutions, redirection, or newlines.
  if (/[;&|<>`$()\n\r]/.test(command)) return false;
  return SAFE_PREFIXES.some((prefix) => command === prefix || command.startsWith(`${prefix} `));
}

export async function POST(req: Request) {
  try {
    const { command } = await req.json();
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

    if (!isAllowedCommand(trimmed)) {
      return NextResponse.json(
        {
          stdout: '',
          stderr: 'EXECUTION_DENIED: Use a supported diagnostic command. Shell operators and command chaining are not allowed.',
          exitCode: 1,
        },
        { status: 403 }
      );
    }

    const { stdout, stderr } = await execAsync(trimmed, {
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
