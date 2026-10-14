/** Strict read-only allowlist for diagnostic command execution. */
export function isAllowedDiagnosticCommand(args: string[]): boolean {
  if (args.length === 0) return false;
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
    case 'ps': return exact(['-eo', 'pid,%cpu,%mem,comm']);
    case 'ls': return noArgs() || exact(['-la']);
    case 'netstat': return exact(['-an']);
    case 'ss': return exact(['-tuln']);
    case 'ip': return exact(['addr', 'show']) || exact(['route', 'show']);
    case 'systemctl': return exact(['status', '--no-pager']);
    case 'which': return rest.length === 1 && ['node', 'npm', 'python3', 'git', 'hermes'].includes(rest[0]);
    case 'git': return exact(['status']) || exact(['branch', '--show-current']);
    default: return false;
  }
}
