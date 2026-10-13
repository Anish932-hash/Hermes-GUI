'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import {
  Mic,
  MicOff,
  Send,
  X,
  Volume2,
  ArrowRight,
  AlertCircle,
  Radio,
  Zap,
  Sparkles,
  ShieldAlert,
  Activity,
  Waves,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRealVoice } from '@/hooks/use-real-voice';
import { useWisprFlow } from '@/hooks/use-wispr-flow';
import { WisprFlowModal } from '@/components/os/wispr-flow-modal';
import { GodsEyeModal } from './gods-eye-modal';
import { extractGodsEyeTarget, type GeoLocation } from '@/lib/godseye';

interface VoiceHUDProps {
  closeDialog: () => void;
  onOpenChatWithSession?: (sessionId?: string) => void;
  isLoading?: boolean;
  activeTaskTitle?: string;
  activeProtocol?: string;
  onSendMessage?: (queryText: string) => void;
}

const VoiceHUD = ({
  closeDialog,
  onOpenChatWithSession,
  isLoading: externalLoading = false,
  activeTaskTitle: externalTaskTitle,
  activeProtocol: externalProtocol,
  onSendMessage,
}: VoiceHUDProps) => {
  const [typedInput, setTypedInput] = useState('');
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const [isWisprModalOpen, setIsWisprModalOpen] = useState(false);
  const [isGodsEyeOpen, setIsGodsEyeOpen] = useState(false);
  const [godsEyeTarget, setGodsEyeTarget] = useState<string | undefined>(undefined);
  const [godsEyeLocation, setGodsEyeLocation] = useState<GeoLocation | null>(null);

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

  const triggerVoiceQueryWithGeo = (text: string) => {
    const loc = extractGodsEyeTarget(text);
    if (loc !== null) {
      soundFx.playClick(1100);
      setIsGodsEyeOpen(true);
      if (loc) {
        setGodsEyeTarget(loc);
      }
      window.dispatchEvent(new CustomEvent('hermes:open-godseye', { detail: loc ? { query: loc } : {} }));
    }

    // Broadcast active task execution across all system HUDs
    window.dispatchEvent(
      new CustomEvent('hermes:open-task-execution', {
        detail: {
          title: text,
          protocol: 'VOICE_TASK_EXECUTION',
          isCompleted: false,
        },
      })
    );

    if (onSendMessage) {
      onSendMessage(text);
    }
    sendVoiceQuery(text);
  };

  const wispr = useWisprFlow({
    pollingIntervalMs: isWisprModalOpen ? 1500 : 3000,
    onAutoSubmit: (text) => {
      if (text && text.trim()) {
        soundFx.playChirp();
        triggerVoiceQueryWithGeo(text.trim());
      }
    },
  });
  const wisprPttLabel = wispr.keybinds.find((keybind) => keybind.action.toLowerCase() === 'ptt')?.keys || 'shortcut not detected';

  const [micPeaks, setMicPeaks] = useState<number[]>(() => new Array(24).fill(6));
  const micPeaksRef = useRef<number[]>(new Array(24).fill(6));

  const {
    mode,
    setMode,
    toggleMode,
    status,
    transcript,
    response,
    error,
    audioLevel,
    frequencyBars,
    inputDb,
    isVoiceActive,
    isSupported,
    isWakeWordDetected,
    wakeWord,
    startListening,
    stopListening,
    startMonitoring,
    sendVoiceQuery,
    speakText,
    cancel,
  } = useRealVoice({
    initialMode: 'auto',
    sessionId: currentSessionId,
    onQueryComplete: (query, res, sid) => {
      if (sid) setCurrentSessionId(sid);
      window.dispatchEvent(
        new CustomEvent('hermes:open-task-execution', {
          detail: {
            title: query,
            protocol: 'VOICE_TASK_EXECUTION',
            isCompleted: true,
            realOutput: res,
            sessionId: sid,
          },
        })
      );
    },
  });

  // Track active background task across all system components
  const [internalRunningTask, setInternalRunningTask] = useState<{ title: string; protocol?: string } | null>(null);

  useEffect(() => {
    const handleTask = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail) {
        if (detail.isCompleted) {
          setInternalRunningTask(null);
        } else if (detail.title) {
          setInternalRunningTask({
            title: detail.title,
            protocol: detail.protocol || 'STARK PROTOCOL // AUTONOMOUS TASK',
          });
        }
      }
    };
    window.addEventListener('hermes:open-task-execution', handleTask);
    return () => window.removeEventListener('hermes:open-task-execution', handleTask);
  }, []);

  // Calculate working task execution state
  const isExecuting = externalLoading || status === 'thinking' || !!externalTaskTitle || !!internalRunningTask;
  const currentTaskTitle = externalTaskTitle || internalRunningTask?.title || (status === 'thinking' ? transcript || 'VOICE COMMAND INFERENCE' : undefined);
  const currentProtocol = externalProtocol || internalRunningTask?.protocol || (isExecuting ? 'STARK PROTOCOL // NEMOTRON-3 TOOL INFERENCE' : undefined);

  useEffect(() => {
    const updated = frequencyBars.map((val, idx) => {
      const prev = micPeaksRef.current[idx] || 0;
      if (val > prev) return val;
      return Math.max(val, Math.round(prev * 0.92));
    });
    micPeaksRef.current = updated;
    setMicPeaks(updated);
  }, [frequencyBars]);

  useEffect(() => {
    // Generate holographic background particles
    const newParticles = Array.from({ length: 60 }).map(() => {
      const angle = Math.random() * 2 * Math.PI;
      const radius = 30 + Math.random() * 110;
      return {
        '--size': `${Math.random() * 2 + 1}px`,
        '--x-start': `${Math.cos(angle) * radius}px`,
        '--y-start': `${Math.sin(angle) * radius}px`,
        '--x-end': `${Math.cos(angle + (Math.random() - 0.5) * Math.PI) * radius}px`,
        '--y-end': `${Math.sin(angle + (Math.random() - 0.5) * Math.PI) * radius}px`,
        '--delay': `${Math.random() * 10}s`,
        '--duration': `${Math.random() * 8 + 8}s`,
      } as React.CSSProperties;
    });
    setParticles(newParticles);
  }, []);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim()) return;
    triggerVoiceQueryWithGeo(typedInput);
    setTypedInput('');
  };

  const handleClose = () => {
    soundFx.playClick();
    cancel();
    closeDialog();
  };

  const handleOpenChat = () => {
    soundFx.playClick();
    cancel();
    closeDialog();
    if (onOpenChatWithSession) {
      onOpenChatWithSession(currentSessionId);
    }
  };

  const handleCenterCoreClick = () => {
    if (status === 'speaking') {
      cancel();
      if (mode === 'auto') {
        setTimeout(startMonitoring, 200);
      }
      return;
    }

    if (mode === 'auto') {
      if (status === 'listening') {
        stopListening();
      } else {
        startListening();
      }
    } else {
      if (status === 'listening') {
        stopListening();
      } else {
        startListening();
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between p-4 sm:p-5 bg-background/95 backdrop-blur-2xl border border-primary/40 rounded-3xl shadow-[0_0_60px_hsl(var(--primary)/0.35)] w-[94vw] max-w-lg max-h-[88vh] overflow-y-auto scrollbar-thin">
      {/* Cybernetic Scanlines */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25 overflow-hidden" />

      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-1.5 border-b border-primary/20 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              mode === 'auto' ? 'bg-accent animate-ping' : 'bg-emerald-400'
            )}
          />
          <span className={cn('text-xs font-bold tracking-widest text-primary', orbitron.className)}>
            HERMES VOICE INTERACTION // WSL
          </span>
        </div>
        <div className="flex items-center gap-2">
          {wispr.isInstalled && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsWisprModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-sky-500/40 bg-sky-950/40 hover:bg-sky-900/60 text-[10px] font-mono text-sky-300 hover:text-sky-100 transition-all cursor-pointer shadow-[0_0_10px_rgba(56,189,248,0.2)]"
              title="Open Wispr Flow Windows Dictation Engine Hub"
            >
              <Waves size={11} className={cn(wispr.isRunning ? "text-sky-400 animate-pulse" : "text-muted-foreground")} />
              <span className="hidden sm:inline font-bold">WISPR FLOW</span>
              <span className={cn("h-1.5 w-1.5 rounded-full", wispr.isRunning ? "bg-emerald-400 animate-ping" : "bg-muted-foreground")} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="rounded-full border border-primary/30 p-1.5 text-primary hover:bg-primary/20 hover:text-accent transition-colors"
            title="Close Voice HUD"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Dual Mode Switcher Bar */}
      <div className="w-full flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-background/80 border border-primary/30 my-2 z-10 shadow-inner shrink-0">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-[11px] font-mono tracking-wider transition-all duration-200 select-none cursor-pointer',
            mode === 'manual'
              ? 'bg-primary/20 text-primary border border-primary/60 shadow-[0_0_15px_hsl(var(--primary)/0.3)] font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <Mic size={13} className={mode === 'manual' ? 'text-accent' : 'opacity-60'} />
          <span>MANUAL MODE</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('auto')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-[11px] font-mono tracking-wider transition-all duration-200 select-none cursor-pointer',
            mode === 'auto'
              ? 'bg-accent/20 text-accent border border-accent/60 shadow-[0_0_15px_hsl(var(--accent)/0.3)] font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <Radio size={13} className={mode === 'auto' ? 'text-accent animate-pulse' : 'opacity-60'} />
          <span className="font-sans font-bold tracking-wider">AUTO // &quot;HERMES&quot; / &quot;JARVIS&quot;</span>
        </button>
      </div>

      {/* Ambient Wake-Word Banner / Mode Status Tag */}
      <div className="w-full flex items-center justify-between px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg text-[10px] font-mono text-muted-foreground mb-1 z-10 shrink-0">
        <div className="flex items-center gap-1.5">
          {mode === 'auto' ? (
            <>
              <Sparkles size={11} className="text-accent animate-spin-slow" />
              <span className="text-accent font-semibold">WAKE-WORD ACTIVE:</span>
              <span className="text-foreground tracking-wider font-bold font-sans">&quot;HERMES&quot; / &quot;JARVIS&quot;</span>
            </>
          ) : (
            <>
              <Mic size={11} className="text-primary" />
              <span className="text-primary font-semibold">PUSH-TO-TALK:</span>
              <span>CLICK MIC TO SPEAK</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider">
          {isExecuting ? (
            <span className="text-accent font-bold animate-pulse flex items-center gap-1 bg-accent/20 px-2 py-0.5 rounded-full border border-accent/50 shadow-[0_0_12px_hsl(var(--accent)/0.3)]">
              <Zap size={10} className="animate-bounce text-accent" />
              <span>⚡ EXECUTING TASK</span>
            </span>
          ) : mode === 'auto' && status === 'monitoring' ? (
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              AMBIENT ON
            </span>
          ) : status === 'listening' ? (
            <span className="text-destructive font-bold animate-pulse flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-ping" />
              RECORDING
            </span>
          ) : status === 'speaking' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Volume2 size={10} />
              SPEAKING
            </span>
          ) : (
            <span className="text-primary/70">STANDBY</span>
          )}
        </div>
      </div>

      {/* Center Holographic Core Visual */}
      <div className="relative h-36 w-36 sm:h-40 sm:w-40 my-1 sm:my-2 flex items-center justify-center shrink-0">
        {/* Real Audio Reactive Outer Ring */}
        <div
          className={cn(
            'absolute inset-0 rounded-full border transition-transform duration-100 ease-out',
            isWakeWordDetected
              ? 'border-accent shadow-[0_0_35px_hsl(var(--accent)/0.6)] scale-110'
              : isExecuting
              ? 'animate-[spin_2.5s_linear_infinite] border-accent shadow-[0_0_35px_hsl(var(--accent)/0.7)] scale-105'
              : status === 'monitoring'
              ? 'animate-[spin_12s_linear_infinite] border-accent/30'
              : 'animate-[spin_20s_linear_infinite] border-primary/25'
          )}
          style={{
            transform: `scale(${1 + audioLevel * 0.35})`,
          }}
        />

        {/* Dashed Secondary Ring */}
        <div
          className={cn(
            'absolute inset-3 rounded-full border border-dashed transition-transform duration-100',
            isExecuting
              ? 'animate-[spin_4s_linear_infinite_reverse] border-accent'
              : status === 'speaking'
              ? 'animate-[spin_6s_linear_infinite_reverse] border-primary'
              : status === 'monitoring'
              ? 'animate-[spin_8s_linear_infinite_reverse] border-primary/40'
              : 'animate-[spin_15s_linear_infinite_reverse] border-accent/30'
          )}
          style={{
            transform: `scale(${1 + audioLevel * 0.2})`,
          }}
        />

        {/* Circular Waveform Equalizer Bars */}
        <div className="absolute inset-2 flex items-center justify-center pointer-events-none">
          <svg viewBox="-100 -100 200 200" className="h-full w-full">
            {frequencyBars.map((val, i) => {
              const angle = (i / frequencyBars.length) * 360;
              const barHeight = Math.max(3, (val / 100) * 22);
              const isHot = (status === 'listening' || isWakeWordDetected) && val > 25;
              return (
                <rect
                  key={i}
                  x="-1"
                  y="-88"
                  width="2"
                  height={barHeight}
                  rx="1"
                  fill={
                    isHot
                      ? 'hsl(var(--destructive))'
                      : isExecuting
                      ? 'hsl(var(--accent))'
                      : status === 'speaking'
                      ? 'hsl(var(--accent))'
                      : status === 'monitoring'
                      ? 'hsl(var(--primary)/0.6)'
                      : 'hsl(var(--primary))'
                  }
                  opacity={
                    status === 'listening' || status === 'speaking' || isWakeWordDetected || isExecuting
                      ? 0.95
                      : 0.35
                  }
                  transform={`rotate(${angle})`}
                  className="transition-all duration-75"
                />
              );
            })}
          </svg>
        </div>

        {/* Speaking & Execution energy ripples */}
        {(status === 'speaking' || isExecuting) && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-accent animate-speaking-ripple" />
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-speaking-ripple [animation-delay:0.35s]" />
          </>
        )}

        {/* Wake-word surge burst */}
        {isWakeWordDetected && (
          <div className="absolute inset-[-10px] rounded-full border-2 border-accent animate-ping" />
        )}

        {/* Center Mic Button */}
        <button
          onClick={handleCenterCoreClick}
          className={cn(
            'group relative z-10 h-16 w-16 sm:h-20 sm:w-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-[0_0_25px_hsl(var(--primary)/0.3)] cursor-pointer',
            isWakeWordDetected
              ? 'bg-accent/40 border-2 border-accent scale-110 shadow-[0_0_35px_hsl(var(--accent))] animate-pulse'
              : isExecuting
              ? 'bg-accent/30 border-2 border-accent scale-105 shadow-[0_0_35px_hsl(var(--accent)/0.6)] animate-pulse'
              : status === 'listening'
              ? 'bg-destructive/30 border-2 border-destructive animate-pulse shadow-[0_0_30px_hsl(var(--destructive)/0.5)]'
              : status === 'monitoring'
              ? 'bg-accent/15 border-2 border-accent/70 hover:bg-accent/25 hover:scale-105'
              : 'bg-primary/20 border-2 border-primary hover:bg-primary/30 hover:border-accent hover:scale-105'
          )}
          title={
            isExecuting
              ? 'Task execution currently active in WSL...'
              : mode === 'auto'
              ? status === 'monitoring'
                ? 'Ambient listening active for "Hermes" (or click to force wake)'
                : 'Click to stop listening'
              : status === 'listening'
              ? 'Click to stop listening'
              : 'Click to start speaking'
          }
        >
          {isWakeWordDetected ? (
            <Zap size={22} className="text-accent drop-shadow-[0_0_12px_hsl(var(--accent))] animate-bounce sm:h-6 sm:w-6" />
          ) : isExecuting ? (
            <Zap size={22} className="text-accent drop-shadow-[0_0_14px_hsl(var(--accent))] animate-bounce sm:h-6 sm:w-6" />
          ) : status === 'listening' ? (
            <MicOff size={22} className="text-destructive drop-shadow-[0_0_8px_hsl(var(--destructive))] sm:h-6 sm:w-6" />
          ) : status === 'monitoring' ? (
            <Radio size={22} className="text-accent drop-shadow-[0_0_8px_hsl(var(--accent))] animate-pulse sm:h-6 sm:w-6" />
          ) : (
            <Mic size={22} className="text-accent drop-shadow-[0_0_8px_hsl(var(--accent))] sm:h-6 sm:w-6" />
          )}
          <span className="text-[8px] sm:text-[9px] font-bold tracking-widest text-primary mt-0.5 font-mono">
            {isWakeWordDetected
              ? 'AWOKEN'
              : isExecuting
              ? 'WORKING'
              : status === 'listening'
              ? 'STOP'
              : status === 'monitoring'
              ? 'MONITOR'
              : 'SPEAK'}
          </span>
        </button>
      </div>

      {/* Dynamic Status Readout Label */}
      <div className={cn('text-center my-1 font-mono text-[11px] sm:text-xs tracking-widest shrink-0', orbitron.className)}>
        {isExecuting ? (
          <div className="flex flex-col items-center justify-center gap-1 animate-fade-in">
            <span className="text-accent font-bold animate-pulse font-sans flex items-center justify-center gap-1.5 text-xs sm:text-sm">
              <Zap size={14} className="animate-bounce text-accent" />
              <span>⚡ EXECUTING TASK // {currentTaskTitle || "HERMES NEURAL INFERENCE"}</span>
            </span>
            {currentProtocol && (
              <span className="text-[10px] text-muted-foreground font-mono tracking-wider bg-accent/10 px-2 py-0.5 rounded border border-accent/30 shadow-[0_0_10px_hsl(var(--accent)/0.2)]">
                {currentProtocol}
              </span>
            )}
          </div>
        ) : isWakeWordDetected ? (
          <span className="text-accent font-bold animate-pulse font-sans">⚡ &quot;HERMES&quot; / &quot;JARVIS&quot; AWOKEN! RECORDING COMMAND...</span>
        ) : status === 'listening' ? (
          <span className="text-destructive font-bold animate-pulse font-sans">● RECORDING AUDIO... (AUTO-DETECTS PAUSE OR CLICK TO FINISH)</span>
        ) : status === 'speaking' ? (
          <span className="text-emerald-400 font-bold font-sans">🔊 HERMES RESPONDING...</span>
        ) : status === 'monitoring' ? (
          <span className="text-accent flex items-center justify-center gap-1.5 font-sans">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>LISTENING FOR &quot;HERMES&quot; OR &quot;JARVIS&quot;... (SAY WAKE-WORD)</span>
          </span>
        ) : (
          <span className="text-primary/80 font-mono">READY // CLICK MIC OR TYPE BELOW</span>
        )}
      </div>

      {/* Active Task Holographic Telemetry Box (Revealed when executing) */}
      {isExecuting && (
        <div className="w-full my-1.5 rounded-2xl border border-accent/40 bg-accent/10 p-2.5 backdrop-blur-md shadow-[0_0_25px_hsl(var(--accent)/0.15)] transition-all duration-300 animate-in fade-in zoom-in-95 shrink-0">
          <div className="flex items-center justify-between border-b border-accent/20 pb-1 mb-1.5">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-accent animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-accent tracking-widest">
                STARK TASK EXECUTION ACTIVE
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent font-bold animate-pulse border border-accent/30">
              WSL2 ENGINE
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-sans font-bold text-foreground">
            <Zap size={12} className="text-accent shrink-0 animate-bounce" />
            <span className="truncate">{currentTaskTitle || "Processing autonomous instruction..."}</span>
          </div>
          <div className="relative h-1 w-full bg-background/50 rounded-full overflow-hidden mt-2">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent via-primary to-accent rounded-full animate-pulse w-full" />
          </div>
        </div>
      )}

      {/* Dedicated Microphone Input Audio Visualizer (Reveals when listening / speaking) */}
      {status === 'listening' || status === 'monitoring' || isVoiceActive ? (
        <div className="w-full my-1 sm:my-1.5 rounded-2xl border border-destructive/40 bg-background/80 p-2 backdrop-blur-md shadow-[0_0_25px_hsl(var(--destructive)/0.15)] transition-all duration-300 animate-in fade-in zoom-in-95 shrink-0">
          {/* Visualizer Top Bar */}
          <div className="flex items-center justify-between border-b border-primary/20 pb-1 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Mic
                size={11}
                className={cn(
                  'transition-colors',
                  isVoiceActive ? 'text-destructive animate-pulse' : 'text-primary'
                )}
              />
              <span className="text-[9px] font-mono font-bold tracking-wider text-primary">
                MICROPHONE INPUT // 24-BAND ACOUSTIC FFT
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Voice Activity Status Pill */}
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all',
                  isVoiceActive
                    ? 'border-destructive/70 bg-destructive/20 text-destructive font-black shadow-[0_0_8px_hsl(var(--destructive)/0.5)] animate-pulse'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isVoiceActive ? 'bg-destructive animate-ping' : 'bg-emerald-400'
                  )}
                />
                <span>{isVoiceActive ? 'VOICE DETECTED' : 'MIC ACTIVE'}</span>
              </div>

              {/* Live Input dBFS Meter */}
              <span
                className={cn(
                  'text-[9px] font-mono font-bold transition-colors',
                  isVoiceActive ? 'text-destructive font-black' : 'text-primary/70'
                )}
              >
                {inputDb} dB
              </span>
            </div>
          </div>

          {/* 24-Band Live Acoustic Equalizer Bars with Peak-Hold LEDs */}
          <div className="relative flex items-end justify-between gap-[2px] h-7 sm:h-8 w-full px-0.5">
            {frequencyBars.map((val, idx) => {
              const peak = micPeaks[idx] || val;
              const isHot = val > 55 || (isVoiceActive && val > 30);
              const isPeakHot = peak > 65;

              return (
                <div key={idx} className="relative flex-1 flex flex-col justify-end items-center h-full">
                  {/* Floating Peak-Hold LED */}
                  <div
                    className={cn(
                      'absolute w-full h-[2px] rounded-full transition-all duration-75',
                      isPeakHot
                        ? 'bg-destructive shadow-[0_0_5px_hsl(var(--destructive))]'
                        : peak > 35
                        ? 'bg-accent shadow-[0_0_4px_hsl(var(--accent))]'
                        : 'bg-primary/80 shadow-[0_0_2px_hsl(var(--primary))]'
                    )}
                    style={{ bottom: `${Math.min(96, Math.max(0, peak))}%` }}
                  />

                  {/* Equalizer Bar */}
                  <div
                    className={cn(
                      'w-full rounded-t-[1px] transition-all duration-75 ease-out',
                      isHot
                        ? 'bg-gradient-to-t from-primary via-emerald-400 to-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.5)]'
                        : isVoiceActive
                        ? 'bg-gradient-to-t from-primary via-accent to-emerald-400 shadow-[0_0_4px_hsl(var(--accent)/0.3)]'
                        : 'bg-primary/40'
                    )}
                    style={{ height: `${Math.min(100, Math.max(6, val))}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Acoustic Frequency Bin Markers */}
          <div className="flex justify-between items-center text-[7px] text-muted-foreground/60 px-0.5 pt-0.5 font-mono">
            <span>80Hz</span>
            <span>250Hz</span>
            <span>800Hz</span>
            <span>2.5kHz</span>
            <span>5kHz</span>
            <span>10kHz</span>
          </div>

          {/* 16-Segment Horizontal LED Level VU Meter */}
          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-primary/10">
            <span className="text-[7px] font-mono text-muted-foreground uppercase">RMS LEVEL:</span>
            <div className="flex-1 flex items-center gap-[1.5px] h-1.5 sm:h-2">
              {Array.from({ length: 16 }).map((_, i) => {
                const activeThreshold = (i + 1) / 16;
                const isLit = audioLevel >= activeThreshold * 0.45;
                const isRed = i >= 13;
                const isYellow = i >= 9 && i < 13;

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 h-full rounded-[1px] transition-all duration-75',
                      isLit
                        ? isRed
                          ? 'bg-destructive shadow-[0_0_4px_hsl(var(--destructive))]'
                          : isYellow
                          ? 'bg-amber-400 shadow-[0_0_3px_hsl(var(--amber-400))]'
                          : 'bg-emerald-400 shadow-[0_0_3px_hsl(var(--emerald-400))]'
                        : 'bg-primary/15'
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Standby Input Banner when idle */
        <div className="w-full flex items-center justify-between px-3 py-1 rounded-xl border border-primary/20 bg-background/50 text-[10px] font-mono text-muted-foreground my-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Mic size={12} className="text-primary/70" />
            <span>MICROPHONE INPUT: STANDBY // CLICK MIC TO ACTIVATE</span>
          </div>
          <span className="text-[8px] text-primary/50 tracking-wider">48kHz / PCM</span>
        </div>
      )}

      {/* Transcript or AI Response Box */}
      <div className="w-full min-h-[50px] max-h-28 sm:max-h-32 overflow-y-auto rounded-lg border border-primary/25 bg-background/60 p-2.5 text-xs font-sans text-center text-foreground/90 my-1 shadow-inner shrink-0">
        {response ? (
          <div className="text-left font-sans space-y-1">
            <div className="flex items-center justify-between text-accent font-bold font-mono text-[10px]">
              <span>HERMES AGENT:</span>
              <button
                onClick={() => speakText(response)}
                className="hover:underline flex items-center gap-1 text-[9px] text-primary cursor-pointer"
                title="Replay Voice"
              >
                <Volume2 size={11} />
                <span>REPLAY</span>
              </button>
            </div>
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{response}</p>
          </div>
        ) : transcript ? (
          <div className="text-left">
            <span className="text-primary/70 font-mono text-[10px] block mb-0.5">YOU SAID:</span>
            <p className="text-accent font-semibold italic">"{transcript}"</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-1.5 text-destructive font-mono text-[11px] py-1">
            <div className="flex items-center gap-1.5 text-center">
              <AlertCircle size={14} className="shrink-0 text-destructive" />
              <span className="font-semibold text-destructive">{error}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  fetch('/api/system/windows-bridge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'open-mic-settings' }),
                  }).catch(() => {});
                }}
                className="px-2.5 py-1 rounded-md bg-destructive/20 hover:bg-destructive/30 border border-destructive/50 text-[10px] text-destructive font-mono cursor-pointer transition-colors flex items-center gap-1 font-bold"
                title="Open Windows Microphone Privacy Settings"
              >
                <span>⚙️ FIX IN WINDOWS SETTINGS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'auto') {
                    startMonitoring();
                  } else {
                    startListening();
                  }
                }}
                className="px-2.5 py-1 rounded-md bg-primary/20 hover:bg-primary/30 border border-primary/50 text-[10px] text-primary font-mono cursor-pointer transition-colors font-bold"
                title="Retry microphone initialization"
              >
                <span>RETRY MIC</span>
              </button>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-[10px] sm:text-[11px] font-mono leading-relaxed">
            {isSupported
              ? mode === 'auto'
                ? 'Ambient wake-word mode is active. Simply say "Hermes" followed by your command.'
                : 'Click the central microphone to speak, or type your query in the fallback box below.'
              : 'Web Speech API not detected in browser. Use text input below.'}
          </span>
        )}
      </div>

      {/* Action Footer: Continue in Chat or Replay */}
      {response && onOpenChatWithSession && (
        <div className="w-full flex items-center justify-end gap-2 my-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenChat}
            className="text-[11px] h-7 border-primary/30 text-accent hover:bg-primary/20 flex items-center gap-1 font-mono cursor-pointer"
          >
            <span>CONTINUE IN CHAT</span>
            <ArrowRight size={12} />
          </Button>
        </div>
      )}

      {/* Wispr Flow Pending Operator Approval Banner */}
      {wispr.pendingDictation && (
        <div className="w-full p-3 rounded-xl border-2 border-accent bg-accent/20 backdrop-blur-md text-xs font-mono my-1 shrink-0 animate-in fade-in duration-300 shadow-[0_0_20px_hsl(var(--accent)/0.3)]">
          <div className="flex items-center justify-between mb-1.5 text-[10px]">
            <div className="flex items-center gap-1.5 text-accent font-bold">
              <Waves size={13} className="animate-pulse" />
              <span>DICTATION AWAITING APPROVAL:</span>
            </div>
            <span className="text-muted-foreground">Press Enter to Approve</span>
          </div>
          <p className="text-xs font-sans font-bold text-foreground mb-2 leading-relaxed bg-background/50 p-2 rounded-lg border border-accent/20">
            &ldquo;{wispr.pendingDictation.formattedText || wispr.pendingDictation.pastedText}&rdquo;
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={wispr.discardDictation}
              className="px-2 py-0.5 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive text-[10px] font-bold cursor-pointer"
            >
              ✕ DISCARD
            </button>
            <button
              type="button"
              onClick={() => {
                setTypedInput(wispr.pendingDictation!.formattedText || wispr.pendingDictation!.pastedText);
                wispr.discardDictation();
              }}
              className="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold cursor-pointer"
            >
              ✎ EDIT
            </button>
            <button
              type="button"
              onClick={() => {
                const text = wispr.approveDictation();
                if (text) triggerVoiceQueryWithGeo(text);
              }}
              className="px-2.5 py-0.5 rounded bg-accent hover:bg-accent/80 text-background text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-[0_0_10px_hsl(var(--accent)/0.5)]"
            >
              <CheckCircle2 size={11} />
              APPROVE & ASK ⚡
            </button>
          </div>
        </div>
      )}

      {/* Wispr Flow Policy & Voice Control Strip */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-sky-500/40 bg-sky-950/30 text-xs font-mono my-1 shrink-0 animate-in fade-in duration-300">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <Waves size={13} className="text-sky-400 shrink-0 animate-pulse" />
          <span className="text-sky-300 font-bold text-[10px] shrink-0">WISPR FLOW:</span>
          {wispr.lastDictation?.formattedText ? (
            <span className="text-foreground/90 truncate font-sans text-[11px] italic">
              &quot;{wispr.lastDictation.formattedText}&quot;
            </span>
          ) : (
            <span className="text-muted-foreground text-[10px] truncate">
              {wispr.activationMode === 'hands_free' ? 'Keyless Hands-Free Active' : `${wisprPttLabel} PTT Ready`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {wispr.lastDictation?.formattedText && !wispr.pendingDictation && (
            <button
              type="button"
              onClick={() => {
                const text = wispr.lastDictation!.formattedText || wispr.lastDictation!.pastedText;
                soundFx.playClick();
                setTypedInput(text);
              }}
              className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[10px] font-bold cursor-pointer transition-colors hidden sm:inline-block"
              title="Copy Wispr Flow dictation into text input"
            >
              INSERT
            </button>
          )}

          {/* Execution Mode */}
          <button
            type="button"
            onClick={() => wispr.setExecutionMode(wispr.executionMode === 'auto_execute' ? 'manual_approve' : 'auto_execute')}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer",
              wispr.executionMode === 'auto_execute'
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                : "bg-sky-500/20 border-sky-500/40 text-sky-300"
            )}
            title="Toggle between Auto-Execute and Manual Approval"
          >
            {wispr.executionMode === 'auto_execute' ? '⚡ AUTO-USE' : '✓ APPROVE'}
          </button>

          {/* Activation Mode */}
          <button
            type="button"
            onClick={() => wispr.setActivationMode(wispr.activationMode === 'hands_free' ? 'key_ptt' : 'hands_free')}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer",
              wispr.activationMode === 'hands_free'
                ? "bg-accent/25 border-accent text-accent"
                : "bg-muted/20 border-muted text-muted-foreground hover:text-foreground"
            )}
            title={`Toggle between Keyless Hands-Free and ${wisprPttLabel} PTT`}
          >
            {wispr.activationMode === 'hands_free' ? '🎙️ KEYLESS' : `⌨️ ${wisprPttLabel.toUpperCase()}`}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick(1000);
              setIsWisprModalOpen(true);
            }}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Open Wispr Flow Settings"
          >
            <SlidersHorizontal size={12} />
          </button>
        </div>
      </div>

      {/* Text Prompt Input Fallback */}
      <form onSubmit={handleTextSubmit} className="relative w-full mt-1.5 shrink-0">
        <Input
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder={status === 'thinking' ? 'Processing...' : 'Type voice command fallback...'}
          disabled={status === 'thinking'}
          className="h-10 w-full rounded-full border border-primary/30 bg-background/80 pr-12 pl-4 text-xs font-sans focus-visible:ring-1 focus-visible:ring-accent"
        />
        <Button
          type="submit"
          size="icon"
          disabled={status === 'thinking' || !typedInput.trim()}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-primary/40 bg-transparent text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
        >
          <Send size={13} />
        </Button>
      </form>

      {/* Quick Voice Protocols & Command Actions Strip */}
      <div className="w-full mt-2.5 pt-2 border-t border-primary/20 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1.5 px-0.5">
          <span className="flex items-center gap-1 text-primary/80">
            <Sparkles size={11} className="text-accent" />
            <span>QUICK PROTOCOL COMMANDS:</span>
          </span>
          <span className="text-[9px] text-accent/70">CLICK TO EXECUTE</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => sendVoiceQuery('Jarvis, report system readiness and hardware telemetry')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/20 hover:border-accent text-[10px] font-mono text-primary hover:text-accent transition-all text-left truncate cursor-pointer"
          >
            <Activity size={12} className="text-emerald-400 shrink-0" />
            <span className="truncate">System Readiness</span>
          </button>
          <button
            type="button"
            onClick={() => sendVoiceQuery('Execute perimeter port security audit in WSL')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/20 hover:border-accent text-[10px] font-mono text-primary hover:text-accent transition-all text-left truncate cursor-pointer"
          >
            <ShieldAlert size={12} className="text-accent shrink-0" />
            <span className="truncate">Security Audit</span>
          </button>
          <button
            type="button"
            onClick={() => sendVoiceQuery('Boost arc reactor and purge dirty memory')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/20 hover:border-accent text-[10px] font-mono text-primary hover:text-accent transition-all text-left truncate cursor-pointer"
          >
            <Zap size={12} className="text-destructive shrink-0" />
            <span className="truncate">Reactor Overclock</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (wispr.isInstalled) {
                soundFx.playClick();
                setIsWisprModalOpen(true);
              } else {
                sendVoiceQuery('Check Wispr Flow application status');
              }
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-sky-500/30 bg-sky-950/25 hover:bg-sky-900/40 hover:border-sky-400 text-[10px] font-mono text-sky-300 hover:text-sky-100 transition-all text-left truncate cursor-pointer"
          >
            <Waves size={12} className="text-sky-400 shrink-0" />
            <span className="truncate">Wispr Flow Hub</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleClose();
              if (onOpenChatWithSession) onOpenChatWithSession(currentSessionId);
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/20 hover:border-accent text-[10px] font-mono text-primary hover:text-accent transition-all text-left truncate cursor-pointer"
          >
            <ArrowRight size={12} className="text-primary shrink-0" />
            <span className="truncate">Open Full Chat</span>
          </button>
          <button
            type="button"
            onClick={() => {
              cancel();
              soundFx.playClick(800);
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-destructive/20 hover:border-destructive text-[10px] font-mono text-muted-foreground hover:text-destructive transition-all text-left truncate cursor-pointer"
          >
            <X size={12} className="shrink-0" />
            <span className="truncate">Clear / Reset</span>
          </button>
        </div>
      </div>

      {/* Cyberpunk Wispr Flow Engine Modal */}
      <WisprFlowModal
        isOpen={isWisprModalOpen}
        onClose={() => setIsWisprModalOpen(false)}
        onSelectPrompt={(text) => {
          triggerVoiceQueryWithGeo(text);
          setIsWisprModalOpen(false);
        }}
      />

      {/* 3D God's Eye Geospatial Reconnaissance Modal */}
      <GodsEyeModal
        isOpen={isGodsEyeOpen}
        onClose={() => {
          soundFx.playClick();
          setIsGodsEyeOpen(false);
          setGodsEyeLocation(null);
        }}
        initialLocation={godsEyeLocation}
        targetQuery={godsEyeTarget}
      />
    </div>
  );
};

export default VoiceHUD;
