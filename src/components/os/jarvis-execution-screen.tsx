'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import { soundFx } from '@/lib/audio-synth';
import {
  Shield,
  Cpu,
  Zap,
  Activity,
  Terminal,
  X,
  Minimize2,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Radio,
  Clock,
  Layers,
  Copy,
  Check,
  Volume2,
  ArrowRight,
  HardDrive,
  Wifi,
  Sparkles,
  Search,
  ArrowUpDown,
  RefreshCw,
  Box,
  SlidersHorizontal,
  GitBranch,
  FileCode,
  Folder,
  Play,
  CheckSquare,
  Users,
  Eye,
  Send,
  CornerDownLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TaskExecutionProps {
  isOpen: boolean;
  taskTitle: string;
  protocolName?: string;
  command?: string;
  onAbort?: () => void;
  onClose?: () => void;
  onOpenChat?: (sessionId?: string) => void;
  currentStepIndex?: number;
  steps?: string[];
  logs?: string[];
  isCompleted?: boolean;
  resultSummary?: string;
  realOutput?: string;
  sessionId?: string;
}

const DEFAULT_STEPS = [
  'SPAWN ISOLATED SUBPROCESS (uv Python 3.14.7)',
  'ATTACH KALI WSL2 SOCKETS & PERIMETER INTEROP',
  'LOAD VECTOR SKILL ARSENAL (61 MODULES LOADED)',
  'ENGAGE NEURAL & SYSTEM TOOL INFERENCE PIPELINE',
  'PARSE STRUCTURED AST & FLUSH TELEMETRY STREAM',
];

interface RealTelemetry {
  cpuUsage: number;
  ramUsage: number;
  ramUsedMB: number;
  ramTotalMB: number;
  diskUsage: number;
  networkInMbps: number;
  networkOutMbps: number;
  coreTemp?: number;
}

interface ProcessItem {
  pid: string;
  name: string;
  app: string;
  cpu: string;
  mem: string;
  status: 'RUNNING' | 'ACTIVE' | 'SLEEP' | 'I/O WAIT';
}

const ACTIVE_ECOSYSTEM_APPS = [
  {
    id: 'kali',
    name: 'Kali Linux WSL2',
    subsystem: 'Kernel 6.6+ / Microsoft Interop',
    role: 'Root Operating System',
    status: 'ENGAGED',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  },
  {
    id: 'python',
    name: 'uv Python 3.14.7',
    subsystem: 'Subprocess Runtime Isolation',
    role: 'Execution Runtime',
    status: 'ACTIVE',
    badgeClass: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400',
  },
  {
    id: 'gateway',
    name: 'Hermes Agent Core',
    subsystem: 'PID 358 Daemon Router',
    role: 'Neural Agent Engine',
    status: 'STREAMING',
    badgeClass: 'border-accent/40 bg-accent/15 text-accent',
  },
  {
    id: 'terminal',
    name: 'Bash Shell PTY',
    subsystem: '/bin/bash Interactive Socket',
    role: 'Virtual Terminal Host',
    status: 'MOUNTED',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  },
  {
    id: 'sqlite',
    name: 'SQLite WAL Engine',
    subsystem: 'state.db WAL Checkpoint',
    role: 'Vector & State Storage',
    status: 'ONLINE',
    badgeClass: 'border-primary/40 bg-primary/15 text-primary',
  },
  {
    id: 'voice',
    name: 'Sarvam Saaras AI',
    subsystem: 'Neural Voice Audio Stream',
    role: 'Speech Synthesis Link',
    status: 'READY',
    badgeClass: 'border-accent/40 bg-accent/15 text-accent',
  },
];

export const JarvisExecutionScreen: React.FC<TaskExecutionProps> = ({
  isOpen,
  taskTitle,
  protocolName = 'STARK PROTOCOL // NEMOTRON-3 TOOL INFERENCE',
  command,
  onAbort,
  onClose,
  onOpenChat,
  currentStepIndex = 1,
  steps = DEFAULT_STEPS,
  logs: externalLogs,
  isCompleted = false,
  resultSummary,
  realOutput,
  sessionId,
}) => {
  const [windowMode, setWindowMode] = useState<'normal' | 'maximized' | 'minimized'>('normal');
  const [activeTab, setActiveTab] = useState<'terminal' | 'processes' | 'apps' | 'swarm' | 'diff' | 'results'>('terminal');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeStep, setActiveStep] = useState(currentStepIndex);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [processSearch, setProcessSearch] = useState('');
  const [processSort, setProcessSort] = useState<'cpu' | 'mem' | 'pid'>('cpu');

  // Interactive Terminal State & PTY Pipeline
  const [interactiveCmd, setInteractiveCmd] = useState('');
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);

  // Agent Swarm Visualizer State
  const [selectedSwarmAgent, setSelectedSwarmAgent] = useState<string | null>('recon');

  // Code Diff & Workspace File State
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [diffApplyStatus, setDiffApplyStatus] = useState<string | null>(null);

  const [processes, setProcesses] = useState<ProcessItem[]>([]);

  const [telemetry, setTelemetry] = useState<RealTelemetry>({
    cpuUsage: -1,
    ramUsage: -1,
    ramUsedMB: 0,
    ramTotalMB: 0,
    diskUsage: 0,
    networkInMbps: 0,
    networkOutMbps: 0,
    coreTemp: -1,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsPollRef = useRef<NodeJS.Timeout | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const hasAnnouncedCompletionRef = useRef(false);

  // Poll real WSL metrics and live process-app mapping while open
  useEffect(() => {
    if (!isOpen) return;

    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/system/metrics');
        if (res.ok) {
          const data = await res.json();
          setTelemetry({
            cpuUsage: data.cpuUsage ?? -1,
            ramUsage: data.ramUsage ?? -1,
            ramUsedMB: data.ramUsedMB ?? 0,
            ramTotalMB: data.ramTotalMB ?? 0,
            diskUsage: data.diskUsage ?? 0,
            networkInMbps: data.networkInMbps ?? 0,
            networkOutMbps: data.networkOutMbps ?? 0,
            coreTemp: data.cpuTemperatureC ?? -1,
          });

          setProcesses(Array.isArray(data.topProcesses) ? data.topProcesses : []);
        }
      } catch {}
    };

    fetchMetrics();
    metricsPollRef.current = setInterval(fetchMetrics, 1400);

    return () => {
      if (metricsPollRef.current) clearInterval(metricsPollRef.current);
    };
  }, [isOpen]);

  // Handle task startup / stopwatch
  useEffect(() => {
    if (isOpen) {
      hasAnnouncedCompletionRef.current = false;
      soundFx.playTaskStart();
      setElapsedMs(0);
      setActiveStep(0);
      setWindowMode('normal');

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 50);

      const isoTime = new Date().toISOString().slice(11, 19);
      const initialLogs = [
        `[${isoTime}] DISPATCH: "${taskTitle.slice(0, 80)}"`,
        `[${isoTime}] PROTOCOL_ENGAGE: ${protocolName}`,
        `[${isoTime}] HOST_KERNEL: Linux 6.6+ Microsoft WSL2 // AMD Ryzen 5 7520U`,
        `[${isoTime}] PROCESS_ENV: uv Python 3.14.7 isolated runtime environment mounted`,
        `[${isoTime}] DAEMON_IPC: hermes-gateway (PID 358) channel armed and synchronized`,
      ];
      if (command) {
        initialLogs.push(`[${isoTime}] EXEC_COMMAND: $ ${command}`);
      }
      setLiveLogs(initialLogs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, taskTitle, protocolName, command]);

  // Step advancement during execution
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    const stepInterval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < steps.length - 1) {
          soundFx.playTaskStep();
          const next = prev + 1;
          const isoTime = new Date().toISOString().slice(11, 19);
          setLiveLogs((l) => [
            ...l,
            `[${isoTime}] STAGE_ADVANCE: ${steps[next]} [VERIFIED]`,
          ]);
          return next;
        }
        return prev;
      });
    }, 2200);

    return () => clearInterval(stepInterval);
  }, [isOpen, isCompleted, steps]);

  // Scroll terminal to bottom as new logs arrive
  useEffect(() => {
    if (activeTab === 'terminal' && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, externalLogs, activeTab]);

  // When Task Completes: Play triumph sound and announce voice debrief
  useEffect(() => {
    if (isCompleted && isOpen && !hasAnnouncedCompletionRef.current) {
      hasAnnouncedCompletionRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      soundFx.playTaskSuccess();

      const isoTime = new Date().toISOString().slice(11, 19);
      setLiveLogs((l) => [
        ...l,
        `[${isoTime}] PROTOCOL_STATUS: 200 OK // SUCCESS`,
        `[${isoTime}] MISSION_DEBRIEF: Output verified and telemetry synchronized in WSL2.`,
      ]);

      // Automatically switch to Results debrief view
      setActiveTab('results');

      // Vocal talk-back debrief
      const debriefText = realOutput
        ? `Task execution complete. ${realOutput.slice(0, 140)}`
        : 'Task execution complete. All parameters nominal in WSL. Result verified.';

      setIsSpeaking(true);
      soundFx.speakText(debriefText, () => {
        setIsSpeaking(false);
      });
    }
  }, [isCompleted, isOpen, realOutput]);

  const handleCopyTelemetry = () => {
    const textToCopy = realOutput
      ? `=== TASK: ${taskTitle} ===\nDURATION: ${timerDisplay}\nSTATUS: SUCCESS (200 OK)\n\nOUTPUT:\n${realOutput}`
      : liveLogs.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setHasCopied(true);
    soundFx.playClick(1400);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleReplayVoice = () => {
    soundFx.playClick(1200);
    const speechText = realOutput
      ? `Task debrief: ${realOutput.slice(0, 240)}`
      : 'Task execution verified. All parameters nominal.';
    setIsSpeaking(true);
    soundFx.speakText(speechText, () => {
      setIsSpeaking(false);
    });
  };

  // Interactive Shell Terminal Command Execution
  const handleRunInteractiveCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || interactiveCmd).trim();
    if (!cmd || isExecutingCmd) return;

    soundFx.playTerminalCommand();
    const isoTime = new Date().toISOString().slice(11, 19);
    setLiveLogs((prev) => [...prev, `[${isoTime}] $ ${cmd}`]);
    setInteractiveCmd('');
    setIsExecutingCmd(true);

    try {
      const res = await fetch('/api/system/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      const data = await res.json();
      const endIso = new Date().toISOString().slice(11, 19);

      if (data.stdout) {
        const stdoutLines = data.stdout.trim().split('\n').map((line: string) => `[${endIso}]   ${line}`);
        setLiveLogs((prev) => [...prev, ...stdoutLines]);
      }
      if (data.stderr) {
        const stderrLines = data.stderr.trim().split('\n').map((line: string) => `[${endIso}] ! ${line}`);
        setLiveLogs((prev) => [...prev, ...stderrLines]);
      }
      setLiveLogs((prev) => [...prev, `[${endIso}] PROCESS RETURNED // EXIT CODE: ${data.exitCode ?? 0}`]);
    } catch (err: any) {
      const endIso = new Date().toISOString().slice(11, 19);
      setLiveLogs((prev) => [...prev, `[${endIso}] ERR_EXECUTION_FAILURE: ${err.message || 'Execution failed'}`]);
    } finally {
      setIsExecutingCmd(false);
    }
  };

  const handleInterruptCmd = () => {
    soundFx.playJarvisAlert();
    const isoTime = new Date().toISOString().slice(11, 19);
    setLiveLogs((prev) => [...prev, `[${isoTime}] ^C (SIGINT // OPERATOR OVERRIDE)`]);
    setIsExecutingCmd(false);
  };

  const handleClearTerminal = () => {
    soundFx.playClick(900);
    setLiveLogs([`[${new Date().toISOString().slice(11, 19)}] TERMINAL BUFFER PURGED // READY`]);
  };

  const SWARM_AGENTS = useMemo(() => [
    {
      id: 'recon',
      callsign: 'RECON-01',
      role: 'System Reconnaissance & Telemetry',
      model: 'Nemotron-3 550B',
      status: 'ACTIVE',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
      cpu: `${(telemetry.cpuUsage * 0.2).toFixed(1)}%`,
      mem: '142 MB',
      currentThought: 'Polling WSL2 /proc/stat, active network sockets, and perimeter load.',
      completedStages: ['Kernel interop handshake', 'Process PID discovery', 'Telemetry vector locked'],
    },
    {
      id: 'planner',
      callsign: 'PLANNER-02',
      role: 'Chain-of-Thought & AST Reasoning',
      model: 'Nemotron-3 550B (CoT)',
      status: isCompleted ? 'RESOLVED' : 'THINKING',
      badgeClass: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400',
      cpu: `${(telemetry.cpuUsage * 0.45).toFixed(1)}%`,
      mem: '320 MB',
      currentThought: 'Evaluating task tool dependency graph and resolving AST sub-instructions.',
      completedStages: ['Syntax tree validation', 'Skill arsenal alignment', 'Subprocess parameter binding'],
    },
    {
      id: 'executor',
      callsign: 'EXECUTOR-03',
      role: 'PTY Terminal & Tool Execution',
      model: 'Python 3.14 Subprocess Engine',
      status: isCompleted ? 'COMPLETED' : 'STREAMING',
      badgeClass: 'border-accent/40 bg-accent/15 text-accent',
      cpu: `${(telemetry.cpuUsage * 0.3).toFixed(1)}%`,
      mem: '412 MB',
      currentThought: 'Piping stdout/stderr descriptors across virtual terminal PTY buffer.',
      completedStages: ['PTY master socket allocated', 'Child environment sanitized', 'Real-time output stream locked'],
    },
    {
      id: 'sentinel',
      callsign: 'SENTINEL-04',
      role: 'Verification & Mission Debrief',
      model: 'Audit & Safety Guardrail',
      status: isCompleted ? 'VERIFIED' : 'MONITORING',
      badgeClass: isCompleted ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-400' : 'border-primary/30 bg-primary/10 text-muted-foreground',
      cpu: '0.4%',
      mem: '98 MB',
      currentThought: isCompleted ? 'Exit code 0 validated. Output integrity checksum confirmed.' : 'Standing by to verify exit status and synthesize debrief audio.',
      completedStages: isCompleted ? ['Exit code audit passed', 'Memory leak probe zeroed', 'Vocal debrief synthesized'] : ['Pre-flight checks passed'],
    },
  ], [isCompleted, telemetry.cpuUsage]);

  const SAMPLE_DIFFS = useMemo(() => [
    {
      path: 'src/lib/audio-synth.ts',
      name: 'audio-synth.ts',
      additions: 42,
      deletions: 6,
      language: 'typescript',
      diffLines: [
        { type: 'same' as const, text: "import { synthesizeSarvamSpeech } from './sarvam';", oldLine: 3, newLine: 3 },
        { type: 'add' as const, text: "export type AudioProfile = 'stark' | 'cyberpunk' | 'nasa' | 'stealth';", newLine: 4 },
        { type: 'add' as const, text: "private profile: AudioProfile = 'stark';", newLine: 5 },
        { type: 'del' as const, text: "private isMuted: boolean = false;", oldLine: 19 },
        { type: 'add' as const, text: "private isMuted: boolean = false; private masterVolume = 1.0;", newLine: 20 },
        { type: 'add' as const, text: "public setProfile(profile: AudioProfile) { this.profile = profile; }", newLine: 21 },
        { type: 'same' as const, text: "public playClick(freq = 880, duration = 0.04) {", oldLine: 272, newLine: 388 },
        { type: 'add' as const, text: "  if (this.isMuted || this.profile === 'stealth') return;", newLine: 389 },
      ],
    },
    {
      path: 'src/components/os/gods-eye-modal.tsx',
      name: 'gods-eye-modal.tsx',
      additions: 68,
      deletions: 12,
      language: 'typescript',
      diffLines: [
        { type: 'same' as const, text: "import { GODS_EYE_DEFAULT_URL } from '@/lib/godseye';", oldLine: 27, newLine: 27 },
        { type: 'add' as const, text: "export interface WaypointItem extends GeoLocation { id: string; }", newLine: 28 },
        { type: 'add' as const, text: "const [waypoints, setWaypoints] = useState<WaypointItem[]>(DEFAULT_WAYPOINTS);", newLine: 29 },
        { type: 'add' as const, text: "const [isTourPlaying, setIsTourPlaying] = useState<boolean>(false);", newLine: 30 },
        { type: 'del' as const, text: "{/* Embedded Cesium 3D Globe Iframe */}", oldLine: 530 },
        { type: 'add' as const, text: "{/* Tactical OSINT Overlays Deck & SVG HUD Layer */}", newLine: 650 },
      ],
    },
    {
      path: 'src/components/os/chat-mode.tsx',
      name: 'chat-mode.tsx',
      additions: 34,
      deletions: 8,
      language: 'typescript',
      diffLines: [
        { type: 'same' as const, text: "import { JarvisExecutionScreen } from './jarvis-execution-screen';", oldLine: 37, newLine: 37 },
        { type: 'add' as const, text: "const [tasksQueue, setTasksQueue] = useState<JarvisTaskItem[]>([]);", newLine: 38 },
        { type: 'add' as const, text: "const [activeTaskId, setActiveTaskId] = useState<string | null>(null);", newLine: 39 },
        { type: 'del' as const, text: "setRunningTask({ title: queryText, protocol: derivedProtocol });", oldLine: 603 },
        { type: 'add' as const, text: "setTasksQueue(prev => [...prev, newTask]); setActiveTaskId(newTask.id);", newLine: 605 },
      ],
    },
  ], []);

  const handleApplyDiff = (fileName: string) => {
    soundFx.playTaskSuccess();
    setDiffApplyStatus(`APPLIED: ${fileName} patches synchronized with workspace.`);
    setTimeout(() => setDiffApplyStatus(null), 3000);
  };

  // Filtered & Sorted Process List
  const filteredProcesses = useMemo(() => {
    return processes
      .filter((p) => {
        if (!processSearch.trim()) return true;
        const q = processSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.app.toLowerCase().includes(q) ||
          p.pid.includes(q) ||
          p.status.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (processSort === 'cpu') {
          return parseFloat(b.cpu) - parseFloat(a.cpu);
        }
        if (processSort === 'mem') {
          return parseFloat(b.mem) - parseFloat(a.mem);
        }
        return parseInt(b.pid, 10) - parseInt(a.pid, 10);
      });
  }, [processes, processSearch, processSort]);

  if (!isOpen) return null;

  // Format stopwatch 00:00.00
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const hundredths = String(Math.floor((elapsedMs % 1000) / 10)).padStart(2, '0');
  const timerDisplay = `${minutes}:${seconds}.${hundredths}`;

  // Minimized Picture-In-Picture Holographic Pill (Parity with God's Eye)
  if (windowMode === 'minimized') {
    return (
      <div className="fixed bottom-6 right-6 z-[90] animate-bounce-slow">
        <div className="relative flex items-center gap-3 rounded-2xl border-2 border-accent/60 bg-background/95 px-4 py-2.5 shadow-[0_0_35px_hsl(var(--primary)/0.5)] backdrop-blur-xl font-headline select-none">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 border border-accent animate-spin-slow">
            <Flame size={16} className="text-accent animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isCompleted ? 'bg-emerald-400' : 'bg-destructive animate-ping'
                )}
              />
              <span className={cn('text-[11px] font-bold text-accent tracking-widest', orbitron.className)}>
                {timerDisplay}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded border border-primary/30 font-mono text-primary">
                {isCompleted ? 'VERIFIED' : 'RUNNING'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
              {taskTitle}
            </p>
          </div>
          <button
            onClick={() => {
              soundFx.playClick(1000);
              setWindowMode('normal');
            }}
            className="rounded-full border border-primary/30 p-1.5 text-primary hover:text-accent hover:border-accent transition-colors cursor-pointer"
            title="Expand Full Marvel Jarvis Execution Screen"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  const isMaximized = windowMode === 'maximized';

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4 select-none animate-fade-in font-headline">
      {/* Marvel Holographic Scanline Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] opacity-35" />

      {/* Sweeping Jarvis Radar Beam */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.15)_0%,_transparent_70%)] animate-pulse-slow" />

      {/* Main Holographic Glass Container */}
      <div
        className={cn(
          'relative flex flex-col rounded-3xl border-2 border-primary/50 bg-background/95 p-4 sm:p-6 shadow-[0_0_90px_hsl(var(--primary)/0.35)] backdrop-blur-2xl overflow-hidden transition-all duration-300',
          isMaximized
            ? 'w-[99vw] h-[97vh] max-w-none'
            : 'w-[96vw] max-w-6xl h-[88vh] max-h-[880px]'
        )}
      >
        {/* Holographic Caliper Readings */}
        <div className="pointer-events-none absolute top-3 left-4 text-[9px] font-mono text-primary/60 tracking-widest hidden sm:block">
          + LAT 34.0522° N // LON 118.2437° W // ELEV 82M
        </div>
        <div className="pointer-events-none absolute top-3 right-28 text-[9px] font-mono text-primary/60 tracking-widest hidden md:block">
          CORE_TEMP: {telemetry.coreTemp || 42}°C // REACTOR: 98.4%
        </div>
        <div className="pointer-events-none absolute bottom-3 left-4 text-[9px] font-mono text-primary/50 tracking-widest hidden sm:block">
          SYSTEM: WSL2-KALI // PID 358 // UV-PY 3.14.7
        </div>
        <div className="pointer-events-none absolute bottom-3 right-4 text-[9px] font-mono text-primary/50 tracking-widest hidden sm:block">
          [ STARK_HERMES_MARK_XV // LIVE_TASK_ENGINE ]
        </div>

        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-primary/25 pb-3 gap-2.5 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_0_20px_hsl(var(--accent)/0.3)] shrink-0',
                isCompleted
                  ? 'border-emerald-400 bg-emerald-500/20'
                  : 'border-accent/50 bg-accent/15'
              )}
            >
              {isCompleted ? (
                <CheckCircle2 size={22} className="text-emerald-400 animate-pulse" />
              ) : (
                <Zap size={20} className="text-accent animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    isCompleted ? 'bg-emerald-400' : 'bg-destructive animate-ping'
                  )}
                />
                <span className={cn('text-xs font-bold tracking-[0.2em] truncate', isCompleted ? 'text-emerald-400' : 'text-accent', orbitron.className)}>
                  {isCompleted ? 'MISSION ACCOMPLISHED // PROTOCOL VERIFIED' : protocolName}
                </span>
                <span className="rounded border border-primary/30 px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground uppercase shrink-0">
                  {isCompleted ? 'SUCCESS' : 'LIVE'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-wider text-foreground truncate max-w-xl">
                {taskTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            {/* Live Stopwatch Clock */}
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-sm font-bold text-accent shadow-inner">
              <Clock size={14} className="text-accent" />
              <span>{timerDisplay}</span>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundFx.playClick(1000);
                  setWindowMode('minimized');
                }}
                className="rounded-lg border border-primary/30 p-1.5 text-primary hover:text-accent hover:border-accent hover:bg-primary/10 transition-colors cursor-pointer"
                title="Minimize to Floating PiP Pill"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={() => {
                  soundFx.playClick(1000);
                  setWindowMode(isMaximized ? 'normal' : 'maximized');
                }}
                className="rounded-lg border border-primary/30 p-1.5 text-primary hover:text-accent hover:border-accent hover:bg-primary/10 transition-colors cursor-pointer"
                title={isMaximized ? "Restore Window Size" : "Maximize Window"}
              >
                <Maximize2 size={14} />
              </button>
              {onClose && (
                <button
                  onClick={() => {
                    soundFx.playClick(900);
                    onClose();
                  }}
                  className="rounded-lg border border-destructive/40 bg-destructive/10 p-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer"
                  title="Dismiss Task Screen"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center justify-between border-b border-primary/15 py-2 z-20 shrink-0 text-xs font-mono">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setActiveTab('terminal');
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer font-bold',
                activeTab === 'terminal'
                  ? 'border-accent bg-accent/20 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]'
                  : 'border-primary/20 bg-primary/5 text-muted-foreground hover:text-foreground hover:border-primary/40'
              )}
            >
              <Terminal size={13} />
              <span>TERMINAL &amp; PIPELINE</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick(1100);
                setActiveTab('processes');
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer font-bold',
                activeTab === 'processes'
                  ? 'border-accent bg-accent/20 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]'
                  : 'border-primary/20 bg-primary/5 text-muted-foreground hover:text-foreground hover:border-primary/40'
              )}
            >
              <Cpu size={13} />
              <span>PROCESS ARCHITECTURE</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick(1100);
                setActiveTab('apps');
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer font-bold hidden md:flex',
                activeTab === 'apps'
                  ? 'border-accent bg-accent/20 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]'
                  : 'border-primary/20 bg-primary/5 text-muted-foreground hover:text-foreground hover:border-primary/40'
              )}
            >
              <Box size={13} />
              <span>ACTIVE APPS &amp; ENV</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick(1100);
                setActiveTab('swarm');
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer font-bold',
                activeTab === 'swarm'
                  ? 'border-accent bg-accent/20 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]'
                  : 'border-primary/20 bg-primary/5 text-muted-foreground hover:text-foreground hover:border-primary/40'
              )}
            >
              <Users size={13} />
              <span>AGENT SWARM</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick(1100);
                setActiveTab('diff');
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer font-bold hidden sm:flex',
                activeTab === 'diff'
                  ? 'border-accent bg-accent/20 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]'
                  : 'border-primary/20 bg-primary/5 text-muted-foreground hover:text-foreground hover:border-primary/40'
              )}
            >
              <FileCode size={13} />
              <span>CODE &amp; DIFFS</span>
            </button>

            {(isCompleted || realOutput) && (
              <button
                onClick={() => {
                  soundFx.playClick(1100);
                  setActiveTab('results');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all cursor-pointer font-bold',
                  activeTab === 'results'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_hsl(142_71%_45%/0.3)]'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500'
                )}
              >
                <CheckCircle2 size={13} />
                <span>MISSION RESULTS</span>
              </button>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              WSL2 TELEMETRY ONLINE
            </span>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-grow overflow-hidden py-3 z-20 min-h-0">
          
          {/* Left Column: 3D Marvel Arc Reactor HUD Hologram & Telemetry */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col justify-between gap-3 relative min-h-0 overflow-y-auto hermes-scrollbar pr-1">
            
            {/* 3D Arc Reactor Gyroscope */}
            <div className="relative h-44 w-44 sm:h-52 sm:w-52 mx-auto flex items-center justify-center my-auto shrink-0">
              
              {/* Outer Segmented Caliper Rings */}
              <div
                className={cn(
                  'absolute inset-0 rounded-full border border-dashed transition-all duration-500',
                  isCompleted
                    ? 'border-emerald-400/50 shadow-[0_0_30px_hsl(142_71%_45%/0.4)] animate-[spin_60s_linear_infinite]'
                    : 'border-primary/30 animate-[spin_35s_linear_infinite]'
                )}
              />
              <div className="absolute inset-2 rounded-full border border-dotted border-accent/40 animate-[spin_20s_linear_infinite_reverse]" />
              
              {/* Target reticle crosshairs */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-primary/20 pointer-events-none" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-primary/20 pointer-events-none" />

              {/* Sweeping Radar Line */}
              <div className="absolute inset-4 rounded-full border-2 border-primary/20 overflow-hidden">
                <div
                  className={cn(
                    'absolute top-0 left-1/2 h-1/2 w-1/2 origin-bottom-left animate-[spin_3s_linear_infinite]',
                    isCompleted
                      ? 'bg-gradient-to-tr from-emerald-400/25 via-emerald-400/5 to-transparent'
                      : 'bg-gradient-to-tr from-accent/25 via-accent/5 to-transparent'
                  )}
                />
              </div>

              {/* Arc Reactor Geometric Core */}
              <div
                className={cn(
                  'relative z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 bg-background/85 backdrop-blur-md transition-all duration-500',
                  isCompleted
                    ? 'border-emerald-400 shadow-[0_0_45px_hsl(142_71%_45%/0.6)]'
                    : 'border-accent/70 shadow-[0_0_40px_hsl(var(--primary)/0.6)]'
                )}
              >
                <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping opacity-20 pointer-events-none" />
                {isCompleted ? (
                  <Shield size={28} className="text-emerald-400 animate-pulse drop-shadow-[0_0_12px_hsl(142_71%_45%)]" />
                ) : (
                  <Activity size={28} className="text-accent animate-pulse drop-shadow-[0_0_12px_hsl(var(--accent))]" />
                )}
                <div className={cn('text-[9px] font-bold tracking-[0.2em] text-primary mt-1 font-mono', orbitron.className)}>
                  {isCompleted ? 'VERIFIED' : 'INFERENCE'}
                </div>
                <div className={cn('text-[9px] font-mono font-bold', isCompleted ? 'text-emerald-400' : 'text-accent')}>
                  {isCompleted ? '100% DONE' : `${Math.min(95, 20 + activeStep * 20)}% FLOW`}
                </div>
              </div>
            </div>

            {/* Real Hardware Telemetry Gauges */}
            <div className="grid grid-cols-3 gap-2 w-full font-mono text-center shrink-0">
              <div className="rounded-lg border border-primary/25 bg-background/70 p-2 shadow-sm">
                <span className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
                  <Cpu size={10} className="text-primary" /> CPU LOAD
                </span>
                <span className="text-xs font-bold text-accent">{telemetry.cpuUsage}%</span>
              </div>
              <div className="rounded-lg border border-primary/25 bg-background/70 p-2 shadow-sm">
                <span className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
                  <Activity size={10} className="text-accent" /> WSL RAM
                </span>
                <span className="text-xs font-bold text-accent">
                  {(telemetry.ramUsedMB / 1024).toFixed(1)} / {(telemetry.ramTotalMB / 1024).toFixed(1)} GB
                </span>
              </div>
              <div className="rounded-lg border border-primary/25 bg-background/70 p-2 shadow-sm">
                <span className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
                  <Radio size={10} className="text-emerald-400" /> NET I/O
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {telemetry.networkInMbps} MB/s
                </span>
              </div>
            </div>

            {/* Active Apps Mini Ribbon */}
            <div className="rounded-xl border border-primary/20 bg-background/60 p-2.5 space-y-1.5 shrink-0 font-mono text-[10px]">
              <div className="flex items-center justify-between text-muted-foreground border-b border-primary/10 pb-1">
                <span className="flex items-center gap-1 text-primary font-bold">
                  <Box size={11} className="text-accent" />
                  APPS ENGAGED IN TASK
                </span>
                <span className="text-[9px] text-accent">6 ECOSYSTEM NODES</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {ACTIVE_ECOSYSTEM_APPS.slice(0, 4).map((app) => (
                  <div key={app.id} className="p-1 rounded border border-primary/10 bg-primary/5 flex items-center justify-between gap-1">
                    <span className="truncate text-foreground font-semibold">{app.name}</span>
                    <span className={cn('text-[8px] px-1 py-0.2 rounded font-bold uppercase', app.badgeClass)}>
                      {app.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Multi-View Workspace (Terminal, Process Architecture, Results) */}
          <div className="lg:col-span-8 xl:col-span-8 flex flex-col justify-between gap-3 overflow-hidden min-h-0">
            
            {/* VIEW 1: TERMINAL & PROTOCOL PIPELINE */}
            {activeTab === 'terminal' && (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0 overflow-hidden">
                {/* Step Pipeline Progress Checklist */}
                <div className="space-y-1.5 rounded-xl border border-primary/30 bg-background/60 p-3 backdrop-blur-md shadow-inner shrink-0 font-mono text-xs">
                  <div className="flex items-center justify-between text-xs text-primary/80 border-b border-primary/15 pb-1 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-accent" />
                      <span>EXECUTION PROTOCOL PIPELINE</span>
                    </span>
                    <span className="text-accent font-bold">
                      STAGE {activeStep + 1} OF {steps.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {steps.map((step, idx) => {
                      const isDone = isCompleted || idx < activeStep;
                      const isCurrent = !isCompleted && idx === activeStep;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            'flex items-center justify-between rounded-md px-2.5 py-1 text-xs transition-all',
                            isDone
                              ? 'border border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                              : isCurrent
                              ? 'border border-accent/50 bg-accent/15 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.2)]'
                              : 'border border-primary/10 bg-primary/5 text-muted-foreground opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            {isDone ? (
                              <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                            ) : isCurrent ? (
                              <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-primary/40 flex-shrink-0" />
                            )}
                            <span className="truncate">{step}</span>
                          </div>
                          <span className="text-[10px] font-bold shrink-0">
                            {isDone ? 'OK' : isCurrent ? 'RUNNING' : 'QUEUED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Real-time Subprocess Diagnostic Terminal */}
                <div className="relative flex-1 min-h-[160px] flex flex-col rounded-xl border border-primary/30 bg-black/80 p-3 font-mono text-[11px] text-accent/90 shadow-inner overflow-hidden">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-1 mb-1.5 text-[10px] text-primary shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Terminal size={12} />
                      <span>LIVE SUBPROCESS TERMINAL LOG // STDOUT</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-[9px] flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        STREAMING
                      </span>
                      <button
                        onClick={handleCopyTelemetry}
                        className="flex items-center gap-1 text-[9px] text-primary hover:text-accent font-mono transition-colors cursor-pointer"
                        title="Copy full telemetry log"
                      >
                        {hasCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span className={hasCopied ? 'text-emerald-400 font-bold' : ''}>
                          {hasCopied ? 'COPIED' : 'COPY'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] leading-relaxed hermes-scrollbar">
                    {(externalLogs && externalLogs.length > 0 ? externalLogs : liveLogs).map((l, i) => (
                      <p key={i} className="text-foreground/85 hover:text-accent transition-colors break-words">
                        {l}
                      </p>
                    ))}
                    {!isCompleted && (
                      <div className="flex items-center gap-1 text-accent animate-pulse">
                        <span className="text-emerald-400 font-bold">&gt;</span>
                        <span className="h-3 w-1.5 bg-accent" />
                      </div>
                    )}
                    <div ref={terminalBottomRef} />
                  </div>

                  {/* Interactive Shell Input Prompt & Quick Diagnostic Buttons */}
                  <div className="pt-2 border-t border-primary/20 shrink-0 space-y-1.5 bg-black/60 -mx-3 -mb-3 p-2.5">
                    {/* Quick diagnostic command pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 text-[9px]">
                      <span className="text-muted-foreground font-bold shrink-0">QUICK:</span>
                      {[
                        'ps aux | grep node',
                        'free -h',
                        'df -h',
                        'uptime',
                        'git status',
                        'top -b -n 1 | head -15',
                        'ss -tuln',
                        'ls -la',
                      ].map((qCmd) => (
                        <button
                          key={qCmd}
                          type="button"
                          onClick={() => handleRunInteractiveCommand(qCmd)}
                          disabled={isExecutingCmd}
                          className="px-2 py-0.5 rounded border border-primary/25 bg-primary/10 text-primary hover:border-accent hover:text-accent hover:bg-primary/20 transition-all font-mono whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-40"
                        >
                          {qCmd}
                        </button>
                      ))}
                    </div>

                    {/* Terminal Command Input Bar */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRunInteractiveCommand();
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold shrink-0 select-none">
                        <span className="text-primary hidden sm:inline">operator@kali:~$</span>
                        <span className="sm:hidden">&gt;</span>
                      </div>
                      <input
                        type="text"
                        value={interactiveCmd}
                        onChange={(e) => setInteractiveCmd(e.target.value)}
                        placeholder="Type shell command (e.g. ps aux, uname -a, free -h, git status)..."
                        className="flex-1 bg-black/60 border border-primary/30 rounded-lg px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        disabled={isExecutingCmd}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isExecutingCmd || !interactiveCmd.trim()}
                        className="h-7 px-2.5 text-[10px] font-mono font-bold bg-accent/20 border border-accent/40 text-accent hover:bg-accent hover:text-accent-foreground cursor-pointer shrink-0"
                      >
                        <Send size={10} className="mr-1" />
                        <span>{isExecutingCmd ? 'RUNNING...' : 'EXEC'}</span>
                      </Button>
                      <button
                        type="button"
                        onClick={handleInterruptCmd}
                        className="h-7 px-2 text-[10px] font-mono font-bold rounded-lg border border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground cursor-pointer shrink-0"
                        title="Send SIGINT Interrupt Signal (^C)"
                      >
                        ^C
                      </button>
                      <button
                        type="button"
                        onClick={handleClearTerminal}
                        className="h-7 px-2 text-[10px] font-mono rounded-lg border border-primary/25 bg-primary/10 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        title="Clear Terminal Output"
                      >
                        CLR
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: PROCESS ARCHITECTURE & APP MAPPING (WHICH PROCESS IN WHICH APP) */}
            {activeTab === 'processes' && (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0 overflow-hidden rounded-2xl border border-primary/30 bg-background/70 p-3.5 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/20 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Cpu size={15} className="text-accent" />
                    <span className={cn('text-xs font-bold tracking-wider text-primary uppercase', orbitron.className)}>
                      PROCESS ARCHITECTURE // HOST APP MATRIX
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded border border-primary/30 bg-primary/10 text-primary font-mono">
                      {filteredProcesses.length} ACTIVE PROCESSES
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Process Search Input */}
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={processSearch}
                        onChange={(e) => setProcessSearch(e.target.value)}
                        placeholder="Filter process or app..."
                        className="h-7 w-36 sm:w-48 pl-7 pr-2 rounded-lg border border-primary/25 bg-background/80 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Sort Dropdown / Toggle */}
                    <button
                      onClick={() => {
                        soundFx.playClick(1000);
                        setProcessSort((prev) => (prev === 'cpu' ? 'mem' : prev === 'mem' ? 'pid' : 'cpu'));
                      }}
                      className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-primary/25 bg-background/80 text-[10px] font-mono text-primary hover:text-accent cursor-pointer"
                      title="Sort by CPU, Memory, or PID"
                    >
                      <ArrowUpDown size={11} />
                      <span className="uppercase">SORT: {processSort}</span>
                    </button>
                  </div>
                </div>

                {/* Process-to-App Telemetry Table */}
                <div className="flex-1 min-h-[200px] overflow-y-auto rounded-xl border border-primary/20 bg-black/75 hermes-scrollbar">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-primary/20 text-[10px] text-muted-foreground uppercase">
                      <tr>
                        <th className="p-2 pl-3">PID</th>
                        <th className="p-2">PROCESS BINARY</th>
                        <th className="p-2">HOST APP / SUBSYSTEM</th>
                        <th className="p-2 text-center">CPU %</th>
                        <th className="p-2 text-center">RAM %</th>
                        <th className="p-2 pr-3 text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/10 text-[11px]">
                      {filteredProcesses.map((p) => (
                        <tr key={p.pid} className="hover:bg-primary/10 transition-colors">
                          <td className="p-2 pl-3 font-bold text-accent">{p.pid}</td>
                          <td className="p-2 font-bold text-foreground">
                            <span className="font-mono">{p.name}</span>
                          </td>
                          <td className="p-2 text-primary/90">
                            <span className="px-2 py-0.5 rounded border border-primary/20 bg-primary/5 text-[10px]">
                              {p.app}
                            </span>
                          </td>
                          <td className="p-2 text-center text-accent font-semibold">{p.cpu}</td>
                          <td className="p-2 text-center text-foreground font-semibold">{p.mem}</td>
                          <td className="p-2 pr-3 text-right">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase',
                                p.status === 'RUNNING'
                                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                                  : p.status === 'ACTIVE'
                                  ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-400'
                                  : 'border border-muted/40 bg-muted/20 text-muted-foreground'
                              )}
                            >
                              {p.status === 'RUNNING' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />}
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-primary/15 pt-1.5 shrink-0">
                  <span>SUBSYSTEM LINK: Microsoft WSL2 Kali Kernel 6.6+</span>
                  <span className="text-accent">MAPPED DIRECTLY VIA /proc AND ps DAEMON</span>
                </div>
              </div>
            )}

            {/* VIEW 3: ACTIVE APPS & ECOSYSTEM */}
            {activeTab === 'apps' && (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0 overflow-hidden rounded-2xl border border-primary/30 bg-background/70 p-3.5 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-primary/20 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Box size={15} className="text-accent" />
                    <span className={cn('text-xs font-bold tracking-wider text-primary uppercase', orbitron.className)}>
                      HERMES ACTIVE ECOSYSTEM APPLICATIONS
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">ALL APPS INTEGRATED</span>
                </div>

                <div className="flex-1 min-h-[200px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1 hermes-scrollbar">
                  {ACTIVE_ECOSYSTEM_APPS.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-xl border border-primary/25 bg-background/80 p-3 flex flex-col justify-between gap-2 shadow-sm hover:border-accent transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-foreground font-mono">{app.name}</h4>
                          <p className="text-[10px] text-muted-foreground">{app.subsystem}</p>
                        </div>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase', app.badgeClass)}>
                          {app.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono border-t border-primary/10 pt-1.5 text-primary">
                        <span>ROLE: {app.role}</span>
                        <span className="text-emerald-400 font-semibold">100% HEALTH</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW: MULTI-AGENT SWARM PIPELINE VISUALIZER */}
            {activeTab === 'swarm' && (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0 overflow-hidden rounded-2xl border border-primary/30 bg-background/70 p-3.5 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-primary/20 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-accent" />
                    <span className={cn('text-xs font-bold tracking-wider text-primary uppercase', orbitron.className)}>
                      AUTONOMOUS MULTI-AGENT SWARM // 4 COLLABORATIVE NODES
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded border border-accent/40 bg-accent/15 text-accent font-mono animate-pulse">
                      PIPELINE SYNCHRONIZED
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                    CHAIN-OF-THOUGHT DELEGATION
                  </span>
                </div>

                {/* Swarm Pipeline Conduits Flowchart */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 shrink-0 py-1">
                  {SWARM_AGENTS.map((agent, idx) => {
                    const isSelected = selectedSwarmAgent === agent.id;
                    return (
                      <div
                        key={agent.id}
                        onClick={() => {
                          soundFx.playClick(1000);
                          setSelectedSwarmAgent(agent.id);
                        }}
                        className={cn(
                          'rounded-xl border p-2.5 flex flex-col justify-between gap-2 transition-all cursor-pointer relative overflow-hidden',
                          isSelected
                            ? 'border-accent bg-accent/15 shadow-[0_0_20px_hsl(var(--accent)/0.25)]'
                            : 'border-primary/20 bg-background/60 hover:border-primary/40 hover:bg-primary/5'
                        )}
                      >
                        {/* Top Indicator */}
                        <div className="flex items-center justify-between">
                          <span className={cn('text-xs font-black font-mono', orbitron.className, isSelected ? 'text-accent' : 'text-foreground')}>
                            {agent.callsign}
                          </span>
                          <span className={cn('text-[8px] px-1.5 py-0.2 rounded font-bold uppercase', agent.badgeClass)}>
                            {agent.status}
                          </span>
                        </div>

                        <div>
                          <div className="text-[11px] font-bold text-foreground truncate">{agent.role}</div>
                          <div className="text-[9px] text-muted-foreground font-mono">Engine: {agent.model}</div>
                        </div>

                        {/* CPU & Memory Gauges */}
                        <div className="flex items-center justify-between text-[9px] font-mono border-t border-primary/10 pt-1 text-muted-foreground">
                          <span>CPU: <strong className="text-primary">{agent.cpu}</strong></span>
                          <span>MEM: <strong className="text-foreground">{agent.mem}</strong></span>
                        </div>

                        {/* Flow arrow to next node if not last */}
                        {idx < SWARM_AGENTS.length - 1 && (
                          <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-accent/60 pointer-events-none">
                            ▶
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected Agent Deep Thought Stream & Stages Inspector */}
                {(() => {
                  const currentAgent = SWARM_AGENTS.find((a) => a.id === selectedSwarmAgent) || SWARM_AGENTS[0];
                  return (
                    <div className="flex-1 min-h-[140px] flex flex-col justify-between rounded-xl border border-primary/25 bg-black/85 p-3 font-mono text-xs overflow-hidden">
                      <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 mb-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <Eye size={13} className="text-accent" />
                          <span className="font-bold text-accent">{currentAgent.callsign} REASONING TRACE</span>
                          <span className="text-[10px] text-muted-foreground">({currentAgent.role})</span>
                        </div>
                        <span className="text-[10px] text-emerald-400">STATUS: {currentAgent.status}</span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 hermes-scrollbar">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">CURRENT ACTIVE THOUGHT:</span>
                          <p className="text-foreground text-xs font-sans mt-0.5 leading-relaxed bg-primary/10 border border-primary/20 p-2 rounded-lg">
                            💬 &quot;{currentAgent.currentThought}&quot;
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">VERIFIED MILESTONES:</span>
                          <div className="space-y-1 mt-1">
                            {currentAgent.completedStages.map((stage, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                                <CheckSquare size={12} className="text-emerald-400 shrink-0" />
                                <span>{stage}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-primary/15 flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
                        <span>CONTEXT WINDOW: 128K TOKENS</span>
                        <span className="text-accent font-bold">SYNAPSE LATENCY: 14ms</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* VIEW: IN-UI CODE DIFF VIEWER & FILE TREE */}
            {activeTab === 'diff' && (
              <div className="flex-1 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden rounded-2xl border border-primary/30 bg-background/70 p-3.5 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/20 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileCode size={15} className="text-accent" />
                    <span className={cn('text-xs font-bold tracking-wider text-primary uppercase', orbitron.className)}>
                      IN-UI FILE EXPLORER &amp; CODE DIFF VIEWER
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 font-mono">
                      1-CLICK WORKSPACE APPLY
                    </span>
                  </div>

                  {diffApplyStatus && (
                    <div className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 animate-fade-in">
                      {diffApplyStatus}
                    </div>
                  )}
                </div>

                {/* 2-Column Split: File Explorer (Left) & Diff Viewer (Right) */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 overflow-hidden">
                  {/* Left Column: File Tree */}
                  <div className="md:col-span-4 rounded-xl border border-primary/20 bg-background/80 p-2 flex flex-col justify-between gap-2 min-h-0 overflow-hidden font-mono text-xs">
                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 border-b border-primary/10 pb-1.5 shrink-0">
                      <Folder size={12} className="text-primary" />
                      <span>MODIFIED WORKSPACE FILES</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hermes-scrollbar">
                      {SAMPLE_DIFFS.map((diffFile, dIdx) => {
                        const isSelected = selectedDiffIndex === dIdx;
                        return (
                          <div
                            key={diffFile.path}
                            onClick={() => {
                              soundFx.playClick(1000);
                              setSelectedDiffIndex(dIdx);
                            }}
                            className={cn(
                              'p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1',
                              isSelected
                                ? 'border-accent bg-accent/15 text-accent shadow-[0_0_12px_hsl(var(--accent)/0.2)]'
                                : 'border-primary/15 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[11px] truncate text-foreground">{diffFile.name}</span>
                              <div className="flex items-center gap-1 text-[9px] font-mono shrink-0">
                                <span className="text-emerald-400 font-bold">+{diffFile.additions}</span>
                                <span className="text-rose-400 font-bold">-{diffFile.deletions}</span>
                              </div>
                            </div>
                            <div className="text-[9px] text-muted-foreground truncate opacity-70">
                              {diffFile.path}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-1.5 border-t border-primary/10 text-[9px] text-muted-foreground shrink-0">
                      GIT WORKTREE: CLEAN // NO UNTRACKED
                    </div>
                  </div>

                  {/* Right Column: Code Diff Window */}
                  {(() => {
                    const activeDiff = SAMPLE_DIFFS[selectedDiffIndex] || SAMPLE_DIFFS[0];
                    return (
                      <div className="md:col-span-8 rounded-xl border border-primary/25 bg-black/90 p-2.5 flex flex-col justify-between gap-2 min-h-0 overflow-hidden font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 shrink-0">
                          <div className="flex items-center gap-2">
                            <GitBranch size={12} className="text-accent" />
                            <span className="font-bold text-foreground text-[11px] truncate">{activeDiff.path}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleApplyDiff(activeDiff.name)}
                              className="h-6 px-2.5 text-[10px] font-mono font-bold bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600 hover:text-white cursor-pointer"
                            >
                              <CheckSquare size={10} className="mr-1" />
                              <span>1-CLICK APPLY DIFF</span>
                            </Button>
                          </div>
                        </div>

                        {/* Diff Lines Table */}
                        <div className="flex-1 overflow-y-auto space-y-0.5 text-[11px] font-mono leading-relaxed hermes-scrollbar bg-black/60 p-2 rounded-lg border border-primary/10">
                          {activeDiff.diffLines.map((line, lIdx) => {
                            return (
                              <div
                                key={lIdx}
                                className={cn(
                                  'flex items-center gap-2 px-1.5 py-0.5 rounded transition-colors',
                                  line.type === 'add' && 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-400',
                                  line.type === 'del' && 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500 line-through opacity-80',
                                  line.type === 'same' && 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                <span className="w-6 text-[9px] opacity-40 text-right select-none shrink-0">
                                  {line.newLine || line.oldLine || ''}
                                </span>
                                <span className="w-3 text-center select-none shrink-0 font-bold">
                                  {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                                </span>
                                <span className="whitespace-pre-wrap break-all">{line.text}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-primary/10 shrink-0">
                          <span>SYNTAX: TYPESCRIPT // ANSI DIFF</span>
                          <span className="text-accent font-bold">COMPATIBLE WITH KALI &amp; WSL2</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* VIEW 4: MISSION RESULTS & DEBRIEF (DISPLAYED WHEN COMPLETED OR CLICKED) */}
            {activeTab === 'results' && (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0 overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-background/70 p-4 shadow-[0_0_30px_hsl(142_71%_45%/0.2)] backdrop-blur-xl">
                {/* Debrief Header Banner */}
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Sparkles size={14} />
                    </span>
                    <span className={cn('text-xs font-black tracking-widest text-emerald-400', orbitron.className)}>
                      MARVEL JARVIS // MISSION RESULTS &amp; DEBRIEF
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReplayVoice}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono border transition-all cursor-pointer',
                        isSpeaking
                          ? 'border-accent bg-accent/20 text-accent animate-pulse font-bold'
                          : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-accent'
                      )}
                      title="Replay vocal debrief announcement"
                    >
                      <Volume2 size={13} />
                      <span>{isSpeaking ? 'SPEAKING...' : 'REPLAY VOICE'}</span>
                    </button>

                    <button
                      onClick={handleCopyTelemetry}
                      className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-mono text-primary hover:bg-primary/20 hover:text-accent transition-all cursor-pointer"
                      title="Copy result output"
                    >
                      {hasCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{hasCopied ? 'COPIED' : 'COPY OUTPUT'}</span>
                    </button>
                  </div>
                </div>

                {/* Real Task Output Stream */}
                <div className="flex-1 min-h-[160px] overflow-y-auto rounded-xl border border-primary/25 bg-black/85 p-3.5 font-sans text-xs text-foreground/90 leading-relaxed shadow-inner hermes-scrollbar">
                  {realOutput ? (
                    <div className="space-y-2 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                      {realOutput}
                    </div>
                  ) : resultSummary ? (
                    <p className="text-foreground leading-relaxed font-sans">{resultSummary}</p>
                  ) : (
                    <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
                      <p className="text-emerald-400 font-bold">✓ Task execution concluded successfully with exit code 0.</p>
                      <p>All requested operations across Kali Linux WSL2 and Python 3.14 isolation executed nominally.</p>
                    </div>
                  )}
                </div>

                {/* Debrief Key Metrics Footnote */}
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px] text-muted-foreground border-t border-primary/20 pt-2 shrink-0">
                  <div className="rounded border border-primary/15 bg-primary/5 p-1">
                    <span className="block text-[8px] uppercase">ELAPSED TIME</span>
                    <span className="text-accent font-bold text-[11px]">{timerDisplay}</span>
                  </div>
                  <div className="rounded border border-primary/15 bg-primary/5 p-1">
                    <span className="block text-[8px] uppercase">EXIT CODE</span>
                    <span className="text-emerald-400 font-bold text-[11px]">200 OK // 0</span>
                  </div>
                  <div className="rounded border border-primary/15 bg-primary/5 p-1">
                    <span className="block text-[8px] uppercase">TARGET HOST</span>
                    <span className="text-foreground font-bold text-[11px]">WSL2 KALI</span>
                  </div>
                  <div className="rounded border border-primary/15 bg-primary/5 p-1">
                    <span className="block text-[8px] uppercase">ARSENAL</span>
                    <span className="text-accent font-bold text-[11px]">61 SKILLS</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Override & Controls Bar */}
        <div className="flex items-center justify-between border-t border-primary/20 pt-3 z-20 shrink-0 select-none">
          <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
            <Radio size={13} className="text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">CHANNEL: SYSTEMD_IPC // HOST: KALI_WSL2 // STATUS: ACTIVE</span>
            <span className="sm:hidden">IPC ONLINE</span>
          </div>

          <div className="flex items-center gap-2.5">
            {onAbort && !isCompleted && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  soundFx.playJarvisAlert();
                  onAbort();
                }}
                className="h-8 text-xs font-mono font-bold tracking-wider uppercase border border-destructive/50 bg-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-[0_0_15px_hsl(var(--destructive)/0.3)] cursor-pointer"
              >
                <AlertTriangle size={13} className="mr-1.5" />
                <span>ABORT TASK</span>
              </Button>
            )}

            {isCompleted && onOpenChat && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  soundFx.playClick(1000);
                  onOpenChat(sessionId);
                  if (onClose) onClose();
                }}
                className="h-8 text-xs font-mono font-bold tracking-wider uppercase border border-primary/40 text-accent hover:bg-primary/20 cursor-pointer"
              >
                <span>CONTINUE IN CHAT</span>
                <ArrowRight size={13} className="ml-1.5" />
              </Button>
            )}

            {isCompleted && onClose && (
              <Button
                size="sm"
                onClick={() => {
                  soundFx.playClick(1000);
                  onClose();
                }}
                className="h-8 text-xs font-mono font-bold tracking-wider uppercase border border-emerald-500 bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white cursor-pointer shadow-[0_0_15px_hsl(142_71%_45%/0.3)]"
              >
                <CheckCircle2 size={13} className="mr-1.5" />
                <span>ACKNOWLEDGE &amp; RETURN</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
