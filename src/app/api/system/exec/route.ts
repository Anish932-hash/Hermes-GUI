import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { HERMES_PATH } from '@/lib/hermes';
import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';

const execFileAsync = promisify(execFile);

// Conservative read-only diagnostic command prefixes; never expose a general-purpose shell


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
  // Exact command/argument shapes keep this endpoint diagnostic-only.
  // In particular, don't let user-supplied paths or arbitrary flags turn
  // a harmless command into a file reader or a state-changing operation.
  const [command, ...rest] = args;
  const exact = (expected: string[]) =>
    rest.length === expected.length && rest.every((arg, index) => arg === expected[index]);
  const noArgs = () => rest.length === 0;

  switch (command) {
    case 'uname': return noArgs() || exact(['-a']);
    case 'uptime':
    case 'whoami':
    case 'id':
    case 'pwd':
    case 'date':
    case 'w': return noArgs();
    case 'free': return noArgs() || exact(['-h']) || exact(['-m']);
    case 'df': return exact(['-h']);
    case 'top': return exact(['-b', '-n', '1']);
    case 'ps': return exact(['aux']) || exact(['-ef']);
    case 'ls': return noArgs() || exact(['-la']);
    case 'netstat': return exact(['-an']);
    case 'ss': return exact(['-tuln']);
    case 'ip':
      return exact(['addr', 'show']) || exact(['route', 'show']);
    case 'systemctl':
      // Status only, with no pager or user-controlled service/unit argument.
      return exact(['status', '--no-pager']);
    case 'which':
      return rest.length === 1 && ['node', 'npm', 'python3', 'git', 'hermes'].includes(rest[0]);
    case 'git':
      return exact(['status']) || exact(['branch', '--show-current']);
    default: return false;
  }
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
      args.some((arg) => arg.length > 256 || /[\u0000-\u001f\u007f]/.test(arg)) ||
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
