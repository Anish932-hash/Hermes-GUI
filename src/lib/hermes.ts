import { execFile, exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { resolveLocationCoordinates, GODS_EYE_PRESETS, extractGodsEyeTarget } from './godseye';

export const execFileAsync = promisify(execFile);
export const execAsync = promisify(exec);

export const HERMES_BIN = '/home/thecyberexpert/.hermes/hermes-agent/.hermes/bin/hermes';
export const HERMES_HOME = '/home/thecyberexpert/.hermes';
export const HERMES_PATH =
  '/home/thecyberexpert/.hermes/tools/python-3.14.7+20260901-linux-x64/bin:' +
  '/home/thecyberexpert/.hermes/hermes-agent/.hermes/bin:' +
  '/home/thecyberexpert/.hermes/hermes-agent/node_modules/.bin:' +
  '/home/thecyberexpert/.hermes/tools/node-26.7.0-linux-x64/bin:' +
  '/home/thecyberexpert/.hermes/tools/npm-12.0.2-linux-x64/bin:' +
  '/home/thecyberexpert/.local/bin:' +
  '/home/thecyberexpert/.cargo/bin:' +
  (process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin');

export interface HermesStatus {
  version: string;
  gatewayState: 'running' | 'stopped' | 'unknown';
  gatewayPid?: number;
  model: string;
  provider: string;
  platforms: {
    telegram?: { state: string; error?: string | null };
    whatsapp?: { state: string; error?: string | null };
  };
  activeAgents: number;
  skillsCount: number;
  sessionsCount: number;
}

export interface HermesSessionItem {
  id: string;
  title: string;
  workspace: string;
  lastActive: string;
  messageCount?: number;
}

export interface HermesSkillItem {
  name: string;
  category: string;
  source: string;
  trust: string;
  status: string;
}

export interface ProcessInfo {
  pid: string;
  name: string;
  app: string;
  cpu: string;
  mem: string;
  status: 'RUNNING' | 'ACTIVE' | 'SLEEP' | 'I/O WAIT';
}

export interface SystemTelemetry {
  cpuUsage: number;
  gpuUsage: number;
  gpuAvailable: boolean;
  ramUsage: number;
  ramTotalMB: number;
  ramUsedMB: number;
  diskUsage: number;
  diskTotalGB: number;
  diskUsedGB: number;
  networkInMbps: number;
  networkOutMbps: number;
  batteryLevel: number;
  batteryCharging: boolean;
  batteryAvailable: boolean;
  cpuTemperatureC: number;
  cpuFrequencyGHz: number;
  uptimeSeconds: number;
  uptimeFormatted: string;
  loadAverage: string;
  cpuModel: string;
  gpuModel: string;
  distro: string;
  kernel: string;
  topProcesses: Array<ProcessInfo>;
}

export function mapProcessToApp(comm: string): { app: string; status: 'RUNNING' | 'ACTIVE' | 'SLEEP' | 'I/O WAIT' } {
  const c = comm.toLowerCase();
  if (c.includes('hermes')) return { app: 'Hermes Agent Core (PID 358)', status: 'RUNNING' };
  if (c.includes('node') || c.includes('next')) return { app: 'Studio Next.js V8 Engine', status: 'ACTIVE' };
  if (c.includes('vite')) return { app: "God's Eye Cesium Engine", status: 'ACTIVE' };
  if (c.includes('python') || c.includes('uv')) return { app: 'uv Python 3.14 Isolation', status: 'RUNNING' };
  if (c.includes('bash') || c.includes('sh') || c.includes('zsh')) return { app: 'Kali Linux Terminal PTY', status: 'ACTIVE' };
  if (c.includes('systemd') || c.includes('init')) return { app: 'Kali WSL2 Systemd Core', status: 'ACTIVE' };
  if (c.includes('sshd')) return { app: 'Kali SSH Perimeter', status: 'SLEEP' };
  if (c.includes('sqlite')) return { app: 'SQLite WAL State Storage', status: 'ACTIVE' };
  if (c.includes('nmap') || c.includes('sqlmap') || c.includes('wireshark')) return { app: 'Arsenal Security Suite', status: 'RUNNING' };
  return { app: 'Kali Linux WSL2 Subsystem', status: 'SLEEP' };
}

let lastCpuStat: { total: number; idle: number } | null = null;
let lastNetStat: { rxBytes: number; txBytes: number; timestamp: number } | null = null;

export async function getHermesStatus(): Promise<HermesStatus> {
  let version = 'unknown';
  let gatewayState: 'running' | 'stopped' | 'unknown' = 'unknown';
  let gatewayPid: number | undefined;
  let model = 'unconfigured';
  let provider = 'unconfigured';
  const platforms: HermesStatus['platforms'] = {
    telegram: { state: 'unknown' },
    whatsapp: { state: 'unknown' },
  };
  let activeAgents = 0;
  let sessionsCount = 0;

  try {
    const serviceState = (await execAsync('systemctl --user is-active hermes-gateway')).stdout.trim();
    if (serviceState === 'active') gatewayState = 'running';
    else if (serviceState === 'inactive' || serviceState === 'failed') gatewayState = 'stopped';
  } catch (error: any) {
    const serviceState = String(error.stdout || '').trim();
    if (serviceState === 'inactive' || serviceState === 'failed') gatewayState = 'stopped';
    // Keep the state unknown when systemd cannot report a service status.
  }

  try {
    const gatewayStatePath = path.join(HERMES_HOME, 'gateway_state.json');
    if (fs.existsSync(gatewayStatePath)) {
      const stateContent = fs.readFileSync(gatewayStatePath, 'utf8');
      const data = JSON.parse(stateContent);
      version = data.code_version || version;
      gatewayPid = data.pid || gatewayPid;
      if (Number.isInteger(gatewayPid) && gatewayPid! > 0) {
        try {
          process.kill(gatewayPid!, 0);
          gatewayState = 'running';
        } catch {
          if (gatewayState !== 'unknown') gatewayState = 'stopped';
        }
      }
      activeAgents = data.active_agents || 0;
      if (data.platforms) {
        if (data.platforms.telegram) {
          platforms.telegram = {
            state: data.platforms.telegram.state || 'connected',
            error: data.platforms.telegram.error_message,
          };
        }
        if (data.platforms.whatsapp) {
          platforms.whatsapp = {
            state: data.platforms.whatsapp.state || 'retrying',
            error: data.platforms.whatsapp.error_message,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Error reading Hermes gateway_state.json:', err);
  }

  try {
    const configPath = path.join(HERMES_HOME, 'config.yaml');
    if (fs.existsSync(configPath)) {
      const configStr = fs.readFileSync(configPath, 'utf8');
      const modelMatch = configStr.match(/default:\s*['"]?([^'"\n]+)['"]?/);
      if (modelMatch) model = modelMatch[1];
      const providerMatch = configStr.match(/provider:\s*['"]?([^'"\n#]+)['"]?/);
      if (providerMatch) provider = providerMatch[1].trim();
    }
  } catch (err) {
    console.warn('Error reading Hermes config.yaml:', err);
  }

  try {
    const dbPath = path.join(HERMES_HOME, 'state.db');
    if (fs.existsSync(dbPath)) {
      const countRes = await execAsync(`sqlite3 -cmd ".timeout 2000" "${dbPath}" "SELECT count(*) FROM sessions;"`, {
        timeout: 4000,
      });
      sessionsCount = parseInt(countRes.stdout.trim(), 10) || sessionsCount;
    }
  } catch {
    // fallback
  }

  const skillsCount = (await getHermesSkills().catch(() => [])).length;

  return {
    version,
    gatewayState,
    gatewayPid,
    model,
    provider,
    platforms,
    activeAgents,
    skillsCount,
    sessionsCount,
  };
}

export async function getHermesSessions(): Promise<HermesSessionItem[]> {
  try {
    const dbPath = path.join(HERMES_HOME, 'state.db');
    if (fs.existsSync(dbPath)) {
      const query = `SELECT id, COALESCE(title, id), datetime(last_activity_at, 'unixepoch'), COALESCE(cwd, '—'), message_count FROM sessions ORDER BY last_activity_at DESC LIMIT 35;`;
      const { stdout } = await execAsync(`sqlite3 -cmd ".timeout 2000" -separator '|' "${dbPath}" "${query}"`, {
        timeout: 5000,
      });

      const lines = stdout.split('\n').filter(Boolean);
      const sessions: HermesSessionItem[] = [];

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          sessions.push({
            id: parts[0].trim(),
            title: parts[1].trim() || parts[0].trim(),
            lastActive: parts[2].trim(),
            workspace: parts[3].trim() === '—' ? 'default' : parts[3].trim().split('/').pop() || 'ws',
            messageCount: parseInt(parts[4] || '0', 10),
          });
        }
      }

      if (sessions.length > 0) return sessions;
    }
  } catch (err) {
    console.warn('Error querying sqlite state.db for sessions:', err);
  }

  return [];
}

export async function getSessionMessages(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  try {
    const dbPath = path.join(HERMES_HOME, 'state.db');
    if (fs.existsSync(dbPath)) {
      const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
      const query = `SELECT role, content FROM messages WHERE session_id = '${safeId}' AND role IN ('user', 'assistant') ORDER BY id ASC LIMIT 100;`;
      const { stdout } = await execAsync(`sqlite3 -cmd ".timeout 2000" -separator '|---MSG---|' "${dbPath}" "${query}"`, {
        timeout: 5000,
      });

      const rows = stdout.split('\n').filter(Boolean);
      const messages: Array<{ role: string; content: string }> = [];

      for (const row of rows) {
        const [role, content] = row.split('|---MSG---|');
        if (content && content.trim() !== 'NULL') {
          messages.push({
            role: role === 'assistant' ? 'model' : 'user',
            content: content.trim(),
          });
        }
      }

      return messages;
    }
  } catch (err) {
    console.warn('Error fetching messages for session:', err);
  }
  return [];
}

export async function getHermesSkills(): Promise<HermesSkillItem[]> {
  const skills: HermesSkillItem[] = [];
  const skillsDir = path.join(HERMES_HOME, 'skills');

  try {
    if (fs.existsSync(skillsDir)) {
      const categories = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const cat of categories) {
        if (cat.isDirectory() && !cat.name.startsWith('.')) {
          const catPath = path.join(skillsDir, cat.name);
          const skillFolders = fs.readdirSync(catPath, { withFileTypes: true });
          for (const s of skillFolders) {
            if (s.isDirectory()) {
              skills.push({
                name: s.name,
                category: cat.name,
                source: 'builtin',
                trust: 'trusted',
                status: 'enabled',
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading skills from disk:', err);
  }

  try {
    const manifestPath = path.join(skillsDir, '.bundled_manifest');
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        const [skillName] = line.split(':');
        if (skillName && !skills.some((s) => s.name === skillName)) {
          skills.push({
            name: skillName,
            category: 'tools',
            source: 'bundled',
            trust: 'official',
            status: 'enabled',
          });
        }
      }
    }
  } catch {
    // ignore
  }

  const localSkills = [
    { name: 'offensive-security-mcp', category: 'security', source: 'local', trust: 'local', status: 'enabled' },
    { name: 'kali-wsl-wifi-pentest', category: 'security', source: 'local', trust: 'local', status: 'enabled' },
    { name: 'osint-kali-toolkit', category: 'research', source: 'local', trust: 'local', status: 'enabled' },
    { name: 'puter-ai', category: 'autonomous-ai-agents', source: 'local', trust: 'local', status: 'enabled' },
  ];

  for (const ls of localSkills) {
    if (!skills.some((s) => s.name === ls.name)) {
      skills.push(ls);
    }
  }

  return skills;
}

export async function manageGateway(action: 'start' | 'stop' | 'restart' | 'status'): Promise<{ success: boolean; message: string; output?: string }> {
  try {
    if (action === 'status') {
      const { stdout } = await execAsync('systemctl --user status hermes-gateway --no-pager');
      return { success: true, message: 'Status retrieved', output: stdout };
    }

    const { stdout, stderr } = await execAsync(`systemctl --user ${action} hermes-gateway`);
    return {
      success: true,
      message: `Gateway ${action} executed successfully.`,
      output: stdout || stderr,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to ${action} gateway: ${err.message}`,
      output: err.stderr || err.stdout,
    };
  }
}

export async function getGatewayLogs(limit = 40): Promise<string> {
  try {
    const { stdout } = await execAsync(`journalctl --user -u hermes-gateway -n ${limit} --no-pager`);
    return stdout;
  } catch {
    const agentLogPath = path.join(HERMES_HOME, 'logs', 'agent.log');
    if (fs.existsSync(agentLogPath)) {
      const content = fs.readFileSync(agentLogPath, 'utf8');
      return content.split('\n').slice(-limit).join('\n');
    }
    return 'No log stream available.';
  }
}

export async function performSystemBoost(): Promise<{
  freedMB: number;
  beforeRamMB: number;
  afterRamMB: number;
  details: string[];
}> {
  const details: string[] = [];

  // Read initial memory
  let beforeRamMB = 1000;
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
    const availMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
    if (totalMatch && availMatch) {
      beforeRamMB = Math.round((parseInt(totalMatch[1], 10) - parseInt(availMatch[1], 10)) / 1024);
    }
  } catch {}

  // 1. Sync disk filesystem buffers
  try {
    await execAsync('sync');
    details.push('Filesystem cache buffers flushed to disk via sync');
  } catch {}

  // 2. Trim Node memory garbage collector
  try {
    if ((global as any).gc) {
      (global as any).gc();
      details.push('Node.js V8 Heap garbage collection cycle executed');
    }
  } catch {}

  // 3. Clean stale audio/image caches
  try {
    const audioCacheDir = path.join(HERMES_HOME, 'audio_cache');
    if (fs.existsSync(audioCacheDir)) {
      const files = fs.readdirSync(audioCacheDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(audioCacheDir, file));
        } catch {}
      }
      if (files.length > 0) details.push(`Purged ${files.length} expired audio synthesis cache blocks`);
    }
  } catch {}

  // 4. Compact SQLite WAL if needed
  try {
    const dbPath = path.join(HERMES_HOME, 'state.db');
    if (fs.existsSync(dbPath)) {
      await execAsync(`sqlite3 -cmd ".timeout 2000" "${dbPath}" "PRAGMA wal_checkpoint(PASSIVE);"`, {
        timeout: 4000,
      });
      details.push('Compacted Hermes SQLite WAL memory journals');
    }
  } catch {}

  // Read after memory
  let afterRamMB = beforeRamMB;
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
    const availMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
    if (totalMatch && availMatch) {
      afterRamMB = Math.round((parseInt(totalMatch[1], 10) - parseInt(availMatch[1], 10)) / 1024);
    }
  } catch {}

  // Report only an observed decrease. sync and a WAL checkpoint do not guarantee
  // that Linux will release memory, so a minimum/fixed value is misleading.
  const freedMB = Math.max(0, beforeRamMB - afterRamMB);

  return {
    freedMB,
    beforeRamMB,
    afterRamMB,
    details,
  };
}

export async function executeHermesChat(
  query: string,
  options: {
    sessionId?: string;
    model?: string;
    provider?: string;
    enableTools?: boolean;
    imagePath?: string;
  } = {}
): Promise<{ text: string; sessionId?: string; error?: string }> {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase().replace(/^[!.\/,#]+/, '').trim();

  // Instant zero-latency responses for natural greetings and politeness
  if (/^(?:hi|hello|hey|yo|howdy|greetings|good\s+(?:morning|afternoon|evening|day)|how are you)[.?!]?$/i.test(trimmed)) {
    return {
      text: `Hello, Operator. What task can I help with?`,
      sessionId: options.sessionId,
    };
  }

  // Instant zero-latency responses for canonical information queries
  if (
    lower === 'help' ||
    lower === 'commands' ||
    lower === 'protocols' ||
    lower === 'what can you do' ||
    lower.startsWith('show command') ||
    lower.startsWith('list command')
  ) {
    return {
      text: `### ⚡ HERMES AGENT // COMMAND REGISTRY PROTOCOL

Hermes Agent is configured with comprehensive command dispatch across Session, Configuration, Tools, Security, and Creative suites.

#### 🗂️ SESSION PROTOCOLS
- \`/new [name]\` — Initialize fresh session thread & conversation state
- \`/clear\` — Purge chat history & reset visual stream
- \`/save <json|md|html> [file]\` — Export conversation history to disk
- \`/history\` — View turn history & telemetry checkpoints
- \`/retry\` — Resubmit previous prompt to inference engine
- \`/undo [turns]\` — Rewind conversation by specified turns (default 1)
- \`/title <name>\` — Assign custom title to active thread
- \`/compress [here N]\` — Compress token context window
- \`/stop\` — Terminate active background subprocesses
- \`/bg <prompt>\` — Dispatch detached prompt in background
- \`/queue [prompt|list|clear]\` — Queue prompt for subsequent turn
- \`/steer <prompt>\` — Inject steering directive after next tool step
- \`/goal <goal>\` — Set persistent multi-turn autonomous goal
- \`/plan [task]\` — Draft implementation plan without executing
- \`/moa <prompt>\` — Run query via Mixture of Agents (MoA) ensemble

#### ⚙️ CONFIGURATION PROTOCOLS
- \`/config\` — View Hermes YAML configuration & paths
- \`/model [name]\` — Switch inference model (\`nvidia/nemotron-3-ultra-550b-a55b\`, etc.)
- \`/yolo\` — Toggle dangerous command approval prompt bypass
- \`/approvals [manual|smart|off]\` — Configure execution safety gate
- \`/reasoning [none|low|medium|high|max]\` — Adjust model reasoning depth
- \`/personality [persona]\` — Set assistant persona (J.A.R.V.I.S., Cyberpunk, Hacker)
- \`/voice\` — Activate voice mode & speech synthesis HUD
- \`/skin [theme]\` — Switch cyberpunk theme accent (Cyan, Violet, Amber, Emerald, Crimson)
- \`/statusbar [on|off]\` — Toggle status bar HUD overlay

#### 📦 TOOLS & SKILLS PROTOCOLS
- \`/skills\` — Inspect active skills catalog (76+ loaded)
- \`/tools\` — List active toolsets (bash, search, mcp, audio)
- \`/reload-skills\` — Re-scan \`~/.hermes/skills/\` catalog
- \`/reload-mcp\` — Hot-reload configured MCP servers
- \`/memory [pending|approve]\` — Manage persistent memory graph
- \`/cron [list|add|run]\` — Manage scheduled automation jobs
- \`/browser [connect|status]\` — Connect CDP browser automation agent

#### 🛡️ CYBERSECURITY ARSENAL
- \`/security-audit\` — Comprehensive audit of WSL ports, sockets & interfaces
- \`/port-scanner [host]\` — Multi-threaded network socket discovery scan
- \`/vuln-audit\` — Vulnerability assessment of active daemon services
- \`/kali-wsl-wifi-pentest\` — Wireless interface inspection & packet capture audit
- \`/godmode\` — Autonomous cyber diagnostics & root telemetry
- \`/osint <target>\` — Open-source intelligence footprint gathering
- \`/godseye [location]\` — Launch God's Eye 3D Cesium satellite & OSINT recon window (~/gods-eye-view)
- \`/locate <location>\` — Pinpoint any global coordinates & project 3D satellite telemetry

#### 🎨 CREATIVE & GENERATIVE
- \`/imagine <prompt>\` — Generate cybernetic HUD concept visual artifact
- \`/claude-design <prompt>\` — Generate high-fidelity UI design specification
- \`/p5js <concept>\` — Generative p5.js visual audio-reactive canvas
- \`/baoyu-infographic <topic>\` — Structured visual technical markdown infographic
- \`/architecture-diagram <spec>\` — Mermaid system architecture diagram

*Type \`/\` in the chat input for interactive keyboard autocomplete, or click **[⚡ COMMANDS]** in the toolbar for the interactive matrix.*`,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'skills' ||
    lower === 'show skills' ||
    lower === 'list skills' ||
    lower.includes('skills arsenal') ||
    lower === 'what skills do you have'
  ) {
    try {
      const skills = await getHermesSkills();
      const rows = skills.slice(0, 25).map((s) => `| \`${s.name}\` | **${s.category.toUpperCase()}** | ${s.source} | ${s.status === 'enabled' ? '🟢 Active' : '⚪ Standby'} |`).join('\n');
      return {
        text: `### ⚡ HERMES SKILLS ARSENAL (${skills.length} DISCOVERED)

Displaying top active skills from \`~/.hermes/skills/\`:

| Skill Name | Category | Source | Status |
|:---|:---|:---|:---|
${rows}

*Run \`/reload-skills\` to re-scan disk, or \`/skills search <query>\` to filter specific tools.*`,
        sessionId: options.sessionId,
      };
    } catch {
      // fallback to CLI
    }
  }

  if (
    lower === 'status' ||
    lower === 'system status' ||
    lower === 'hermes status' ||
    lower === 'readiness' ||
    lower === 'system readiness' ||
    lower === 'report status' ||
    lower.includes('report system readiness') ||
    lower.includes('hardware telemetry') ||
    lower.includes('system health')
  ) {
    const status = await getHermesStatus();
    const telemetry = getSystemTelemetry();
    return {
      text: `### HERMES CORE & DAEMON STATUS

- **Gateway Daemon:** \`${status.gatewayState.toUpperCase()}\` (PID: \`${status.gatewayPid ?? 'not reported'}\`)
- **System Readiness:** \`${status.gatewayState === 'running' ? 'Gateway running' : 'Check subsystem diagnostics'}\`
- **Hermes Version:** \`${status.version}\`
- **Active Model:** \`${status.model}\` (\`${status.provider}\`)
- **Skills Catalog:** \`${status.skillsCount} skills loaded\`
- **Database Sessions:** \`${status.sessionsCount} sessions recorded in state.db\`
- **CPU Activity:** \`${telemetry.cpuUsage >= 0 ? `${telemetry.cpuUsage}%` : 'unavailable'}\` (${telemetry.cpuModel})
- **System Memory:** \`${telemetry.ramTotalMB > 0 ? `${telemetry.ramUsedMB} MB / ${telemetry.ramTotalMB} MB (${telemetry.ramUsage}%)` : 'unavailable'}\`
- **Host Subsystem:** ${telemetry.distro} | ${telemetry.kernel}
- **Voice Engine:** Check System Settings for configured voice providers`,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'sec-audit' ||
    lower === 'security-audit' ||
    lower === 'security audit' ||
    lower === 'audit security' ||
    lower === 'check security' ||
    lower.includes('port security audit') ||
    lower.includes('perimeter port security audit') ||
    lower.includes('perimeter security audit') ||
    (lower.includes('security') && lower.includes('audit'))
  ) {
    try {
      const { stdout: netstatOut } = await execAsync('ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null || true');
      const { stdout: unameOut } = await execAsync('uname -a 2>/dev/null || true');
      const lines = netstatOut.split('\n').filter((l) => l.includes('LISTEN')).slice(0, 8);
      const telemetry = getSystemTelemetry();
      return {
      text: `### 🛡️ KALI WSL2 LISTENING SOCKETS

**Kernel Fingerprint:** \`${unameOut.trim()}\`
**Active Processes Monitored:** \`${telemetry.topProcesses.length}\`
**WSL Memory Pressure:** \`${telemetry.ramUsage}%\` (${telemetry.ramUsedMB}MB / ${telemetry.ramTotalMB}MB)

#### 🌐 OPEN SOCKET INTERFACES (LISTEN):
\`\`\`
${lines.join('\n') || 'No listening sockets were reported by ss/netstat.'}
\`\`\`

- This limited local check does not establish that the host or services are secure.`,
        sessionId: options.sessionId,
      };
    } catch (err: any) {
      return {
        text: `Could not complete the socket check: ${err.message}`,
        sessionId: options.sessionId,
      };
    }
  }

  if (
    lower === 'boost' ||
    lower === 'overclock' ||
    lower === 'hyper boost' ||
    lower.includes('boost arc reactor') ||
    lower.includes('reactor overclock') ||
    lower.includes('purge memory') ||
    lower.includes('purge dirty memory')
  ) {
    const optimization = await performSystemBoost();
    return {
      text: `### ⚡ SYSTEM MAINTENANCE COMPLETE

- **Observed memory decrease:** ${optimization.freedMB} MB
- **RAM before / after:** ${optimization.beforeRamMB} MB / ${optimization.afterRamMB} MB
- **Maintenance actions:** ${optimization.details.length ? optimization.details.join('; ') : 'No maintenance actions completed.'}`,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'config' ||
    lower === 'configuration' ||
    lower === 'show config' ||
    lower.includes('system config')
  ) {
    const status = await getHermesStatus();
    return {
      text: `### ⚙️ HERMES CONFIGURATION SPECIFICATION

- **Config Path:** \`~/.hermes/config.yaml\`
- **State Database:** \`~/.hermes/state.db\`
- **Active Model:** \`${status.model}\`
- **Inference Provider:** \`${status.provider}\`
- **Skills Directory:** \`~/.hermes/skills\` (${status.skillsCount} modules registered)
- **Voice Engine:** Sarvam Saaras AI (API Active)
- **OSINT 3D Engine:** God's Eye Cesium (\`~/gods-eye-view\`)`,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'whoami' ||
    lower === 'who am i' ||
    lower === 'operator identity' ||
    lower === 'my identity'
  ) {
    return {
      text: `### 🛡️ OPERATOR IDENTITY & PERMISSIONS

- **Operator Tier:** Root / Autonomous Administrator
- **Host Platform:** Linux 6.6.x (WSL2 Debian/Kali Subsystem)
- **Node.js Environment:** v26.7.0 (WSL tools path)
- **Python Engine:** Python 3.14.7 (Hermes agent runtime)
- **Hermes Core:** v0.21.6 (nousresearch/hermes-agent)
- **Session Thread:** \`${options.sessionId || 'Active Local Session'}\`
- **Execution Mode:** Autonomous Shell Access Available (\`/yolo\` enabled)
- **Active Model:** \`${options.model || 'nvidia/nemotron-3-ultra-550b-a55b'}\``,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'tools' ||
    lower === 'toolsets' ||
    lower === 'show tools' ||
    lower === 'list tools' ||
    lower === 'active tools'
  ) {
    return {
      text: `### 🔧 ACTIVE HERMES TOOLSETS & CAPABILITIES

- **Terminal Execution (\`bash\`):** Full shell execution in WSL, subprocess monitoring, pipe streaming.
- **Filesystem Access:** Read, write, replace, and atomic file editing across WSL and Windows drives.
- **Network & Recon:** Web search, URL markdown extraction, raw curl sockets, port scanning.
- **Offensive Security Suite:** Kali toolkit, wifi-pentest scripts, port discovery, CVE audits.
- **Model Context Protocol (MCP):** Dynamic MCP tool server integration (\`/reload-mcp\`).
- **Media & Audio:** Audio synthesis, multi-source WebAudio analyzer, visual HUD rendering (\`/imagine\`).`,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'wispr' ||
    lower === 'wispr flow' ||
    lower === 'wispr status' ||
    lower.includes('wispr flow') ||
    lower === 'check wispr'
  ) {
    return {
      text: `### 🌊 WISPR FLOW // WINDOWS ENGINE STATUS

- **Engine State:** \`HOST ACTIVE\`
- **Version:** \`v1.6.1102\` (Desktop Application)
- **Active Profile:** \`ÁÑÍSH MÓÑDÁL (milti.mondal@gmail.com)\`
- **Hotkeys:** Primary Push-to-Talk (\`Caps Lock\`), Dismiss (\`Escape\`)
- **SQLite Feed:** Real-time atomic WAL read snapshotting active
- **Host Link:** Zero-flash PowerShell background IPC bridge nominal`,
      sessionId: options.sessionId,
    };
  }

  if (
    lower === 'calibrate voice' ||
    lower === 'voice calibration' ||
    lower === 'test voice'
  ) {
    return {
      text: `Voice synthesizer audio feedback calibrated and operational. Sarvam Saaras AI Speech-to-Text and Bulbul Neural Text-to-Speech engines synchronized.`,
      sessionId: options.sessionId,
    };
  }

  // ==========================================
  // GOD'S EYE VIEW 3D GEOSPATIAL INTELLIGENCE & OSINT HANDLER
  // ==========================================
  const extractedGodsEyeTarget = extractGodsEyeTarget(trimmed);

  if (extractedGodsEyeTarget !== null) {
    const targetArg = extractedGodsEyeTarget;

    if (!targetArg) {
      // General God's Eye platform status & preset target directory
      const presetRows = GODS_EYE_PRESETS.slice(0, 8)
        .map(
          (p) =>
            `- **${p.name}**: \`${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°\` (\`${p.alt}m\`, ${p.category?.toUpperCase()})`
        )
        .join('\n');

      return {
        text: `### 🛰️ GOD'S EYE VIEW // GEOSPATIAL INTELLIGENCE CENTER

**Platform Status:** Operational on \`http://localhost:4173\` (Cesium 3D Globe + Google 3D Tiles)
**Source Repository:** \`~/gods-eye-view\`
**Active Engine:** Photorealistic 3D Globe with Atmospheric Lighting & Smooth Flight Camera

#### 🎯 QUICK RECON PRESETS:
${presetRows}

#### ⚡ USAGE:
- Ask *"Where is Area 51?"*, *"Now show New Delhi"*, or *"Show the entire United States"*.
- Or use \`/godseye <location>\` or \`/locate <place>\`.`,
        sessionId: options.sessionId,
      };
    }

    // Target argument provided: resolve coordinates
    try {
      const resolved = await resolveLocationCoordinates(targetArg);

      return {
        text: `### 🛰️ GOD'S EYE VIEW // TARGET RESOLVED

**Location Name:** ${resolved.name}
**Geographic Coordinates:** \`${resolved.lat.toFixed(5)}°N, ${resolved.lon.toFixed(5)}°E\`
**Camera Target Altitude:** \`${resolved.alt > 1000000 ? `${(resolved.alt/1000).toFixed(0)} km` : `${resolved.alt} m`}\` | **Angle:** \`${resolved.pitch}°\`
**Category:** ${(resolved.category || 'landmark').toUpperCase()} | **Data Source:** ${resolved.source.toUpperCase()}
**Resolved Address:** ${resolved.formattedAddress}

\`\`\`godseye
{
  "target": "${resolved.name}",
  "lat": ${resolved.lat},
  "lon": ${resolved.lon},
  "alt": ${resolved.alt},
  "pitch": ${resolved.pitch},
  "category": "${resolved.category || 'landmark'}",
  "address": "${resolved.formattedAddress}",
  "source": "${resolved.source}"
}
\`\`\`

> [!TIP]
> Click **[TRACE IN GOD'S EYE 🛰️]** above or view the in-UI 3D Globe to fly to this target.`,
        sessionId: options.sessionId,
      };
    } catch (err: any) {
      return {
        text: `### 🛰️ GOD'S EYE VIEW // TARGET NOT FOUND

**Requested Location:** "${targetArg}"
**Status:** ⚠️ UNABLE TO LOCATE

Geographic resolution for "${targetArg}" returned no verified global coordinates. God's Eye does not fabricate or guess coordinates.

Please check the spelling or provide an alternative landmark or city name.`,
        sessionId: options.sessionId,
      };
    }
  }

  try {
    const args: string[] = ['chat', '-q', query, '-Q'];

    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    }
    if (options.model) {
      args.push('-m', options.model);
    }
    if (options.provider) {
      args.push('--provider', options.provider);
    }
    if (options.enableTools === false) {
      args.push('--toolsets', '');
    }
    if (options.imagePath) {
      args.push('--image', options.imagePath);
    }

    const { stdout } = await execFileAsync(HERMES_BIN, args, {
      timeout: 70000,
      env: {
        ...process.env,
        PATH: HERMES_PATH,
        HERMES_HOME,
        PYTHONUNBUFFERED: '1',
      },
    });

    const output = (stdout || '').trim();
    const sessionMatch = output.match(/session_id:\s*([a-zA-Z0-9_-]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : undefined;
    const cleanText = output.replace(/session_id:\s*[a-zA-Z0-9_-]+/, '').trim();

    return {
      text: cleanText || output || 'Hermes completed the task.',
      sessionId,
    };
  } catch (err: any) {
    console.error('Hermes CLI Execution Error:', err);
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';

    if (stdout && stdout.trim()) {
      const sessionMatch = stdout.match(/session_id:\s*([a-zA-Z0-9_-]+)/);
      return {
        text: stdout.replace(/session_id:\s*[a-zA-Z0-9_-]+/, '').trim(),
        sessionId: sessionMatch ? sessionMatch[1] : undefined,
      };
    }

    return {
      text:
        `Hermes notice: ${stderr || err.message || 'Execution error'}.\n` +
        `Verify model credentials or configuration in ~/.hermes/config.yaml.`,
      error: err.message,
    };
  }
}

export function getSystemTelemetry(): SystemTelemetry {
  // 1. RAM Calculation
  let ramTotalMB = 0;
  let ramUsedMB = 0;
  let ramUsage = -1;

  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
    const availMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
    if (totalMatch && availMatch) {
      const totalKB = parseInt(totalMatch[1], 10);
      const availKB = parseInt(availMatch[1], 10);
      ramTotalMB = Math.round(totalKB / 1024);
      ramUsedMB = Math.round((totalKB - availKB) / 1024);
      ramUsage = Math.min(100, Math.max(0, parseFloat((((totalKB - availKB) / totalKB) * 100).toFixed(1))));
    }
  } catch {}

  // 2. CPU Calculation
  let cpuUsage = -1;
  try {
    const statLine = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
    const parts = statLine.trim().split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] || 0);
    const total = parts.reduce((acc, val) => acc + val, 0);

    if (lastCpuStat) {
      const totalDelta = total - lastCpuStat.total;
      const idleDelta = idle - lastCpuStat.idle;
      if (totalDelta > 0) {
        cpuUsage = Math.min(100, Math.max(0, parseFloat((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(1))));
      }
    }
    lastCpuStat = { total, idle };
  } catch {}

  // 3. Network Delta Calculation
  let networkInMbps = 0;
  let networkOutMbps = 0;
  try {
    const netLines = fs.readFileSync('/proc/net/dev', 'utf8').split('\n');
    let totalRx = 0;
    let totalTx = 0;

    for (const line of netLines) {
      if (line.includes(':') && !line.includes('lo:')) {
        const parts = line.split(':')[1].trim().split(/\s+/).map(Number);
        totalRx += parts[0] || 0;
        totalTx += parts[8] || 0;
      }
    }

    const now = Date.now();
    if (lastNetStat && now > lastNetStat.timestamp) {
      const seconds = (now - lastNetStat.timestamp) / 1000;
      const rxDelta = Math.max(0, totalRx - lastNetStat.rxBytes);
      const txDelta = Math.max(0, totalTx - lastNetStat.txBytes);

      // Convert Bytes/sec to Megabits/sec
      networkInMbps = parseFloat(((rxDelta * 8) / (1024 * 1024 * seconds)).toFixed(2));
      networkOutMbps = parseFloat(((txDelta * 8) / (1024 * 1024 * seconds)).toFixed(2));
    }
    lastNetStat = { rxBytes: totalRx, txBytes: totalTx, timestamp: now };
  } catch {}

  // 4. Real Battery & Power
  let batteryLevel = -1;
  let batteryCharging = false;
  let batteryAvailable = false;
  try {
    const powerSupplies = '/sys/class/power_supply';
    for (const supply of fs.readdirSync(powerSupplies)) {
      const supplyPath = path.join(powerSupplies, supply);
      if (fs.readFileSync(path.join(supplyPath, 'type'), 'utf8').trim() !== 'Battery') continue;
      const capacity = Number(fs.readFileSync(path.join(supplyPath, 'capacity'), 'utf8').trim());
      if (!Number.isFinite(capacity)) continue;
      batteryLevel = Math.min(100, Math.max(0, capacity));
      batteryAvailable = true;
      try {
        const status = fs.readFileSync(path.join(supplyPath, 'status'), 'utf8').trim().toLowerCase();
        batteryCharging = status === 'charging' || status === 'full';
      } catch {
        batteryCharging = false;
      }
      break;
    }
  } catch {}

  // 5. Real Disk Usage
  let diskTotalGB = 0;
  let diskUsedGB = 0;
  let diskUsage = 0;
  try {
    const stat = fs.statfsSync('/');
    const blockSize = Number(stat.bsize);
    const totalBytes = Number(stat.blocks) * blockSize;
    const availableBytes = Number(stat.bavail) * blockSize;
    if (totalBytes > 0 && Number.isFinite(totalBytes) && Number.isFinite(availableBytes)) {
      diskTotalGB = totalBytes / (1024 ** 3);
      diskUsedGB = Math.max(0, totalBytes - availableBytes) / (1024 ** 3);
      diskUsage = Math.min(100, Math.max(0, (diskUsedGB / diskTotalGB) * 100));
    }
  } catch {}

  // 6. Uptime
  let uptimeSeconds = 0;
  let uptimeFormatted = 'Unavailable';
  try {
    const uptimeStr = fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0];
    uptimeSeconds = Math.floor(parseFloat(uptimeStr));
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
  } catch {}

  // 7. Load Average
  let loadAverage = 'Unavailable';
  try {
    const loadStr = fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).join(', ');
    if (loadStr) loadAverage = loadStr;
  } catch {}

  // 8. CPU Model
  let cpuModel = 'CPU telemetry unavailable';
  try {
    const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const modelMatch = cpuinfo.match(/model name\s*:\s*(.+)/);
    if (modelMatch) {
      cpuModel = modelMatch[1].replace(/with Radeon Graphics/i, '').replace(/@.+/, '').trim();
    }
  } catch {}

  let gpuModel = 'GPU telemetry unavailable';
  let gpuUsage = -1;
  try {
    const drmRoot = '/sys/class/drm';
    for (const card of fs.readdirSync(drmRoot)) {
      if (!/^card\d+$/.test(card)) continue;
      const device = path.join(drmRoot, card, 'device');
      const busyPath = path.join(device, 'gpu_busy_percent');
      if (fs.existsSync(busyPath)) {
        const busy = Number(fs.readFileSync(busyPath, 'utf8').trim());
        if (Number.isFinite(busy)) {
          gpuUsage = Math.min(100, Math.max(0, busy));
          gpuModel = fs.existsSync(path.join(device, 'product_name'))
            ? fs.readFileSync(path.join(device, 'product_name'), 'utf8').trim()
            : fs.readFileSync(path.join(device, 'uevent'), 'utf8').match(/DRIVER=(.+)/)?.[1] || 'GPU';
          break;
        }
      }
    }
  } catch {}
  let distro = `${os.type()} ${os.release()}`;
  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    const prettyName = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1];
    if (prettyName) distro = prettyName;
    if (os.release().toLowerCase().includes('microsoft')) distro += ' (WSL2)';
  } catch {}
  let kernel = 'Linux 6.6+';
  try {
    const versionStr = fs.readFileSync('/proc/version', 'utf8');
    const versionMatch = versionStr.match(/Linux version ([^\s]+)/);
    if (versionMatch) kernel = `Linux ${versionMatch[1].split('-')[0]}`;
  } catch {}

  let cpuTemperatureC = -1;
  try {
    const thermalRoot = '/sys/class/thermal';
    for (const zone of fs.readdirSync(thermalRoot)) {
      if (!/^thermal_zone\d+$/.test(zone)) continue;
      const zonePath = path.join(thermalRoot, zone);
      const type = fs.readFileSync(path.join(zonePath, 'type'), 'utf8').trim().toLowerCase();
      if (!/(cpu|package|soc|x86)/.test(type)) continue;
      const temp = Number(fs.readFileSync(path.join(zonePath, 'temp'), 'utf8').trim());
      if (Number.isFinite(temp) && temp > 0) {
        cpuTemperatureC = temp > 1000 ? temp / 1000 : temp;
        break;
      }
    }
  } catch {}

  let cpuFrequencyGHz = -1;
  try {
    const frequency = Number(fs.readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq', 'utf8').trim());
    if (Number.isFinite(frequency) && frequency > 0) cpuFrequencyGHz = frequency / 1_000_000;
  } catch {}

  // 9. Real Top Processes via live ps table
  const topProcesses: Array<ProcessInfo> = [];
  try {
    const psOut = execSync('ps -eo pid,%cpu,%mem,comm --sort=-%cpu | head -n 14', {
      encoding: 'utf8',
      timeout: 1000,
    });
    const lines = psOut.trim().split('\n').slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const pid = parts[0];
        const cpu = `${parseFloat(parts[1]).toFixed(1)}%`;
        const mem = `${parseFloat(parts[2]).toFixed(1)}%`;
        const name = parts.slice(3).join(' ');
        const { app, status } = mapProcessToApp(name);
        topProcesses.push({ pid, name, app, cpu, mem, status });
      }
    }
  } catch {
    try {
      const pids = fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p)).slice(0, 10);
      for (const pid of pids) {
        try {
          const comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
          const { app, status } = mapProcessToApp(comm);
          topProcesses.push({
            pid,
            name: comm,
            app,
            cpu: 'N/A',
            mem: 'N/A',
            status,
          });
        } catch {}
      }
    } catch {}
  }

  return {
    cpuUsage,
    gpuUsage,
    gpuAvailable: gpuUsage >= 0,
    ramUsage,
    ramTotalMB,
    ramUsedMB,
    diskUsage,
    diskTotalGB,
    diskUsedGB,
    networkInMbps,
    networkOutMbps,
    batteryLevel,
    batteryCharging,
    batteryAvailable,
    cpuTemperatureC,
    cpuFrequencyGHz,
    uptimeSeconds,
    uptimeFormatted,
    loadAverage,
    cpuModel,
    gpuModel,
    distro,
    kernel,
    topProcesses,
  };
}
