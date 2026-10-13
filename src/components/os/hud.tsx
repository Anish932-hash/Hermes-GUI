'use client';

import { useState, useEffect, useCallback } from 'react';
import useSystemMetrics from '@/hooks/use-system-metrics';
import CentralCore from './central-core';
import SystemMetricsDisplay from './system-metrics-panel';
import SystemAnalysisPanel from './system-analysis-panel';
import InfoListPanel from './InfoListPanel';
import Clock from './Clock';
import BoostButton from './BoostButton';
import { HermesDrawer } from './hermes-drawer';
import { HermesConfigModal } from './hermes-config-modal';
import { SystemSettingsModal } from './system-settings-modal';
import { JarvisExecutionScreen } from './jarvis-execution-screen';
import { JarvisCommandPalette } from './jarvis-command-palette';
import { ThemeSwitcher } from './theme-switcher';
import { WslTerminalDrawer } from './wsl-terminal-drawer';
import { AudioSpectrumBar } from './audio-spectrum-bar';
import { ActiveProcessesPanel } from './active-processes-panel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Volume2, VolumeX, ShieldCheck, Cpu, Zap, Flame, Shield, Layers, Radio, Mic, Search, Disc, SlidersHorizontal, Globe, Wrench, Monitor, Terminal, Waves } from 'lucide-react';
import { GodsEyeModal } from './gods-eye-modal';
import { AutoSetupModal } from './auto-setup-modal';
import { WindowsKaliBridgeModal } from './windows-kali-bridge';
import { WisprFlowModal } from './wispr-flow-modal';
import { useWisprFlow } from '@/hooks/use-wispr-flow';
import { type AppMode } from '@/app/page';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { soundFx } from '@/lib/audio-synth';
import { type GeoLocation } from '@/lib/godseye';

interface HUDProps {
  setMode: (mode: AppMode) => void;
  onSelectSession?: (sessionId: string) => void;
}

const HUD = ({ setMode, onSelectSession }: HUDProps) => {
  const { metrics, analysis, isAnalyzing, boostPerformance } = useSystemMetrics();
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(() => soundFx.getMuted());
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHermesConfigOpen, setIsHermesConfigOpen] = useState(false);
  const [isGodsEyeOpen, setIsGodsEyeOpen] = useState(false);
  const [isAutoSetupOpen, setIsAutoSetupOpen] = useState(false);
  const [isWindowsBridgeOpen, setIsWindowsBridgeOpen] = useState(false);
  const [isWisprFlowOpen, setIsWisprFlowOpen] = useState(false);
  const [godsEyeLocation, setGodsEyeLocation] = useState<GeoLocation | null>(null);
  const [godsEyeTarget, setGodsEyeTarget] = useState<string | undefined>(undefined);

  const { isRunning: isWisprRunning } = useWisprFlow({ pollingIntervalMs: 4000 });

  const spawnKaliTerminal = useCallback(async () => {
    soundFx.playClick(1100);
    toast({
      title: "🚀 Spawning Kali Linux Terminal",
      description: "Launching interactive Windows Terminal session on Windows host...",
    });
    try {
      const res = await fetch('/api/system/windows-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch-kali' }),
      });
      const data = await res.json();
      if (data.success) {
        soundFx.playTaskSuccess();
      }
    } catch (e: any) {
      toast({
        title: "Terminal Spawner Notice",
        description: e.message,
        variant: "destructive",
      });
    }
  }, [toast]);
  const [activeJarvisTask, setActiveJarvisTask] = useState<{
    title: string;
    protocol: string;
    steps?: string[];
    logs?: string[];
    isCompleted?: boolean;
    realOutput?: string;
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<'core' | 'telemetry' | 'processes'>('core');

  const toggleSound = useCallback(() => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundFx.playClick(900);
    }
  }, []);

  // Global HUD keyboard shortcuts: [B] Boost, [C] Chat, [M] Mute, [V] Voice HUD, [Ctrl+K] Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        soundFx.playClick(1000);
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        boostPerformance();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        soundFx.playClick(1100);
        setMode('chat');
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        soundFx.playClick(1100);
        setIsVoiceDialogOpen((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleSound();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        soundFx.playClick(1000);
        setIsHermesConfigOpen((prev) => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        soundFx.playClick(1100);
        setIsGodsEyeOpen((prev) => !prev);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        soundFx.playClick(1100);
        setIsAutoSetupOpen((prev) => !prev);
      } else if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        spawnKaliTerminal();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        soundFx.playClick(1000);
        setIsWindowsBridgeOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boostPerformance, setMode, toggleSound, spawnKaliTerminal]);

  // Global listener for 'hermes:open-godseye' custom event
  useEffect(() => {
    const handleGlobalOpenGodsEye = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      setIsGodsEyeOpen(true);
      if (detail?.target && Number.isFinite(Number(detail.target.lat)) && Number.isFinite(Number(detail.target.lon))) {
        const t = detail.target;
        const targetLoc: GeoLocation = {
          name: t.target || t.name || 'OSINT Target',
          lat: Number(t.lat),
          lon: Number(t.lon),
          alt: t.alt ? Number(t.alt) : 1800,
          pitch: t.pitch ? Number(t.pitch) : -45,
          heading: t.heading ? Number(t.heading) : 0,
          formattedAddress: t.address || t.formattedAddress,
          category: t.category,
        };
        setGodsEyeLocation(targetLoc);
        setGodsEyeTarget(t.target || t.name);
      } else if (detail?.query) {
        setGodsEyeTarget(detail.query);
        setGodsEyeLocation(null);
      }
    };

    window.addEventListener('hermes:open-godseye', handleGlobalOpenGodsEye);
    return () => window.removeEventListener('hermes:open-godseye', handleGlobalOpenGodsEye);
  }, []);

  // Global listener for 'hermes:open-task-execution' custom event
  useEffect(() => {
    const handleOpenTaskExecution = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail) {
        setActiveJarvisTask({
          title: detail.title || 'Live Tool Task Execution',
          protocol: detail.protocol || 'STARK PROTOCOL // NEMOTRON-3 TOOL INFERENCE',
          isCompleted: detail.isCompleted ?? false,
          realOutput: detail.realOutput,
          steps: detail.steps,
          logs: detail.logs,
        });
      }
    };

    window.addEventListener('hermes:open-task-execution', handleOpenTaskExecution);
    return () => window.removeEventListener('hermes:open-task-execution', handleOpenTaskExecution);
  }, []);

  const runProtocol = async (title: string, protocol: string, query?: string) => {
    soundFx.playTaskStart();
    const isBoost = protocol.includes('BOOST');

    setActiveJarvisTask({
      title,
      protocol,
      steps: isBoost
        ? [
            'DISK BUFFER SYNC (FLUSH DIRTY PAGES)',
            'SQLITE WAL CHECKPOINT (COMPACT state.db)',
            'PURGE EXPIRED AUDIO SYNTHESIS CACHE BLOCKS',
            'EXECUTE NODE.JS V8 GARBAGE COLLECTION',
            'RESTORE NOMINAL THERMAL DISSIPATION',
          ]
        : [
            'SPAWN ISOLATED SUBPROCESS (uv Python 3.14.7)',
            'ATTACH KALI WSL2 SOCKETS & PERIMETER',
            'LOAD 61 SPECIALIZED SKILLS (PENTEST, OSINT)',
            'ENGAGE NEMOTRON-3 ULTRA 550B INFERENCE',
            'PARSE OUTPUT & SYNCHRONIZE TELEMETRY',
          ],
    });

    if (isBoost) {
      boostPerformance();
      setTimeout(() => {
        setActiveJarvisTask((prev) =>
          prev
            ? {
                ...prev,
                isCompleted: true,
                realOutput:
                  'Hyper-Boost sequence complete. Dirty disk pages flushed, SQLite WAL checkpointed, expired audio cache purged, V8 garbage collected, and nominal thermal dissipation restored in WSL.',
                logs: [
                  `[${new Date().toISOString().slice(11, 19)}] PROTOCOL_FINISH: 200 OK`,
                  `[${new Date().toISOString().slice(11, 19)}] THERMAL: Nominal dissipation restored`,
                ],
              }
            : null
        );
      }, 3800);
      return;
    }

    if (query) {
      try {
        const res = await fetch('/api/hermes/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query }),
        });
        const data = await res.json();
        soundFx.playMessagePing();
        setActiveJarvisTask((prev) =>
          prev
            ? {
                ...prev,
                isCompleted: true,
                realOutput: data.content || 'Protocol executed successfully in WSL.',
                logs: [
                  `[${new Date().toISOString().slice(11, 19)}] PROTOCOL_FINISH: 200 OK`,
                  `[${new Date().toISOString().slice(11, 19)}] OUTPUT: ${(data.content || '').slice(0, 120)}...`,
                ],
              }
            : null
        );
      } catch (err: any) {
        setActiveJarvisTask((prev) =>
          prev
            ? {
                ...prev,
                isCompleted: true,
                realOutput: `Protocol error encountered: ${err.message}`,
                logs: [`[ERROR] ${err.message}`],
              }
            : null
        );
      }
    }
  };

  const boostOverlayClass = cn(
    "fixed inset-0 z-50 pointer-events-none transition-opacity duration-1000",
    {
      'opacity-0': metrics.boostStatus === 'idle' || metrics.boostStatus === 'cooling',
      'opacity-100 animate-boost-flash': metrics.boostStatus === 'boosting',
    }
  );

  return (
    <div className="relative h-screen w-screen p-2 sm:p-2.5 md:p-3 xl:p-3.5 animate-fade-in font-headline text-primary/90 overflow-hidden">
      {/* Boost screen fx */}
      <div
        className={boostOverlayClass}
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--primary) / 0.35) 0%, transparent 65%)',
        }}
      />
      <div
        className={cn(
          "fixed inset-0 z-[60] pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_55%,_black_100%)] opacity-0",
          {
            'animate-vignette-pulse': metrics.boostStatus === 'boosting',
          }
        )}
      />

      {/* Cybernetic Scanlines */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25" />

      <div className="h-full w-full flex flex-col justify-between relative z-20 overflow-hidden">
        {/* Top Header Toolbar */}
        <header className="w-full flex items-center justify-between gap-1.5 sm:gap-3 pb-1.5 border-b border-primary/15 shrink-0 relative z-30">
          {/* Left: Clock & Subsystem Status */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-fit">
            <Clock />
            <div className="hidden 2xl:flex items-center gap-2 rounded-md border border-primary/20 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="font-mono text-[10px] text-primary/80">GATEWAY: ACTIVE (PID 358)</span>
            </div>
            <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-0.5 rounded border border-primary/20 bg-background/50 text-[9px] font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
              <span>WSL2 KALI // AMD 7520U</span>
            </div>
          </div>

          {/* Center: Holographic Core Status Pill (Only on extra wide screens) */}
          <div className="hidden 2xl:flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3.5 py-1 backdrop-blur-md shadow-[0_0_15px_hsl(var(--primary)/0.15)] shrink-0">
            <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
            <span className="text-xs font-bold tracking-[0.2em] text-foreground">
              HERMES // WSL CORE
            </span>
            <span className="text-[10px] text-accent font-mono">v0.21.6</span>
          </div>

          {/* Right: Streamlined Cyber Action Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0 max-w-full py-0.5 overflow-x-auto scrollbar-none">
            {/* Quick J.A.R.V.I.S. Command Palette Launcher */}
            <button
              onClick={() => {
                soundFx.playClick(1000);
                setIsCommandPaletteOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-background/60 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-accent hover:border-accent hover:shadow-[0_0_15px_hsl(var(--primary)/0.25)] transition-all shrink-0 cursor-pointer"
              title="Search Commands & Protocols [Ctrl+K]"
            >
              <Search size={13} className="text-primary" />
              <span className="hidden 2xl:inline text-[11px]">COMMANDS</span>
              <kbd className="hidden 2xl:inline-block px-1 py-0.2 text-[9px] bg-primary/10 border border-primary/20 rounded text-accent font-bold">
                ⌘K
              </kbd>
            </button>

            {/* Holographic Armor Theme */}
            <ThemeSwitcher />

            {/* Kali WSL2 Live Terminal */}
            <WslTerminalDrawer />

            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className="flex items-center justify-center h-8 w-8 rounded-md border border-primary/25 bg-background/60 text-xs transition-all hover:bg-primary/20 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] shrink-0"
              title={isMuted ? 'Unmute Futuristic Sounds [M]' : 'Mute Futuristic Sounds [M]'}
            >
              {isMuted ? <VolumeX size={14} className="text-muted-foreground" /> : <Volume2 size={14} className="text-accent" />}
            </button>

            {/* Marvel Jarvis Protocols Launcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={() => soundFx.playClick(1000)}
                  className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-accent transition-all hover:bg-accent/25 hover:border-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.35)] shrink-0"
                  title="Launch Marvel Stark / Hermes Execution Protocols"
                >
                  <Zap size={13} className="text-accent animate-pulse" />
                  <span className="hidden 2xl:inline text-xs">PROTOCOLS</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-[85vh] overflow-y-auto pb-4 scrollbar-thin border-primary/40 bg-background/95 backdrop-blur-xl text-primary font-mono text-xs shadow-[0_0_30px_hsl(var(--primary)/0.3)] z-[80]">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground tracking-widest font-mono">
                  STARK MARK-XV // PROTOCOLS
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/20" />
                <DropdownMenuItem
                  onClick={() => runProtocol('WSL Perimeter & Port Security Audit', 'PROTOCOL: KALI_SECURITY_AUDIT', 'Perform a quick security audit of current ports and network interface in WSL.')}
                  className="cursor-pointer hover:bg-primary/20 hover:text-accent flex items-center gap-2 py-2"
                >
                  <Shield size={14} className="text-accent" />
                  <span>🛡️ Audit Ports & Security</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => runProtocol('Verify 61 Arsenal Skills Matrix', 'PROTOCOL: SKILL_ARSENAL_VERIFY', 'List your top active cybersecurity and automation skills loaded in this environment.')}
                  className="cursor-pointer hover:bg-primary/20 hover:text-accent flex items-center gap-2 py-2"
                >
                  <Layers size={14} className="text-emerald-400" />
                  <span>🎯 Verify 61 Skills Matrix</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => runProtocol('Deep WSL Subsystem Diagnostics', 'PROTOCOL: SYSTEM_DIAGNOSTICS', 'Check current memory, CPU usage, and top running WSL processes.')}
                  className="cursor-pointer hover:bg-primary/20 hover:text-accent flex items-center gap-2 py-2"
                >
                  <Cpu size={14} className="text-primary" />
                  <span>⚡ Deep System Diagnostics</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => runProtocol('Hermes Gateway Telemetry Probe', 'PROTOCOL: HERMES_GATEWAY_PROBE', 'Inspect status of Hermes gateway PID 358 and messaging channels.')}
                  className="cursor-pointer hover:bg-primary/20 hover:text-accent flex items-center gap-2 py-2"
                >
                  <Radio size={14} className="text-accent" />
                  <span>📡 Probe Gateway Telemetry</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    soundFx.playClick(1000);
                    setIsHermesConfigOpen(true);
                  }}
                  className="cursor-pointer hover:bg-primary/20 hover:text-accent flex items-center gap-2 py-2"
                >
                  <SlidersHorizontal size={14} className="text-accent" />
                  <span>⚙️ Hermes Configurations Matrix</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    soundFx.playClick(1000);
                    setIsAutoSetupOpen(true);
                  }}
                  className="cursor-pointer hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center gap-2 py-2 text-emerald-400 font-bold"
                >
                  <Wrench size={14} className="text-emerald-400" />
                  <span>⚡ Autonomous Auto-Setup &amp; Self-Heal</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => spawnKaliTerminal()}
                  className="cursor-pointer hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center gap-2 py-2 text-emerald-400 font-bold"
                >
                  <Terminal size={14} className="text-emerald-400" />
                  <span>🚀 Spawn Kali Linux Shell (Win Host) [K]</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    soundFx.playClick(1000);
                    setIsWindowsBridgeOpen(true);
                  }}
                  className="cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-400 flex items-center gap-2 py-2 text-cyan-400 font-bold"
                >
                  <Monitor size={14} className="text-cyan-400" />
                  <span>🪟 Windows Host &amp; Subsystems [W]</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-primary/20" />
                <DropdownMenuItem
                  onClick={() => runProtocol('Reactor Overclock & Memory Purge', 'PROTOCOL: HYPER_BOOST')}
                  className="cursor-pointer hover:bg-destructive/20 hover:text-destructive text-destructive font-bold flex items-center gap-2 py-2"
                >
                  <Flame size={14} className="text-destructive animate-pulse" />
                  <span>🔥 Reactor Overclock Surge</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Hermes Configurations Matrix Modal */}
            <HermesConfigModal open={isHermesConfigOpen} onOpenChange={setIsHermesConfigOpen} />

            {/* Hermes Telemetry Drawer */}
            <HermesDrawer
              onSelectSession={onSelectSession}
              onOpenConfig={() => setIsHermesConfigOpen(true)}
            />

            {/* System Settings & WSL Config */}
            <SystemSettingsModal onOpenConfig={() => setIsHermesConfigOpen(true)} />

            {/* Voice HUD Launcher */}
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setIsVoiceDialogOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-accent transition-all hover:bg-accent/25 hover:border-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.35)] shrink-0"
              title="Open Hermes Voice Interaction HUD [V]"
            >
              <Mic size={13} className="text-accent animate-pulse" />
              <span className="hidden 2xl:inline text-xs">VOICE HUD</span>
            </button>

            {/* Wispr Flow Windows Engine */}
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setIsWisprFlowOpen(true);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 sm:px-2.5 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
                isWisprRunning
                  ? "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25 hover:shadow-[0_0_15px_hsl(var(--accent)/0.35)]"
                  : "border-primary/25 bg-background/60 text-muted-foreground hover:bg-primary/20 hover:text-accent"
              )}
              title="Wispr Flow Windows Engine & Real-time Dictation Stream [Caps Lock]"
            >
              <Waves size={13} className={isWisprRunning ? "text-accent animate-pulse" : ""} />
              <span className="hidden 2xl:inline text-xs font-mono">WISPR FLOW</span>
            </button>

            {/* God's Eye 3D Satellite & OSINT Launcher */}
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setIsGodsEyeOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/20 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-accent transition-all hover:bg-accent hover:text-accent-foreground hover:shadow-[0_0_18px_hsl(var(--accent)/0.4)] shrink-0 cursor-pointer"
              title="Open God's Eye View 3D Globe & OSINT Satellite Console (~/gods-eye-view) [G]"
            >
              <Globe size={13} className="text-accent animate-spin" style={{ animationDuration: '20s' }} />
              <span className="hidden 2xl:inline text-xs font-bold">GOD&apos;S EYE</span>
            </button>

            {/* Autonomous Setup & Self-Healing Launcher */}
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setIsAutoSetupOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/25 hover:border-emerald-400 hover:shadow-[0_0_18px_hsl(142_71%_45%/0.4)] shrink-0 cursor-pointer"
              title="Open Autonomous System Diagnostics & Self-Healing Center [A]"
            >
              <Wrench size={13} className="text-emerald-400 animate-pulse" />
              <span className="hidden 2xl:inline text-xs font-bold">AUTO-SETUP</span>
            </button>

            {/* Windows Host & Kali Linux Multi-Window Launcher */}
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setIsWindowsBridgeOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-cyan-400 transition-all hover:bg-cyan-500/25 hover:border-cyan-400 hover:shadow-[0_0_18px_hsl(180_100%_50%/0.4)] shrink-0 cursor-pointer"
              title="Open Windows Host & Kali Linux Orchestrator [W] / Press [K] to Spawn Kali Terminal"
            >
              <Monitor size={13} className="text-cyan-400" />
              <span className="hidden 2xl:inline text-xs font-bold">WIN / KALI</span>
            </button>

            {/* Switch to Chat Mode */}
            <button
              onClick={() => {
                soundFx.playClick(1100);
                setMode('chat');
              }}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/25 px-2.5 py-1.5 text-xs font-bold text-accent transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_18px_hsl(var(--primary))] shrink-0"
              title="Switch to Hermes Chat Mode [C]"
            >
              <MessageSquare size={13} />
              <span className="text-xs font-bold">CHAT</span>
            </button>
          </div>
        </header>

        {/* Responsive Workspace Switcher for Tablet & Mobile (< 1280px) */}
        <div className="flex xl:hidden items-center justify-center gap-1.5 py-1 px-2 rounded-xl border border-primary/25 bg-background/80 backdrop-blur-md shrink-0 z-30 mx-auto my-1 shadow-sm">
          <button
            onClick={() => {
              soundFx.playClick(900);
              setMobileTab('core');
            }}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              mobileTab === 'core'
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
            )}
          >
            <Disc size={13} className={mobileTab === 'core' ? 'animate-spin' : ''} />
            <span>ARC CORE</span>
          </button>
          <button
            onClick={() => {
              soundFx.playClick(900);
              setMobileTab('telemetry');
            }}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              mobileTab === 'telemetry'
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
            )}
          >
            <Cpu size={13} />
            <span>TELEMETRY</span>
          </button>
          <button
            onClick={() => {
              soundFx.playClick(900);
              setMobileTab('processes');
            }}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              mobileTab === 'processes'
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
            )}
          >
            <Layers size={13} />
            <span>PROCESSES</span>
          </button>
        </div>

        {/* Middle Core Workspace */}
        <main className="w-full flex-1 flex flex-col xl:flex-row items-center justify-between gap-2.5 xl:gap-4 py-0.5 min-h-0 overflow-hidden">
          {/* Left Column: Live Hardware Telemetry */}
          <div className={cn(
            "shrink-0 flex items-center justify-center xl:justify-start w-full xl:w-auto",
            mobileTab !== 'telemetry' && "hidden xl:flex"
          )}>
            <SystemMetricsDisplay metrics={metrics} />
          </div>

          {/* Center Column: 3D Holographic Central Core */}
          <div className={cn(
            "flex-1 flex items-center justify-center w-full min-h-[260px]",
            mobileTab !== 'core' && "hidden xl:flex"
          )}>
            <CentralCore
              isDialogOpen={isVoiceDialogOpen}
              setIsDialogOpen={setIsVoiceDialogOpen}
              onOpenChatWithSession={(sessionId) => {
                if (sessionId && onSelectSession) {
                  onSelectSession(sessionId);
                }
                setMode('chat');
              }}
            />
          </div>

          {/* Right Column: Host Specs & Active Sub-processes */}
          <div className={cn(
            "shrink-0 flex items-center justify-center xl:justify-end w-full xl:w-auto",
            mobileTab !== 'processes' && "hidden xl:flex"
          )}>
            <div className="flex flex-col sm:flex-row xl:flex-col gap-1.5 sm:gap-2 w-full sm:w-auto xl:w-72 justify-center">
              <InfoListPanel
                title="Host Environment (WSL2)"
                items={Object.entries(metrics.specs).map(([key, value]) => `${key.toUpperCase()}: ${value}`)}
              />
              <ActiveProcessesPanel
                processes={
                  metrics.topProcesses && metrics.topProcesses.length > 0
                    ? metrics.topProcesses
                    : metrics.openedApps.map((app) => ({
                        pid: app.match(/PID (\d+)/)?.[1] || '0',
                        name: app.replace(/\s*\(PID \d+\)/, ''),
                        cpu: '0.4%',
                        mem: '2.1%',
                      }))
                }
              />
            </div>
          </div>
        </main>

        {/* Bottom Telemetry & Controls Footer */}
        <footer className="w-full flex flex-col md:flex-row items-center md:items-end justify-between gap-2 sm:gap-2.5 lg:gap-3 pt-1.5 border-t border-primary/10 shrink-0">
          {/* Bottom Left: Reactor Hyper-Boost */}
          <div className="flex flex-col gap-0.5 shrink-0 w-full sm:w-auto items-center sm:items-start">
            <BoostButton boostStatus={metrics.boostStatus} onClick={boostPerformance} />
            <span className="text-[9px] text-muted-foreground font-mono pl-1 hidden sm:inline">
              REACTOR OVERCLOCK // TEMPORARY SURGE [B]
            </span>
          </div>

          {/* Bottom Center: Quantum Audio/Activity Spectrum & Telemetry Status */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1 w-full max-w-lg mx-auto">
            <AudioSpectrumBar className="w-full" label="WINDOWS AUDIO [OUTPUT / INPUT]" intensity={metrics.cpuUsage / 100} />
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-mono text-muted-foreground whitespace-nowrap overflow-hidden">
              <span>UPTIME: <strong className="text-accent">{metrics.uptime || '2h 15m'}</strong></span>
              <span>•</span>
              <span>LOAD: <strong className="text-accent">{metrics.loadAverage?.split(',').slice(0, 2).join(',') || '0.42, 0.38'}</strong></span>
              <span>•</span>
              <span>WSL: <strong className="text-accent">KALI</strong></span>
              <span>•</span>
              <span>SEC: <strong className="text-emerald-400 font-bold">ARMED</strong></span>
              <span>•</span>
              <span>PWR: <strong className="text-accent">ONLINE</strong></span>
            </div>
          </div>

          {/* Bottom Right: Intelligence Assessment Panel */}
          <div className="shrink-0 flex items-center sm:items-end justify-center sm:justify-end w-full sm:w-auto">
            <SystemAnalysisPanel
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              onRunProtocol={runProtocol}
              onBoost={boostPerformance}
              onOpenConfig={() => setIsHermesConfigOpen(true)}
            />
          </div>
        </footer>
      </div>

      {/* Marvel J.A.R.V.I.S. Smart Task Execution & Debrief Screen */}
      <JarvisExecutionScreen
        isOpen={metrics.boostStatus === 'boosting' || !!activeJarvisTask}
        taskTitle={activeJarvisTask?.title || "REACTOR OVERCLOCK & WSL HEAP PURGE"}
        protocolName={activeJarvisTask?.protocol || "PROTOCOL: STARK_HYPER_BOOST"}
        steps={activeJarvisTask?.steps}
        logs={activeJarvisTask?.logs}
        isCompleted={activeJarvisTask?.isCompleted}
        realOutput={activeJarvisTask?.realOutput}
        onOpenChat={(sid) => {
          if (sid && onSelectSession) onSelectSession(sid);
          setMode('chat');
        }}
        onAbort={() => {
          soundFx.playJarvisAlert();
          setActiveJarvisTask(null);
        }}
        onClose={() => setActiveJarvisTask(null)}
      />

      {/* Marvel J.A.R.V.I.S. Command & Protocol Palette [Ctrl+K] */}
      <JarvisCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setMode={setMode}
        onRunProtocol={runProtocol}
        onBoost={boostPerformance}
        onOpenVoice={() => setIsVoiceDialogOpen(true)}
        onOpenTerminal={() => {
          const btn = document.querySelector('button[title*="Terminal"]') as HTMLButtonElement | null;
          if (btn) btn.click();
        }}
        onOpenSettings={() => {
          const btn = document.querySelector('button[title*="Settings"]') as HTMLButtonElement | null;
          if (btn) btn.click();
        }}
        onOpenConfig={() => setIsHermesConfigOpen(true)}
        onToggleSound={toggleSound}
        isMuted={isMuted}
      />

      {/* God's Eye View 3D OSINT Console Modal */}
      <GodsEyeModal
        isOpen={isGodsEyeOpen}
        onClose={() => {
          setIsGodsEyeOpen(false);
          setGodsEyeLocation(null);
          setGodsEyeTarget(undefined);
        }}
        initialLocation={godsEyeLocation}
        targetQuery={godsEyeTarget}
      />
      {/* Autonomous System Diagnostics & Self-Healing Modal */}
      <AutoSetupModal
        isOpen={isAutoSetupOpen}
        onClose={() => setIsAutoSetupOpen(false)}
      />

      {/* Windows Host & Kali Linux Multi-Window Orchestrator */}
      <WindowsKaliBridgeModal
        isOpen={isWindowsBridgeOpen}
        onOpenChange={setIsWindowsBridgeOpen}
        onTriggerAutoSetup={() => setIsAutoSetupOpen(true)}
      />

      {/* Wispr Flow Windows Engine Modal */}
      <WisprFlowModal
        isOpen={isWisprFlowOpen}
        onClose={() => setIsWisprFlowOpen(false)}
        onSelectPrompt={(text) => {
          setMode('chat');
        }}
      />
    </div>
  );
};

export default HUD;
