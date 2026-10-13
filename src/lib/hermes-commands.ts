/**
 * Hermes Agent Unified Slash Commands Registry
 * Complete canonical catalog of all Hermes Agent commands, tools, skills, and HUD protocols.
 */

export type CommandCategory =
  | 'Session'
  | 'Configuration'
  | 'Tools & Skills'
  | 'Security & Cyber'
  | 'Creative'
  | 'Info & Telemetry';

export interface HermesCommand {
  name: string; // canonical name without slash, e.g. "status"
  command: string; // full slash format, e.g. "/status"
  description: string;
  category: CommandCategory;
  aliases?: string[];
  argsHint?: string;
  subcommands?: string[];
  example?: string;
  isClientAction?: boolean; // Handled client-side directly
  clientActionKey?: 'clear' | 'new' | 'palette' | 'config' | 'settings' | 'terminal' | 'voice' | 'yolo' | 'godseye';
  icon?: string;
  tag?: string;
}

export const HERMES_COMMANDS: HermesCommand[] = [
  // ==========================================
  // SESSION COMMANDS
  // ==========================================
  {
    name: 'new',
    command: '/new',
    description: 'Start a new session with fresh session ID and history',
    category: 'Session',
    aliases: ['reset'],
    argsHint: '[name]',
    example: '/new cybersecurity-investigation',
    isClientAction: true,
    clientActionKey: 'new',
    icon: 'PlusCircle',
    tag: 'CORE',
  },
  {
    name: 'clear',
    command: '/clear',
    description: 'Clear chat screen and reset visual stream',
    category: 'Session',
    example: '/clear',
    isClientAction: true,
    clientActionKey: 'clear',
    icon: 'RotateCcw',
    tag: 'UI',
  },
  {
    name: 'save',
    command: '/save',
    description: 'Export the current conversation to file',
    category: 'Session',
    argsHint: '<json|md|html> [filename]',
    example: '/save md session_report.md',
    icon: 'Save',
    tag: 'EXPORT',
  },
  {
    name: 'history',
    command: '/history',
    description: 'Show conversation turn history and message logs',
    category: 'Session',
    example: '/history',
    icon: 'History',
  },
  {
    name: 'retry',
    command: '/retry',
    description: 'Retry the last prompt and resend to Hermes Agent',
    category: 'Session',
    example: '/retry',
    icon: 'RefreshCw',
  },
  {
    name: 'undo',
    command: '/undo',
    description: 'Back up N turns and rewind context (default 1)',
    category: 'Session',
    argsHint: '[turns]',
    example: '/undo 1',
    icon: 'Undo',
  },
  {
    name: 'title',
    command: '/title',
    description: 'Set a custom title for the current session thread',
    category: 'Session',
    argsHint: '<name>',
    example: '/title Kali Linux Recon Task',
    icon: 'Type',
  },
  {
    name: 'compress',
    command: '/compress',
    description: 'Compress conversation context window to reduce tokens',
    category: 'Session',
    aliases: ['compact'],
    argsHint: '[here N | focus topic | --preview]',
    example: '/compress here 5',
    icon: 'Minimize2',
    tag: 'TOKEN',
  },
  {
    name: 'stop',
    command: '/stop',
    description: 'Kill active running background tasks and abort inference',
    category: 'Session',
    example: '/stop',
    icon: 'Octagon',
    tag: 'ABORT',
  },
  {
    name: 'bg',
    command: '/bg',
    description: 'Run a prompt in a detached background session',
    category: 'Session',
    argsHint: '<prompt>',
    example: '/bg Run nmap port discovery on 127.0.0.1 in background',
    icon: 'Layers',
  },
  {
    name: 'btw',
    command: '/btw',
    description: 'Ask a side question without interrupting main session state',
    category: 'Session',
    argsHint: '<question>',
    example: '/btw What was the port number found previously?',
    icon: 'HelpCircle',
  },
  {
    name: 'queue',
    command: '/queue',
    description: 'Queue a prompt for the next turn, or list/clear queued prompts',
    category: 'Session',
    aliases: ['q'],
    argsHint: '[<prompt>|list|edit N|rm N|clear]',
    subcommands: ['list', 'edit', 'rm', 'move', 'clear', 'add'],
    example: '/queue list',
    icon: 'ListOrdered',
  },
  {
    name: 'steer',
    command: '/steer',
    description: 'Inject guidance message after the current tool step',
    category: 'Session',
    aliases: ['s'],
    argsHint: '<prompt>',
    example: '/steer Prioritize checking open SSH sockets first',
    icon: 'Compass',
  },
  {
    name: 'goal',
    command: '/goal',
    description: 'Set a standing multi-turn goal Hermes pursues until achieved',
    category: 'Session',
    argsHint: '[text | show | pause | resume | clear]',
    subcommands: ['show', 'pause', 'resume', 'clear'],
    example: '/goal Audit all running WSL services and secure permissions',
    icon: 'Target',
    tag: 'AUTONOMOUS',
  },
  {
    name: 'subgoal',
    command: '/subgoal',
    description: 'Add or manage extra verification criteria on the active goal',
    category: 'Session',
    argsHint: '[text | remove N | clear]',
    example: '/subgoal Verify port 22 key authentication only',
    icon: 'CheckSquare',
  },
  {
    name: 'heartbeat',
    command: '/heartbeat',
    description: 'Set a recurring prompt that re-enters session when idle',
    category: 'Session',
    aliases: ['hb'],
    argsHint: '[every <interval> <prompt> | status | pause | resume | clear]',
    subcommands: ['status', 'pause', 'resume', 'clear'],
    example: '/heartbeat status',
    icon: 'Activity',
  },
  {
    name: 'loop',
    command: '/loop',
    description: 'Re-run a prompt on a recurring interval in this session',
    category: 'Session',
    aliases: ['proactive'],
    argsHint: '[interval] <prompt> [--times N]',
    example: '/loop 5m check gateway status',
    icon: 'Repeat',
  },
  {
    name: 'plan',
    command: '/plan',
    description: 'Generate a markdown architectural implementation plan without executing',
    category: 'Session',
    argsHint: '[task]',
    example: '/plan Build automated vulnerability scanner script',
    icon: 'FileText',
  },
  {
    name: 'review',
    command: '/review',
    description: 'Spawn an independent subagent to review work (PR, code, docs)',
    category: 'Session',
    argsHint: '[instructions]',
    example: '/review Check socket error handling in script',
    icon: 'CheckCheck',
  },
  {
    name: 'refine',
    command: '/refine',
    description: 'Review conversation and persist lessons to memory and skills',
    category: 'Session',
    argsHint: '[focus instructions]',
    example: '/refine Remember user prefers Orbitron cyberpunk theme',
    icon: 'Bookmark',
  },
  {
    name: 'branch',
    command: '/branch',
    description: 'Branch current session into a new conversation lineage',
    category: 'Session',
    aliases: ['fork'],
    argsHint: '[name]',
    example: '/branch pentest-alternative-approach',
    icon: 'GitBranch',
  },
  {
    name: 'resume',
    command: '/resume',
    description: 'Resume a previous session by ID or name',
    category: 'Session',
    argsHint: '<id|name>',
    example: '/resume latest',
    icon: 'PlayCircle',
  },
  {
    name: 'sessions',
    command: '/sessions',
    description: 'Browse, search, and switch between past Hermes sessions',
    category: 'Session',
    example: '/sessions',
    icon: 'FolderKanban',
  },
  {
    name: 'moa',
    command: '/moa',
    description: 'Run prompt through Mixture of Agents (MoA) ensemble',
    category: 'Session',
    argsHint: '<prompt>',
    example: '/moa Compare architecture tradeoffs between gRPC and WebSocket',
    icon: 'Cpu',
    tag: 'ENSEMBLE',
  },

  // ==========================================
  // CONFIGURATION COMMANDS
  // ==========================================
  {
    name: 'config',
    command: '/config',
    description: 'Inspect Hermes YAML configuration, paths, and environment settings',
    category: 'Configuration',
    example: '/config',
    isClientAction: true,
    clientActionKey: 'config',
    icon: 'Settings',
    tag: 'SETTINGS',
  },
  {
    name: 'model',
    command: '/model',
    description: 'Switch inference model (nemotron-3, claude-3-7-sonnet, gpt-4o, etc.)',
    category: 'Configuration',
    argsHint: '[name] [--provider name] [--reasoning level]',
    example: '/model nvidia/nemotron-3-ultra-550b-a55b',
    icon: 'Brain',
    tag: 'LLM',
  },
  {
    name: 'yolo',
    command: '/yolo',
    description: 'Toggle YOLO mode (skip all dangerous shell command approvals)',
    category: 'Configuration',
    example: '/yolo',
    isClientAction: true,
    clientActionKey: 'yolo',
    icon: 'Zap',
    tag: 'AUTONOMY',
  },
  {
    name: 'approvals',
    command: '/approvals',
    description: 'Show or set the dangerous-command approval security policy',
    category: 'Configuration',
    argsHint: '[manual|smart|off]',
    subcommands: ['manual', 'smart', 'off'],
    example: '/approvals smart',
    icon: 'ShieldAlert',
  },
  {
    name: 'reasoning',
    command: '/reasoning',
    description: 'Configure model reasoning depth / thinking effort',
    category: 'Configuration',
    argsHint: '[none|minimal|low|medium|high|xhigh|max|ultra]',
    subcommands: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
    example: '/reasoning high',
    icon: 'Sparkles',
  },
  {
    name: 'fast',
    command: '/fast',
    description: 'Toggle fast inference / priority processing mode',
    category: 'Configuration',
    argsHint: '[normal|fast|auto|cold|status]',
    subcommands: ['normal', 'fast', 'auto', 'cold', 'status'],
    example: '/fast fast',
    icon: 'Gauge',
  },
  {
    name: 'personality',
    command: '/personality',
    description: 'Set assistant tone and persona (JARVIS, Cyberpunk, Hacker)',
    category: 'Configuration',
    argsHint: '[name]',
    example: '/personality J.A.R.V.I.S.',
    icon: 'UserCheck',
  },
  {
    name: 'skin',
    command: '/skin',
    description: 'Switch cyberpunk theme accent (Cyan, Neon Violet, Amber, Emerald, Crimson)',
    category: 'Configuration',
    argsHint: '[name]',
    example: '/skin stark-cyan',
    icon: 'Palette',
  },
  {
    name: 'indicator',
    command: '/indicator',
    description: 'Configure HUD audio/visual processing indicator style',
    category: 'Configuration',
    argsHint: '[pulse|orb|matrix|radar]',
    subcommands: ['pulse', 'orb', 'matrix', 'radar'],
    example: '/indicator pulse',
    icon: 'Radio',
  },
  {
    name: 'statusbar',
    command: '/statusbar',
    description: 'Toggle the system HUD telemetry status bar',
    category: 'Configuration',
    aliases: ['sb'],
    argsHint: '[on|off]',
    subcommands: ['on', 'off'],
    example: '/statusbar on',
    icon: 'Layout',
  },
  {
    name: 'battery',
    command: '/battery',
    description: 'Toggle system power and battery indicator telemetry',
    category: 'Configuration',
    argsHint: '[on|off|status]',
    subcommands: ['on', 'off', 'status'],
    example: '/battery status',
    icon: 'BatteryCharging',
  },
  {
    name: 'timestamps',
    command: '/timestamps',
    description: 'Toggle [HH:MM] timestamps on messages in chat stream',
    category: 'Configuration',
    aliases: ['ts'],
    argsHint: '[on|off|status]',
    subcommands: ['on', 'off', 'status'],
    example: '/timestamps on',
    icon: 'Clock',
  },
  {
    name: 'verbose',
    command: '/verbose',
    description: 'Cycle verbose tool execution progress logging',
    category: 'Configuration',
    example: '/verbose',
    icon: 'Eye',
  },
  {
    name: 'voice',
    command: '/voice',
    description: 'Launch Jarvis Voice HUD and speech synthesis',
    category: 'Configuration',
    argsHint: '[on|off|tts|status]',
    subcommands: ['on', 'off', 'tts', 'status'],
    example: '/voice',
    isClientAction: true,
    clientActionKey: 'voice',
    icon: 'Mic',
  },
  {
    name: 'wake',
    command: '/wake',
    description: "Toggle the 'Hey Hermes' wake-word background listener",
    category: 'Configuration',
    argsHint: '[on|off|status]',
    subcommands: ['on', 'off', 'status'],
    example: '/wake on',
    icon: 'Volume2',
  },
  {
    name: 'codex-runtime',
    command: '/codex-runtime',
    description: 'Toggle OpenAI Codex app-server runtime environment',
    category: 'Configuration',
    aliases: ['codex_runtime'],
    argsHint: '[auto|codex_app_server]',
    example: '/codex-runtime auto',
    icon: 'Terminal',
  },

  // ==========================================
  // TOOLS & SKILLS
  // ==========================================
  {
    name: 'skills',
    command: '/skills',
    description: 'Search, inspect, install, and manage Hermes skills',
    category: 'Tools & Skills',
    argsHint: '[search|browse|inspect|install|pending]',
    subcommands: ['search', 'browse', 'inspect', 'install', 'audit', 'pending'],
    example: '/skills',
    icon: 'Boxes',
    tag: 'ARSENAL',
  },
  {
    name: 'tools',
    command: '/tools',
    description: 'Inspect active tool capabilities: bash, web, files, mcp',
    category: 'Tools & Skills',
    argsHint: '[list|disable|enable] [name...]',
    subcommands: ['list', 'disable', 'enable'],
    example: '/tools list',
    icon: 'Wrench',
  },
  {
    name: 'toolsets',
    command: '/toolsets',
    description: 'List available tool bundles and execution permissions',
    category: 'Tools & Skills',
    example: '/toolsets',
    icon: 'Package',
  },
  {
    name: 'reload-skills',
    command: '/reload-skills',
    description: 'Re-scan ~/.hermes/skills/ for newly installed or modified skills',
    category: 'Tools & Skills',
    aliases: ['reload_skills'],
    example: '/reload-skills',
    icon: 'RefreshCw',
    tag: 'RELOAD',
  },
  {
    name: 'reload-mcp',
    command: '/reload-mcp',
    description: 'Hot-reload configured MCP servers without rebooting gateway',
    category: 'Tools & Skills',
    aliases: ['reload_mcp'],
    example: '/reload-mcp',
    icon: 'Server',
    tag: 'MCP',
  },
  {
    name: 'reload',
    command: '/reload',
    description: 'Reload .env environment variables into the running session',
    category: 'Tools & Skills',
    example: '/reload',
    icon: 'Key',
  },
  {
    name: 'memory',
    command: '/memory',
    description: 'Review long-term memory graph, user facts, and pending writes',
    category: 'Tools & Skills',
    argsHint: '[pending|approve|reject|approval] [id]',
    subcommands: ['pending', 'approve', 'reject', 'approval'],
    example: '/memory pending',
    icon: 'Database',
  },
  {
    name: 'bundles',
    command: '/bundles',
    description: 'List skill bundles (composite aliases for multiple skills)',
    category: 'Tools & Skills',
    example: '/bundles',
    icon: 'Layers',
  },
  {
    name: 'learn',
    command: '/learn',
    description: 'Learn a reusable skill from files, directories, URLs, or notes',
    category: 'Tools & Skills',
    argsHint: '<what to learn from>',
    example: '/learn Extract best practices from our Next.js codebase',
    icon: 'GraduationCap',
  },
  {
    name: 'init',
    command: '/init',
    description: 'Generate or update AGENTS.md instructions from repository scan',
    category: 'Tools & Skills',
    argsHint: '[notes]',
    example: '/init Scan project architecture and tools',
    icon: 'FileCode',
  },
  {
    name: 'cron',
    command: '/cron',
    description: 'Manage background scheduled automation routines and jobs',
    category: 'Tools & Skills',
    argsHint: '[list|add|pause|resume|run|remove]',
    subcommands: ['list', 'add', 'create', 'pause', 'resume', 'run', 'remove'],
    example: '/cron list',
    icon: 'Calendar',
  },
  {
    name: 'suggestions',
    command: '/suggestions',
    description: 'Review proactive automation suggestions from agent execution',
    category: 'Tools & Skills',
    aliases: ['suggest'],
    argsHint: '[accept|dismiss N | catalog]',
    subcommands: ['accept', 'dismiss', 'catalog', 'clear'],
    example: '/suggestions catalog',
    icon: 'Lightbulb',
  },
  {
    name: 'blueprint',
    command: '/blueprint',
    description: 'Deploy an automation pipeline from standard blueprint template',
    category: 'Tools & Skills',
    aliases: ['bp'],
    argsHint: '[name]',
    example: '/blueprint daily-security-audit',
    icon: 'FileStack',
  },
  {
    name: 'curator',
    command: '/curator',
    description: 'Run background hygiene, deduplication, and skill maintenance',
    category: 'Tools & Skills',
    argsHint: '[status|run|pin|archive]',
    subcommands: ['status', 'run', 'pause', 'resume', 'pin', 'archive'],
    example: '/curator status',
    icon: 'Sliders',
  },
  {
    name: 'kanban',
    command: '/kanban',
    description: 'Multi-agent project collaboration board and task assignments',
    category: 'Tools & Skills',
    argsHint: '[boards|create|list|assign|complete|stats]',
    subcommands: ['boards', 'create', 'list', 'assign', 'complete', 'stats'],
    example: '/kanban list',
    icon: 'Columns',
  },
  {
    name: 'browser',
    command: '/browser',
    description: 'Connect CDP browser automation tools or browser-use agent',
    category: 'Tools & Skills',
    argsHint: '[connect|disconnect|status|use]',
    subcommands: ['connect', 'disconnect', 'status', 'use'],
    example: '/browser status',
    icon: 'Globe',
  },
  {
    name: 'plugins',
    command: '/plugins',
    description: 'List installed plugins, extensions, and their runtime status',
    category: 'Tools & Skills',
    example: '/plugins',
    icon: 'Plug',
  },

  // ==========================================
  // SECURITY & CYBER (SPECIALIZED SKILLS)
  // ==========================================
  {
    name: 'security-audit',
    command: '/security-audit',
    description: 'Perform a comprehensive security scan of WSL system, ports & sockets',
    category: 'Security & Cyber',
    example: '/security-audit',
    icon: 'Shield',
    tag: 'SEC',
  },
  {
    name: 'port-scanner',
    command: '/port-scanner',
    description: 'Fast multi-threaded network socket and port discovery scan',
    category: 'Security & Cyber',
    argsHint: '[host] [--ports range]',
    example: '/port-scanner 127.0.0.1 --ports 1-10000',
    icon: 'Crosshair',
    tag: 'SCAN',
  },
  {
    name: 'vuln-audit',
    command: '/vuln-audit',
    description: 'Audit network interface vulnerabilities and open daemon services',
    category: 'Security & Cyber',
    example: '/vuln-audit',
    icon: 'AlertTriangle',
    tag: 'AUDIT',
  },
  {
    name: 'kali-wsl-wifi-pentest',
    command: '/kali-wsl-wifi-pentest',
    description: 'Kali Linux wireless interface inspection and packet audit protocol',
    category: 'Security & Cyber',
    example: '/kali-wsl-wifi-pentest',
    icon: 'Wifi',
    tag: 'KALI',
  },
  {
    name: 'godmode',
    command: '/godmode',
    description: 'Autonomous cyber defense mode with deep root diagnostics and telemetry',
    category: 'Security & Cyber',
    example: '/godmode',
    icon: 'Flame',
    tag: 'ROOT',
  },
  {
    name: 'osint',
    command: '/osint',
    description: 'Open source intelligence gathering and domain recon toolkit',
    category: 'Security & Cyber',
    argsHint: '<target>',
    example: '/osint example.com',
    icon: 'Search',
    tag: 'RECON',
  },
  {
    name: 'godseye',
    command: '/godseye',
    description: "Launch God's Eye 3D Cesium geospatial recon satellite and OSINT telemetry window (~/gods-eye-view)",
    category: 'Security & Cyber',
    aliases: ['geoview', 'satellite', 'osint-geo'],
    argsHint: '[location | target]',
    example: '/godseye Taiwan Strait',
    isClientAction: true,
    clientActionKey: 'godseye',
    icon: 'Globe',
    tag: 'SATELLITE',
  },
  {
    name: 'locate',
    command: '/locate',
    description: "Pinpoint any geographical location and open 3D God's Eye satellite window with OSINT telemetry",
    category: 'Security & Cyber',
    aliases: ['whereis', 'coordinates'],
    argsHint: '<location>',
    example: '/locate Area 51',
    isClientAction: true,
    clientActionKey: 'godseye',
    icon: 'MapPin',
    tag: 'GEO',
  },

  // ==========================================
  // CREATIVE & GENERATIVE
  // ==========================================
  {
    name: 'imagine',
    command: '/imagine',
    description: 'Generate high-definition cybernetic holographic visual concept',
    category: 'Creative',
    argsHint: '<prompt>',
    example: '/imagine futuristic neon HUD schematic with glowing cyan nodes',
    icon: 'Sparkles',
    tag: 'IMAGE',
  },
  {
    name: 'claude-design',
    command: '/claude-design',
    description: 'Generate professional UI/UX specification and component designs',
    category: 'Creative',
    argsHint: '<prompt>',
    example: '/claude-design Cyberpunk telemetry HUD panel in Tailwind CSS',
    icon: 'LayoutTemplate',
  },
  {
    name: 'p5js',
    command: '/p5js',
    description: 'Interactive generative p5.js canvas visual animation script',
    category: 'Creative',
    argsHint: '<concept>',
    example: '/p5js audio-reactive cybernetic waveform circular oscilloscope',
    icon: 'Activity',
  },
  {
    name: 'baoyu-infographic',
    command: '/baoyu-infographic',
    description: 'Generate structured technical visual markdown infographic',
    category: 'Creative',
    argsHint: '<topic>',
    example: '/baoyu-infographic Hermes Agent architecture and gateway flow',
    icon: 'FileBarChart',
  },
  {
    name: 'architecture-diagram',
    command: '/architecture-diagram',
    description: 'Generate Mermaid architecture diagrams of system pipelines',
    category: 'Creative',
    argsHint: '<spec>',
    example: '/architecture-diagram WSL to Windows audio bridge architecture',
    icon: 'Network',
  },
  {
    name: 'manim-video',
    command: '/manim-video',
    description: 'Generate programmatic 3Blue1Brown-style mathematical animation script',
    category: 'Creative',
    argsHint: '<concept>',
    example: '/manim-video Fast Fourier Transform visualization',
    icon: 'Film',
  },
  {
    name: 'ascii-video',
    command: '/ascii-video',
    description: 'Generate stylized retro cybernetic ASCII art terminal animation',
    category: 'Creative',
    argsHint: '<prompt>',
    example: '/ascii-video spinning holographic wireframe cube',
    icon: 'Terminal',
  },

  // ==========================================
  // INFO & TELEMETRY
  // ==========================================
  {
    name: 'status',
    command: '/status',
    description: 'Display session status, active model, token gauge, and health matrix',
    category: 'Info & Telemetry',
    example: '/status',
    icon: 'Activity',
    tag: 'STATUS',
  },
  {
    name: 'context',
    command: '/context',
    description: 'Context window utilization breakdown, tokens, and compression stats',
    category: 'Info & Telemetry',
    aliases: ['ctx'],
    argsHint: '[all]',
    example: '/context',
    icon: 'PieChart',
    tag: 'GAUGE',
  },
  {
    name: 'whoami',
    command: '/whoami',
    description: 'Show operator identity, security privileges, and execution tier',
    category: 'Info & Telemetry',
    example: '/whoami',
    icon: 'User',
    tag: 'AUTH',
  },
  {
    name: 'profile',
    command: '/profile',
    description: 'Show active Hermes profile name, configuration, and home path',
    category: 'Info & Telemetry',
    example: '/profile',
    icon: 'Folder',
  },
  {
    name: 'usage',
    command: '/usage',
    description: 'Display token consumption, API calls, and estimated usage costs',
    category: 'Info & Telemetry',
    example: '/usage',
    icon: 'CreditCard',
  },
  {
    name: 'platforms',
    command: '/platforms',
    description: 'Display Hermes messaging gateway status (Telegram, WhatsApp)',
    category: 'Info & Telemetry',
    aliases: ['gateway'],
    example: '/platforms',
    icon: 'Share2',
  },
  {
    name: 'diff',
    command: '/diff',
    description: 'Show git changes in current workspace directory',
    category: 'Info & Telemetry',
    argsHint: '[staged|all|session]',
    subcommands: ['staged', 'all', 'session'],
    example: '/diff --stat',
    icon: 'GitCompare',
  },
  {
    name: 'insights',
    command: '/insights',
    description: 'Display system telemetry analytics and historical trends',
    category: 'Info & Telemetry',
    argsHint: '[days]',
    example: '/insights 7',
    icon: 'BarChart2',
  },
  {
    name: 'egress',
    command: '/egress',
    description: 'Show Docker egress proxy and outbound network routing status',
    category: 'Info & Telemetry',
    example: '/egress',
    icon: 'ShieldCheck',
  },
  {
    name: 'version',
    command: '/version',
    description: 'Show Hermes core version, engine build, and CLI hash',
    category: 'Info & Telemetry',
    aliases: ['v'],
    example: '/version',
    icon: 'Info',
  },
  {
    name: 'palette',
    command: '/palette',
    description: 'Open the Stark J.A.R.V.I.S. Command & Protocol Palette [Ctrl+K]',
    category: 'Info & Telemetry',
    example: '/palette',
    isClientAction: true,
    clientActionKey: 'palette',
    icon: 'Search',
    tag: 'CTRL+K',
  },
  {
    name: 'terminal',
    command: '/terminal',
    description: 'Open the embedded WSL Linux bash terminal drawer',
    category: 'Info & Telemetry',
    example: '/terminal',
    isClientAction: true,
    clientActionKey: 'terminal',
    icon: 'Terminal',
    tag: 'CLI',
  },
  {
    name: 'help',
    command: '/help',
    description: 'Display full interactive command index, categories, and syntax guide',
    category: 'Info & Telemetry',
    argsHint: '[filter|skills|tools|session]',
    example: '/help',
    icon: 'BookOpen',
    tag: 'HELP',
  },
];

// Quick lookup mapping for exact or alias matches
const COMMAND_LOOKUP = new Map<string, HermesCommand>();
for (const cmd of HERMES_COMMANDS) {
  COMMAND_LOOKUP.set(cmd.name.toLowerCase(), cmd);
  COMMAND_LOOKUP.set(cmd.command.toLowerCase(), cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      COMMAND_LOOKUP.set(alias.toLowerCase(), cmd);
      COMMAND_LOOKUP.set(`/${alias.toLowerCase()}`, cmd);
    }
  }
}

/**
 * Find commands matching a search query (by command name, alias, description, or category).
 */
export function searchHermesCommands(query: string, maxResults = 12): HermesCommand[] {
  const clean = query.trim().toLowerCase().replace(/^\//, '');
  if (!clean) return HERMES_COMMANDS.slice(0, maxResults);

  // Exact prefix matches on command name first
  const prefixMatches: HermesCommand[] = [];
  const otherMatches: HermesCommand[] = [];

  for (const cmd of HERMES_COMMANDS) {
    const nameMatch = cmd.name.toLowerCase().startsWith(clean);
    const aliasMatch = cmd.aliases?.some((a) => a.toLowerCase().startsWith(clean));

    if (nameMatch || aliasMatch) {
      prefixMatches.push(cmd);
    } else if (
      cmd.name.toLowerCase().includes(clean) ||
      cmd.description.toLowerCase().includes(clean) ||
      cmd.category.toLowerCase().includes(clean) ||
      cmd.tag?.toLowerCase().includes(clean) ||
      cmd.subcommands?.some((s) => s.toLowerCase().includes(clean))
    ) {
      otherMatches.push(cmd);
    }
  }

  return [...prefixMatches, ...otherMatches].slice(0, maxResults);
}

/**
 * Filter commands by category
 */
export function getCommandsByCategory(category: CommandCategory | 'ALL'): HermesCommand[] {
  if (category === 'ALL') return HERMES_COMMANDS;
  return HERMES_COMMANDS.filter((c) => c.category === category);
}

/**
 * Resolve a command string to its HermesCommand definition
 */
export function resolveHermesCommand(input: string): HermesCommand | undefined {
  const base = input.trim().split(/\s+/)[0]?.toLowerCase();
  if (!base) return undefined;
  return COMMAND_LOOKUP.get(base) || COMMAND_LOOKUP.get(base.replace(/^\//, ''));
}
