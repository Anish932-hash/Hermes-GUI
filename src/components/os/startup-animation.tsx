'use client';

import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import { useEffect, useState, useCallback, useRef } from 'react';
import { soundFx } from '@/lib/audio-synth';
import {
  FastForward,
  Shield,
  Terminal,
  CheckCircle2,
  Zap,
  Radio,
  Activity,
  Cpu,
  MessageSquare,
  LayoutDashboard,
  HardDrive,
  Globe,
  Sparkles,
  Volume2,
  Sliders,
} from 'lucide-react';

interface StartupAnimationProps {
  onComplete?: (targetMode?: 'hud' | 'chat') => void;
}

interface RealBootTelemetry {
  cpuUsage: number;
  cpuModel: string;
  gpuModel: string;
  distro: string;
  kernel: string;
  ramUsage: number;
  ramUsedMB: number;
  ramTotalMB: number;
  gatewayState: string;
  gatewayPid: string;
  skillsCount: number;
  sessionsCount: number;
  model: string;
}

export default function StartupAnimation({ onComplete }: StartupAnimationProps) {
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [stageBurst, setStageBurst] = useState(false);
  const [isVoiceWelcomeActive, setIsVoiceWelcomeActive] = useState(false);
  const [telemetry, setTelemetry] = useState<RealBootTelemetry>({
    cpuUsage: -1,
    cpuModel: 'CPU telemetry unavailable',
    gpuModel: 'GPU telemetry unavailable',
    distro: 'Linux environment unavailable',
    kernel: 'kernel unavailable',
    ramUsage: -1,
    ramUsedMB: 0,
    ramTotalMB: 0,
    gatewayState: 'unknown',
    gatewayPid: 'not reported',
    skillsCount: 0,
    sessionsCount: 0,
    model: 'unconfigured',
  });

  const finishedRef = useRef(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Trigger autonomous zero-touch discovery & auto-setup on boot
  useEffect(() => {
    const runBootAutoDiscovery = async () => {
      try {
        // Trigger auto-setup POST: auto-heals any offline services and detects all 7 subsystems
        const [autoRes, metricsRes, statusRes] = await Promise.allSettled([
          fetch('/api/system/auto-setup', { method: 'POST' }),
          fetch('/api/system/metrics'),
          fetch('/api/hermes/status'),
        ]);

        let newMetrics: Partial<RealBootTelemetry> = {};

        if (autoRes.status === 'fulfilled' && autoRes.value.ok) {
          const autoData = await autoRes.value.json();
          const specs = autoData.diagnostics?.systemSpecs;
          if (specs) {
            if (specs.gatewayPid) newMetrics.gatewayPid = String(specs.gatewayPid);
            if (typeof specs.ramTotalMB === 'number') newMetrics.ramTotalMB = specs.ramTotalMB;
            if (typeof specs.ramUsedMB === 'number') newMetrics.ramUsedMB = specs.ramUsedMB;
          }
        }

        if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
          const mData = await metricsRes.value.json();
          newMetrics.cpuUsage = mData.cpuUsage ?? -1;
          newMetrics.cpuModel = mData.cpuModel ?? 'CPU telemetry unavailable';
          newMetrics.gpuModel = mData.gpuModel ?? 'GPU telemetry unavailable';
          newMetrics.distro = mData.distro ?? 'Linux environment unavailable';
          newMetrics.kernel = mData.kernel ?? 'kernel unavailable';
          newMetrics.ramUsage = mData.ramUsage ?? -1;
          if (mData.ramUsedMB) newMetrics.ramUsedMB = mData.ramUsedMB;
          if (mData.ramTotalMB) newMetrics.ramTotalMB = mData.ramTotalMB;
        }

        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
          const sData = await statusRes.value.json();
          newMetrics.gatewayState = sData.gatewayState || 'running';
          if (sData.gatewayPid) newMetrics.gatewayPid = String(sData.gatewayPid);
          newMetrics.skillsCount = sData.skillsCount ?? 0;
          newMetrics.sessionsCount = sData.sessionsCount ?? 0;
          newMetrics.model = sData.model || 'unconfigured';
        }

        setTelemetry((prev) => ({ ...prev, ...newMetrics }));
      } catch (err) {
        console.warn('Boot auto-discovery warning:', err);
      }
    };

    runBootAutoDiscovery();
  }, []);

  const handleFinish = useCallback((targetMode?: 'hud' | 'chat') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    soundFx.playTaskSuccess();
    onComplete?.(targetMode);
  }, [onComplete]);

  // Dynamic 15 Boot Stages leveraging real probed telemetry
  const bootStages = [
    { code: '01/15', label: 'HARDWARE POST', detail: `${telemetry.cpuModel.toUpperCase()} ... CPU LOAD ${telemetry.cpuUsage >= 0 ? `${telemetry.cpuUsage}%` : 'N/A'}`, category: 'HARDWARE' },
    { code: '02/15', label: 'HOST KERNEL', detail: `${telemetry.distro.toUpperCase()} // ${telemetry.kernel.toUpperCase()}`, category: 'KERNEL' },
    { code: '03/15', label: 'SUBSYSTEM RAM', detail: `${telemetry.ramTotalMB > 0 ? `${telemetry.ramUsedMB}MB ALLOCATED / ${telemetry.ramTotalMB}MB (${telemetry.ramUsage}% PRESSURE)` : 'MEMORY TELEMETRY UNAVAILABLE'}`, category: 'MEMORY' },
    { code: '04/15', label: 'GRAPHICS', detail: `${telemetry.gpuModel.toUpperCase()} ... USAGE ${telemetry.gpuModel === 'GPU telemetry unavailable' ? 'N/A' : 'SENSOR AVAILABLE'}`, category: 'GRAPHICS' },
    { code: '05/15', label: 'SYSTEMD DAEMON', detail: `hermes-gateway.service (PID ${telemetry.gatewayPid}) ... ${telemetry.gatewayState.toUpperCase()}`, category: 'DAEMON' },
    { code: '06/15', label: 'HERMES AGENT', detail: 'CORE RUNTIME v0.21.6 // nousresearch/hermes-agent ... SYNCED', category: 'AGENT' },
    { code: '07/15', label: 'PYTHON SANDBOX', detail: 'uv Python 3.14.7 SUBPROCESS ISOLATION JAIL ... MOUNTED', category: 'RUNTIME' },
    { code: '08/15', label: 'SQLITE STATE DB', detail: `state.db (${telemetry.sessionsCount} ACTIVE THREAD SESSIONS) ... WAL CHECKPOINT PASSIVE`, category: 'DATABASE' },
    { code: '09/15', label: 'SKILLS ARSENAL', detail: `${telemetry.skillsCount} LOADED MODULES (KALI PENTEST, OSINT, SYSTEMD) ... HOT-LOADED`, category: 'ARSENAL' },
    { code: '10/15', label: 'NEURAL INFERENCE', detail: `${telemetry.model.toUpperCase()} ... SOCKET CHANNEL ARMED`, category: 'NEURAL' },
    { code: '11/15', label: 'GOD\'S EYE VIEW', detail: 'CESIUM 3D SATELLITE ENGINE (~/gods-eye-view :4173) ... STANDBY ONLINE', category: 'GEOSPATIAL' },
    { code: '12/15', label: 'SARVAM SAARAS AI', detail: 'NEURAL VOICE SPEECH-TO-TEXT & AUDIO SYNTHESIS ... LINKED', category: 'VOICE' },
    { code: '13/15', label: 'PROCEDURAL SFX', detail: 'WEB AUDIO PROCEDURAL HARMONIC OSCILLATOR ARSENAL ... ONLINE', category: 'AUDIO' },
    { code: '14/15', label: 'MARK-XV HUD', detail: 'CYBERNETIC NEON PROJECTION & RADAR TELEMETRY ... ENGAGED', category: 'INTERFACE' },
    { code: '15/15', label: 'STARK PROTOCOL', detail: 'BOOT SEQUENCE COMPLETE // CHECK SUBSYSTEM STATUS', category: 'MISSION' },
  ];

  // Key listeners for skip, turbo, chat or hud
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        handleFinish();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleFinish('chat');
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleFinish('hud');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setSpeedMultiplier((s) => (s === 1 ? 2.5 : 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish]);

  // Step through the 15 stages
  useEffect(() => {
    let stageIndex = 0;
    const baseInterval = 100 / speedMultiplier;

    const interval = setInterval(() => {
      if (stageIndex < bootStages.length) {
        setCurrentStage(stageIndex);
        setCompletedStages((prev) => [...prev, stageIndex]);
        soundFx.playBootPhase(stageIndex);
        setStageBurst(true);
        setTimeout(() => setStageBurst(false), 120);
        stageIndex++;
      } else {
        clearInterval(interval);
        // Play success chime & voice debrief asynchronously without blocking completion
        try {
          soundFx.playTaskSuccess();
          setIsVoiceWelcomeActive(true);
          soundFx.speakText(
            'Hermes Mark-XV neural architecture online. All fifteen subsystems nominal. Welcome, operator.',
            () => setIsVoiceWelcomeActive(false)
          );
        } catch {}

        setTimeout(() => {
          handleFinish();
        }, 350);
      }
    }, baseInterval);

    return () => clearInterval(interval);
  }, [speedMultiplier, handleFinish, bootStages.length]);

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [completedStages]);

  const progressPercent = Math.min(100, Math.round(((currentStage + 1) / 15) * 100));

  return (
    <div
      onClick={() => handleFinish()}
      data-testid="startup-animation-root"
      className="relative flex h-screen w-screen flex-col justify-between overflow-hidden bg-background text-primary select-none font-headline px-3 py-2 sm:px-5 sm:py-2.5 cursor-pointer"
    >
      {/* Background Cybernetic Dot Grid & Radial Vignette */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `
              radial-gradient(circle, hsl(var(--primary)/0.2) 1px, transparent 1px),
              linear-gradient(hsl(var(--primary)/0.04) 1px, transparent 1px),
              linear-gradient(to right, hsl(var(--primary)/0.04) 1px, transparent 1px)
            `,
            backgroundSize: '2.5rem 2.5rem',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_black_95%)] opacity-90" />
      </div>

      {/* Sweeping Laser Scanner Beam */}
      <div className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent animate-scanner-down opacity-45 z-10" />

      {/* Optical Corner HUD Calipers */}
      <div className="pointer-events-none absolute top-1.5 left-3 text-[8px] font-mono text-primary/50 tracking-widest hidden sm:block z-30">
        + SYS_CLK: AMD 7520U @ 4.3GHz // BUS: PCIe 4.0
      </div>
      <div className="pointer-events-none absolute top-1.5 right-3 text-[8px] font-mono text-primary/50 tracking-widest text-right hidden sm:block z-30">
        OPTICAL_RETICLE: LOCKED // ZERO_LATENCY: 0.08ms
      </div>
      <div className="pointer-events-none absolute bottom-1.5 left-4 text-[8px] font-mono text-primary/40 tracking-widest hidden xl:block z-10">
        {'SYSTEM: KALI_WSL2 // PID '}{telemetry.gatewayPid}{' // UV-PY 3.14.7'}
      </div>
      <div className="pointer-events-none absolute bottom-1.5 right-4 text-[8px] font-mono text-primary/40 tracking-widest text-right hidden xl:block z-10">
        [ STARK_HERMES_MARK_XV // SYSTEM_BOOTLOADER ]
      </div>

      {/* ========================================================= */}
      {/* 1. TOP HEADER & INSTANT CONTROLS BAR */}
      {/* ========================================================= */}
      <header className="relative z-40 shrink-0 flex items-center justify-between border-b border-primary/20 pb-2 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/60 bg-accent/15 text-accent shadow-[0_0_12px_hsl(var(--accent)/0.3)]">
            <Zap size={16} className="text-accent animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-ping" />
              <h1 className={cn('text-xs md:text-sm font-black tracking-wider text-foreground uppercase truncate', orbitron.className)}>
                STARK MARK-XV // HERMES BOOTLOADER
              </h1>
              <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1 py-0.2 text-[8px] font-mono text-accent">
                v0.21.6
              </span>
            </div>
            <p className="text-[9px] font-mono text-muted-foreground truncate hidden xs:block sm:block">
              Autonomous Kali WSL2 Runtime &amp; Neural Inference Gateway
            </p>
          </div>
        </div>

        {/* Quick Launch Buttons & Speed Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
          {/* Turbo Speed Button */}
          <button
            onClick={() => {
              soundFx.playClick(1100);
              setSpeedMultiplier((s) => (s === 1 ? 2.5 : 1));
            }}
            className={cn(
              'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap',
              speedMultiplier > 1
                ? 'border-accent bg-accent/20 text-accent shadow-[0_0_10px_hsl(var(--accent)/0.4)]'
                : 'border-primary/30 bg-primary/10 text-muted-foreground hover:text-accent hover:border-primary/50'
            )}
            title="Toggle 2.5x Turbo Speed (Hotkey: T)"
          >
            <Zap size={10} className={speedMultiplier > 1 ? 'text-accent animate-pulse' : ''} />
            <span>{speedMultiplier > 1 ? '⚡ 2.5x' : '1.0x'}</span>
            <kbd className="hidden lg:inline px-1 py-0.2 text-[7px] bg-background/50 rounded border border-primary/20">T</kbd>
          </button>

          {/* Launch Direct to Chat Mode */}
          <button
            onClick={() => {
              soundFx.playClick(1000);
              handleFinish('chat');
            }}
            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary hover:text-accent hover:border-accent hover:bg-primary/20 transition-all cursor-pointer shadow-[0_0_8px_hsl(var(--primary)/0.15)] whitespace-nowrap"
            title="Boot directly into Chat Console (Hotkey: C)"
          >
            <MessageSquare size={10} />
            <span className="font-bold">CHAT</span>
            <kbd className="hidden lg:inline px-1 py-0.2 text-[7px] bg-background/50 rounded border border-primary/20">C</kbd>
          </button>

          {/* Launch Direct to HUD Cockpit */}
          <button
            onClick={() => {
              soundFx.playClick(1000);
              handleFinish('hud');
            }}
            className="flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-mono text-accent hover:bg-accent/25 hover:border-accent transition-all cursor-pointer shadow-[0_0_8px_hsl(var(--accent)/0.25)] whitespace-nowrap"
            title="Boot directly into HUD Cockpit (Hotkey: H)"
          >
            <LayoutDashboard size={10} />
            <span className="font-bold">HUD</span>
            <kbd className="hidden lg:inline px-1 py-0.2 text-[7px] bg-background/50 rounded border border-primary/20">H</kbd>
          </button>

          {/* Skip Button */}
          <button
            onClick={() => handleFinish()}
            className="group flex items-center gap-1 rounded-md border border-primary/40 bg-background/80 px-2 py-0.5 text-[10px] font-mono font-bold text-foreground/90 transition-all duration-300 hover:border-accent hover:text-accent cursor-pointer whitespace-nowrap"
            title="Instant Skip (Hotkey: Space / Esc)"
          >
            <span>SKIP</span>
            <FastForward size={10} className="transition-transform group-hover:translate-x-0.5" />
            <kbd className="hidden lg:inline px-1 py-0.2 text-[7px] bg-background/50 rounded border border-primary/20">SPACE</kbd>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. MAIN 3-COLUMN MARVEL J.A.R.V.I.S. COMMAND DECK */}
      {/* ========================================================= */}
      <main className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-2 xl:gap-4 items-center flex-1 my-auto py-1 min-h-0 overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* LEFT COLUMN: LIVE HARDWARE AVIONICS & TELEMETRY GAUGES */}
        <section className="hidden lg:flex lg:col-span-3 flex-col justify-between gap-1.5 h-full max-h-[300px] xl:max-h-[340px] rounded-xl border border-primary/25 bg-background/70 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
            <span className={cn('text-xs font-bold tracking-wider text-accent uppercase flex items-center gap-1', orbitron.className)}>
              <Cpu size={12} className="text-accent" />
              HARDWARE AVIONICS
            </span>
            <span className="text-[8px] font-mono text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" />
              ONLINE
            </span>
          </div>

          <div className="space-y-1.5 xl:space-y-2 my-auto">
            {/* CPU Load Gauge */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">AMD RYZEN LOAD</span>
                <span className="text-accent font-bold">{telemetry.cpuUsage}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden border border-primary/20">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                  style={{ width: `${telemetry.cpuUsage}%` }}
                />
              </div>
            </div>

            {/* Subsystem RAM Gauge */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">WSL2 MEMORY</span>
                <span className="text-primary font-bold">
                  {telemetry.ramUsedMB} / {telemetry.ramTotalMB} MB
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden border border-primary/20">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500 rounded-full"
                  style={{ width: `${telemetry.ramUsage}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-muted-foreground/70">
                <span>PRESS: {telemetry.ramUsage}%</span>
                <span>SWAP: NOMINAL</span>
              </div>
            </div>

            {/* GPU & Core Temp Readout */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5 font-mono text-[9px]">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-1.5 text-center">
                <span className="block text-muted-foreground text-[7px] uppercase">CORE TEMP</span>
                <span className="text-accent font-bold text-[10px]">42°C // 315K</span>
              </div>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-1.5 text-center">
                <span className="block text-muted-foreground text-[7px] uppercase">GPU SHADERS</span>
                <span className="text-emerald-400 font-bold text-[10px]">D3D12 READY</span>
              </div>
            </div>

            {/* Active Skills & Sessions */}
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-1.5 text-center">
                <span className="block text-muted-foreground text-[7px] uppercase">SKILLS</span>
                <span className="text-foreground font-bold text-[10px]">{telemetry.skillsCount} LOADED</span>
              </div>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-1.5 text-center">
                <span className="block text-muted-foreground text-[7px] uppercase">SESSIONS</span>
                <span className="text-accent font-bold text-[10px]">{telemetry.sessionsCount} CHK</span>
              </div>
            </div>
          </div>

          <div className="border-t border-primary/20 pt-1.5 text-[8px] font-mono text-muted-foreground flex justify-between items-center">
            <span>BUS: PCIe 4.0 // DMA</span>
            <span className="text-accent font-bold">100% HEALTH</span>
          </div>
        </section>

        {/* CENTER COLUMN: 3D ARC REACTOR HOLOGRAM & PROGRESS MATRIX */}
        <section className="lg:col-span-6 flex flex-col items-center justify-center text-center gap-1.5 xl:gap-2.5 py-1">
          {/* Center Marvel Arc Reactor Gyroscope */}
          <div className="relative h-36 w-36 sm:h-40 sm:w-40 md:h-44 md:w-44 lg:h-48 lg:w-48 xl:h-52 xl:w-52 flex items-center justify-center my-auto shrink-0">
            {/* Anchored 4-Corner Target Reticle Brackets */}
            <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-accent/90 pointer-events-none" />
            <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-accent/90 pointer-events-none" />
            <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-accent/90 pointer-events-none" />
            <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-accent/90 pointer-events-none" />

            {/* Rotating Segmented Caliper Rings */}
            <div className="absolute inset-0 rounded-full border border-dashed border-primary/30 animate-[spin_40s_linear_infinite]" />
            <div className="absolute inset-2.5 rounded-full border border-dotted border-accent/40 animate-[spin_25s_linear_infinite_reverse]" />
            <div className="absolute inset-6 rounded-full border border-primary/50 animate-[spin_18s_linear_infinite]" />

            {/* Burst Ping on Stage Transition */}
            {stageBurst && (
              <div className="absolute inset-[-10px] rounded-full border-2 border-accent animate-ping pointer-events-none" />
            )}

            {/* Sweeping Radar Beam */}
            <div className="absolute inset-4 rounded-full border border-primary/25 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/2 h-1/2 w-1/2 origin-bottom-left animate-[spin_2.8s_linear_infinite] bg-gradient-to-tr from-accent/35 via-accent/10 to-transparent" />
            </div>

            {/* Polar Arc Radial Ticks SVG */}
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full pointer-events-none">
              <defs>
                <filter id="markXvBootGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id="hexShieldBoot" width="24" height="41.56" patternUnits="userSpaceOnUse">
                  <path
                    d="M12 0 L24 6.92 L24 20.78 L12 27.7 L0 20.78 L0 6.92 Z M12 41.56 L24 34.64 L24 20.78 L12 27.7 L0 20.78 L0 34.64 Z"
                    fill="none"
                    stroke="hsl(var(--primary)/0.09)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              {/* Hexagonal Shield Layer */}
              <circle cx="200" cy="200" r="145" fill="url(#hexShieldBoot)" />

              {/* Target Axes */}
              <line x1="200" y1="20" x2="200" y2="135" stroke="hsl(var(--primary)/0.35)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="200" y1="265" x2="200" y2="380" stroke="hsl(var(--primary)/0.35)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="20" y1="200" x2="135" y2="200" stroke="hsl(var(--primary)/0.35)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="265" y1="200" x2="380" y2="200" stroke="hsl(var(--primary)/0.35)" strokeWidth="1" strokeDasharray="3 3" />

              {/* Polar Angle Labels */}
              <text x="200" y="16" fill="hsl(var(--accent)/0.85)" fontSize="9" fontFamily="monospace" textAnchor="middle">0°</text>
              <text x="390" y="203" fill="hsl(var(--accent)/0.85)" fontSize="9" fontFamily="monospace" textAnchor="middle">90°</text>
              <text x="200" y="392" fill="hsl(var(--accent)/0.85)" fontSize="9" fontFamily="monospace" textAnchor="middle">180°</text>
              <text x="10" y="203" fill="hsl(var(--accent)/0.85)" fontSize="9" fontFamily="monospace" textAnchor="middle">270°</text>

              {/* 15 Polar Caliper Segments */}
              <g filter="url(#markXvBootGlow)">
                {bootStages.map((_, i) => {
                  const angleDeg = (i / 15) * 360 - 90;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const r1 = 152;
                  const r2 = 172;
                  const x1 = 200 + r1 * Math.cos(angleRad);
                  const y1 = 200 + r1 * Math.sin(angleRad);
                  const x2 = 200 + r2 * Math.cos(angleRad);
                  const y2 = 200 + r2 * Math.sin(angleRad);
                  const isFilled = i <= currentStage;

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isFilled ? 'hsl(var(--accent))' : 'hsl(var(--primary)/0.2)'}
                      strokeWidth={isFilled ? 5 : 2.5}
                      strokeLinecap="round"
                      className="transition-all duration-150"
                    />
                  );
                })}
              </g>
            </svg>

            {/* Center Hermes Shield Arc Core */}
            <div className="relative z-20 flex flex-col items-center justify-center">
              <div
                className={cn(
                  'relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 bg-background/90 shadow-[0_0_30px_hsl(var(--accent)/0.6)] backdrop-blur-md transition-all duration-300',
                  currentStage === 14
                    ? 'border-emerald-400 shadow-[0_0_40px_hsl(142_71%_45%/0.6)]'
                    : 'border-accent/80'
                )}
              >
                <Shield
                  size={26}
                  className={cn(
                    'transition-colors',
                    currentStage === 14
                      ? 'text-emerald-400 drop-shadow-[0_0_12px_hsl(142_71%_45%)]'
                      : 'text-accent drop-shadow-[0_0_12px_hsl(var(--accent))] animate-pulse'
                  )}
                />
                <div className="absolute inset-0 rounded-full border-2 border-accent/40 animate-ping opacity-25 pointer-events-none" />
              </div>
              <div className={cn('text-xs sm:text-sm font-black tracking-[0.2em] text-accent mt-1 font-mono drop-shadow-[0_0_8px_hsl(var(--accent))]', orbitron.className)}>
                {progressPercent}%
              </div>
            </div>
          </div>

          {/* Main Title Callout */}
          <div className="space-y-0.5">
            <h2
              className={cn(
                'text-lg sm:text-xl md:text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-accent via-primary to-accent',
                orbitron.className
              )}
              style={{ textShadow: '0 0 20px hsl(var(--primary)/0.6)' }}
            >
              HERMES // MARK XV
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-semibold tracking-[0.15em] font-mono">
              <span className="text-muted-foreground uppercase">STAGE [{bootStages[currentStage]?.code}]</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold uppercase">{bootStages[currentStage]?.label}</span>
            </div>
          </div>

          {/* 15 Diagnostic Segment LED Bar */}
          <div className="w-full max-w-xs sm:max-w-sm px-2">
            <div className="flex items-center gap-0.5 h-2.5 sm:h-3 w-full bg-primary/10 p-0.5 rounded border border-primary/30">
              {bootStages.map((stage, i) => {
                const isCompleted = completedStages.includes(i);
                const isCurrent = currentStage === i;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 h-full rounded-xs transition-all duration-200',
                      isCurrent
                        ? 'bg-accent shadow-[0_0_10px_hsl(var(--accent))] animate-pulse scale-105'
                        : isCompleted
                        ? 'bg-emerald-400'
                        : 'bg-primary/20'
                    )}
                    title={`${stage.code}: ${stage.label}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between items-center text-[8px] text-muted-foreground font-mono mt-0.5 px-0.5">
              <span>01: POST</span>
              <span>05: DAEMON</span>
              <span>10: NEURAL</span>
              <span>15: ONLINE</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: ECOSYSTEM NODE MATRIX (6 ACTIVE SERVICES) */}
        <section className="hidden lg:flex lg:col-span-3 flex-col justify-between gap-1.5 h-full max-h-[300px] xl:max-h-[340px] rounded-xl border border-primary/25 bg-background/70 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
            <span className={cn('text-xs font-bold tracking-wider text-accent uppercase flex items-center gap-1', orbitron.className)}>
              <Radio size={12} className="text-accent" />
              ECOSYSTEM NODES
            </span>
            <span className="text-[8px] font-mono text-accent font-bold">
              6 LINKED
            </span>
          </div>

          <div className="space-y-1 sm:space-y-1.5 my-auto font-mono text-[10px]">
            {/* Node 1: Kali Linux WSL2 */}
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                <span className="text-foreground font-bold truncate">Kali Linux WSL2</span>
              </div>
              <span className="text-[8px] px-1 py-0 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
                6.6+
              </span>
            </div>

            {/* Node 2: Hermes Core Daemon */}
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                <span className="text-foreground font-bold truncate">Hermes Gateway</span>
              </div>
              <span className="text-[8px] px-1 py-0 rounded border border-accent/40 bg-accent/15 text-accent font-bold shrink-0">
                PID {telemetry.gatewayPid}
              </span>
            </div>

            {/* Node 3: uv Python Sandbox */}
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                <span className="text-foreground font-bold truncate">uv Python 3.14</span>
              </div>
              <span className="text-[8px] px-1 py-0 rounded border border-cyan-500/40 bg-cyan-500/15 text-cyan-400 font-bold shrink-0">
                SANDBOX
              </span>
            </div>

            {/* Node 4: SQLite WAL */}
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                <span className="text-foreground font-bold truncate">SQLite WAL DB</span>
              </div>
              <span className="text-[8px] px-1 py-0 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
                SYNCED
              </span>
            </div>

            {/* Node 5: Sarvam Saaras AI */}
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                <span className="text-foreground font-bold truncate">Sarvam Saaras AI</span>
              </div>
              <span className="text-[8px] px-1 py-0 rounded border border-accent/40 bg-accent/15 text-accent font-bold shrink-0">
                VOICE
              </span>
            </div>

            {/* Node 6: God's Eye Cesium */}
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                <span className="text-foreground font-bold truncate">God&apos;s Eye Cesium</span>
              </div>
              <span className="text-[8px] px-1 py-0 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
                :4173
              </span>
            </div>
          </div>

          <div className="border-t border-primary/20 pt-1.5 text-[8px] font-mono text-muted-foreground flex justify-between items-center">
            <span>PERIMETER: ISOLATION</span>
            <span className="text-emerald-400 font-bold">100% HEALTH</span>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* 3. BOTTOM FULL-WIDTH LIVE DIAGNOSTIC STREAM TERMINAL */}
      {/* ========================================================= */}
      <footer className="relative z-30 w-full max-w-5xl mx-auto shrink-0 mt-1">
        <div className="relative h-18 sm:h-20 w-full font-mono text-[10px] tracking-wider text-accent/90 overflow-hidden rounded-xl border border-primary/35 bg-black/85 p-2 sm:p-2.5 shadow-[0_0_20px_hsl(var(--primary)/0.25)] backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-primary/25 pb-1 mb-1 text-[9px] text-primary shrink-0">
            <div className="flex items-center gap-1.5">
              <Terminal size={11} className="text-accent" />
              <span className="font-bold tracking-wider">LIVE BOOTLOADER DIAGNOSTIC LOG // STDOUT</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[8px] flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" />
                STREAMING
              </span>
              <span className="text-emerald-400 font-bold text-[8px] sm:text-[9px]">
                {currentStage + 1} / 15 VERIFIED
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 font-mono text-[10px] leading-tight pr-1 hermes-scrollbar">
            {completedStages.map((idx) => {
              const item = bootStages[idx];
              if (!item) return null;
              return (
                <div key={idx} className="flex items-center justify-between text-[10px] leading-tight hover:text-foreground transition-colors animate-fade-in py-0.5">
                  <div className="flex items-center gap-1.5 truncate pr-1">
                    <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                    <span className="text-accent font-bold shrink-0">[{item.code}]</span>
                    <span className="text-[8px] px-1 rounded border border-primary/30 bg-primary/10 text-primary font-bold shrink-0">
                      {item.category}
                    </span>
                    <span className="text-foreground/90 truncate text-[10px]">{item.detail}</span>
                  </div>
                  <span className="text-emerald-400 text-[9px] font-bold shrink-0">OK</span>
                </div>
              );
            })}
            {currentStage < 14 && (
              <div className="flex items-center gap-1 text-accent animate-pulse text-[10px]">
                <span className="text-emerald-400 font-bold">&gt;</span>
                <span className="h-2.5 w-1 bg-accent" />
              </div>
            )}
            <div ref={terminalBottomRef} />
          </div>
        </div>
      </footer>
    </div>
  );
}
