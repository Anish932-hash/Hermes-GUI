'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import { Mic, MicOff, Radio, Zap, Sparkles } from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import { useRealVoice } from '@/hooks/use-real-voice';

interface LoopingVoiceHUDProps {
  onSendMessage?: (queryText: string) => void;
  isLoading?: boolean;
  activeTaskTitle?: string;
  activeProtocol?: string;
  minimal?: boolean;
  activationMode?: 'key_ptt' | 'hands_free';
}

const LoopingVoiceHUD = ({
  onSendMessage,
  isLoading: externalLoading,
  activeTaskTitle,
  activeProtocol,
  minimal = false,
  activationMode = 'hands_free',
}: LoopingVoiceHUDProps) => {
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  const {
    mode,
    setMode,
    status,
    transcript,
    response,
    audioLevel,
    frequencyBars,
    inputDb,
    isVoiceActive,
    isWakeWordDetected,
    wakeWord,
    startListening,
    stopListening,
    startMonitoring,
    sendVoiceQuery,
    cancel,
  } = useRealVoice({
    initialMode: activationMode === 'hands_free' ? 'auto' : 'manual',
    continuousDictation: activationMode === 'hands_free',
    skipApiQuery: true,
    onTranscriptReady: (transcriptText) => {
      if (onSendMessage) {
        onSendMessage(transcriptText);
      }
    },
    onQueryComplete: (query, res) => {
      if (onSendMessage) {
        onSendMessage(query);
      }
    },
  });

  const appliedActivationModeRef = useRef<'key_ptt' | 'hands_free' | null>(null);
  useEffect(() => {
    if (appliedActivationModeRef.current === activationMode) return;
    appliedActivationModeRef.current = activationMode;
    const desiredMode = activationMode === 'hands_free' ? 'auto' : 'manual';
    if (mode !== desiredMode) setMode(desiredMode);
  }, [activationMode, mode, setMode]);

  const effectiveStatus = externalLoading ? 'thinking' : status;

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

  const isExecuting = externalLoading || effectiveStatus === 'thinking' || !!activeTaskTitle || !!internalRunningTask;
  const currentTaskTitle = activeTaskTitle || internalRunningTask?.title || (effectiveStatus === 'thinking' ? transcript || 'NEURAL INFERENCE' : undefined);
  const effectiveProtocol = activeProtocol || internalRunningTask?.protocol;

  useEffect(() => {
    // Generate particles only once on mount
    const newParticles = Array.from({ length: 110 }).map(() => {
      const angle = Math.random() * 2 * Math.PI;
      const radius = 50 + Math.random() * 140;
      return {
        '--size': `${Math.random() * 2 + 1}px`,
        '--x-start': `${Math.cos(angle) * radius}px`,
        '--y-start': `${Math.sin(angle) * radius}px`,
        '--x-end': `${Math.cos(angle + (Math.random() - 0.5) * Math.PI) * radius}px`,
        '--y-end': `${Math.sin(angle + (Math.random() - 0.5) * Math.PI) * radius}px`,
        '--delay': `${Math.random() * 15}s`,
        '--duration': `${Math.random() * 10 + 10}s`,
      } as React.CSSProperties;
    });
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!coreRef.current) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      coreRef.current.style.transform = `rotateY(${x * 15}deg) rotateX(${-y * 15}deg)`;
    };

    const handleMouseLeave = () => {
      if (coreRef.current) {
        coreRef.current.style.transform = 'rotateY(0deg) rotateX(0deg)';
      }
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleToggleVoice = () => {
    if (effectiveStatus === 'speaking') {
      cancel();
      if (mode === 'auto') {
        setTimeout(startMonitoring, 200);
      }
      return;
    }

    if (effectiveStatus === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  if (minimal) {
    return (
      <div
        className={cn(
          "fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full border bg-background/90 backdrop-blur-md text-[10px] font-mono transition-all",
          isExecuting
            ? "border-accent/60 shadow-[0_0_25px_hsl(var(--accent)/0.5)] bg-background/95 animate-pulse"
            : "border-primary/30 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        )}
      >
        <button
          type="button"
          onClick={handleToggleVoice}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          title={
            isExecuting
              ? "Task execution running in background"
              : status === 'listening'
              ? "Click to stop listening"
              : "Click to speak or say 'Hermes'"
          }
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              isWakeWordDetected
                ? "bg-accent animate-ping"
                : isExecuting
                ? "bg-accent animate-ping"
                : effectiveStatus === 'listening'
                ? "bg-destructive animate-pulse"
                : "bg-emerald-400 animate-pulse"
            )}
          />
          <span className={cn("font-bold", isExecuting ? "text-accent" : "text-primary")}>
            {isExecuting ? "⚡ EXECUTING:" : "AMBIENT VOICE:"}
          </span>
          <span className="text-foreground/90 font-sans font-bold truncate max-w-[200px] sm:max-w-[260px]">
            {isWakeWordDetected
              ? "⚡ WAKE DETECTED"
              : isExecuting
              ? currentTaskTitle || "INFERENCE IN WSL..."
              : effectiveStatus === 'listening'
              ? "🔴 LISTENING..."
              : activationMode === 'hands_free'
                ? 'SPEAK NATURALLY'
                : 'SAY "HERMES"'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* High-Tech Mode Switcher Pill */}
      <div className="flex items-center gap-2 p-1 rounded-full bg-background/80 border border-primary/30 mb-2 z-20 shadow-inner">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-mono tracking-wider transition-all duration-200 select-none cursor-pointer',
            mode === 'manual'
              ? 'bg-primary/25 text-primary border border-primary/60 font-bold shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <Mic size={11} className={mode === 'manual' ? 'text-accent' : 'opacity-60'} />
          <span>MANUAL</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('auto')}
          className={cn(
            'flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-mono tracking-wider transition-all duration-200 select-none cursor-pointer',
            mode === 'auto'
              ? 'bg-accent/25 text-accent border border-accent/60 font-bold shadow-[0_0_12px_hsl(var(--accent)/0.3)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <Radio size={11} className={mode === 'auto' ? 'text-accent animate-pulse' : 'opacity-60'} />
          <span>{activationMode === 'hands_free' ? 'AUTO: SPEAK & PAUSE' : 'AUTO: &quot;HERMES&quot; / &quot;JARVIS&quot;'}</span>
        </button>
      </div>

      <div ref={containerRef} className="h-[200px] w-[200px] sm:h-[240px] sm:w-[240px] md:h-[270px] md:w-[270px] my-0.5" style={{ perspective: '1400px' }}>
        <div
          ref={coreRef}
          className="relative h-full w-full transition-transform duration-300 ease-out"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Holographic Background Glow */}
          <div
            className={cn(
              'absolute inset-0 rounded-full blur-3xl transition-colors duration-500',
              isWakeWordDetected
                ? 'bg-accent/30 animate-pulse'
                : 'bg-primary/10 animate-pulse-slow'
            )}
            style={{ transform: 'translateZ(-140px)' }}
          />

          {/* Drifting Particles */}
          <div
            className={cn(
              'absolute inset-0 transition-transform duration-1000',
              effectiveStatus === 'thinking' ? 'animate-particle-swirl' : ''
            )}
            style={{ transform: 'translateZ(-70px)', transformStyle: 'preserve-3d' }}
          >
            {particles.slice(0, 45).map((style, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-[var(--size)] w-[var(--size)] rounded-full bg-accent/70 animate-particle-drift"
                style={style}
              />
            ))}
          </div>

          {/* Real Audio-reactive Gyro Rings */}
          <div
            className="absolute inset-0 h-full w-full transition-transform duration-150"
            style={{
              transform: `scale(${1 + audioLevel * 0.35})`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className={cn(
                'absolute inset-[2%] rounded-full border-2 border-dashed border-primary/20',
                effectiveStatus === 'thinking'
                  ? 'animate-[spin_10s_linear_infinite]'
                  : 'animate-[spin_40s_linear_infinite]'
              )}
              style={{ transform: 'translateZ(-40px) rotateX(70deg)' }}
            />
            <div
              className="absolute inset-[8%] rounded-full border border-dotted border-accent/25 animate-[spin_30s_linear_infinite_reverse]"
              style={{ transform: 'translateZ(-30px) rotateX(70deg)' }}
            />
            <div
              className="absolute inset-[15%] rounded-full border border-primary/30 animate-flicker"
              style={{ transform: 'translateZ(0px) rotateX(70deg)' }}
            />
            <div
              className={cn(
                'absolute inset-[22%] rounded-full border-2',
                isWakeWordDetected
                  ? 'border-accent shadow-[0_0_25px_hsl(var(--accent))] animate-[spin_4s_linear_infinite]'
                  : effectiveStatus === 'thinking'
                  ? 'animate-[spin_8s_linear_infinite_reverse] border-accent/70'
                  : 'animate-[spin_12s_linear_infinite_reverse] border-accent/70'
              )}
              style={{ transform: 'translateZ(20px) rotateX(70deg)' }}
            />
            <div
              className="absolute inset-[28%] rounded-full border border-dashed border-primary/40 animate-[spin_20s_linear_infinite]"
              style={{ transform: 'translateZ(40px) rotateX(70deg)' }}
            />
          </div>

          {/* Visuals for LISTENING Mode: Real Web Audio Frequency Bars */}
          <div className="absolute inset-0 h-full w-full pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
            <div
              className={cn(
                'absolute inset-0 transition-opacity duration-300',
                effectiveStatus === 'listening' ? 'opacity-100' : 'opacity-40'
              )}
            >
              <svg viewBox="-100 -100 200 200" className="h-full w-full">
                {Array.from({ length: 60 }).map((_, i) => {
                  const barVal = frequencyBars[i % frequencyBars.length] || 10;
                  const barHeight =
                    effectiveStatus === 'listening'
                      ? Math.max(3, (barVal / 100) * 20)
                      : effectiveStatus === 'monitoring'
                      ? 5
                      : 3;
                  return (
                    <rect
                      key={i}
                      x="-1"
                      y="-90"
                      width="2"
                      height={barHeight}
                      rx="1"
                      fill={
                        effectiveStatus === 'listening'
                          ? 'hsl(var(--destructive))'
                          : isWakeWordDetected
                          ? 'hsl(var(--accent))'
                          : effectiveStatus === 'monitoring'
                          ? 'hsl(var(--primary)/0.7)'
                          : 'hsl(var(--accent))'
                      }
                      transform={`rotate(${i * 6})`}
                      className="transition-all duration-75"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Visuals for THINKING Mode */}
            {effectiveStatus === 'thinking' && (
              <div className="absolute inset-0 animate-fade-in">
                <div
                  className="absolute inset-[25%] animate-scanner-line-rotate"
                  style={{ '--speed': '2.5s' } as React.CSSProperties}
                >
                  <div className="absolute top-0 left-1/2 h-1/2 w-px animate-scanner-line-fade bg-gradient-to-b from-accent/0 to-accent" />
                </div>
                <div
                  className="absolute inset-[25%] animate-scanner-line-rotate"
                  style={{ '--speed': '3.5s', animationDirection: 'reverse' } as React.CSSProperties}
                >
                  <div className="absolute bottom-0 left-1/2 h-1/2 w-px animate-scanner-line-fade bg-gradient-to-t from-accent/0 to-accent" />
                </div>
              </div>
            )}

            {/* Visuals for SPEAKING Mode */}
            {effectiveStatus === 'speaking' && (
              <div className="absolute inset-0 animate-fade-in">
                <div className="absolute inset-0 rounded-full border-2 border-primary/70 animate-speaking-ripple" />
                <div className="absolute inset-0 rounded-full border-2 border-accent animate-speaking-ripple [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          {/* Interactive Core Disc Button */}
          <div
            className="absolute inset-[30%] rounded-full cursor-pointer transition-transform duration-300 hover:scale-105"
            style={{ transform: 'translateZ(60px)', transformStyle: 'preserve-3d' }}
            onClick={handleToggleVoice}
            onMouseEnter={() => soundFx.playHover()}
            title={
              isExecuting
                ? 'Task execution running in background'
                : mode === 'auto'
                ? effectiveStatus === 'monitoring'
                  ? 'Ambient listening active for "Hermes" (or click to force wake)'
                  : 'Click to stop listening'
                : effectiveStatus === 'listening'
                ? 'Click to stop listening'
                : 'Click to activate voice command'
            }
          >
            <div
              className={cn(
                'absolute inset-0 rounded-full transition-colors',
                isWakeWordDetected
                  ? 'bg-accent/40 border-2 border-accent animate-pulse shadow-[0_0_35px_hsl(var(--accent))]'
                  : isExecuting
                  ? 'bg-accent/30 border-2 border-accent animate-pulse shadow-[0_0_35px_hsl(var(--accent)/0.6)]'
                  : effectiveStatus === 'listening'
                  ? 'bg-destructive/30 border-2 border-destructive animate-pulse'
                  : effectiveStatus === 'monitoring'
                  ? 'bg-accent/15 border-2 border-accent/70'
                  : 'bg-primary/20 border-2 border-primary hover:bg-primary/30 hover:border-accent'
              )}
            />
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-holographic-flicker" />

            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center text-primary/90 select-none px-2',
                orbitron.className
              )}
            >
              {isWakeWordDetected ? (
                <>
                  <Zap className="h-9 w-9 text-accent drop-shadow-[0_0_12px_hsl(var(--accent))] animate-bounce" />
                  <span className="text-[10px] tracking-widest text-accent font-bold font-mono mt-1">
                    AWOKEN
                  </span>
                </>
              ) : isExecuting ? (
                <>
                  <Zap className="h-8 w-8 text-accent drop-shadow-[0_0_14px_hsl(var(--accent))] animate-bounce" />
                  <span className="text-[10px] tracking-widest text-accent font-bold font-mono mt-0.5 animate-pulse">
                    EXECUTING
                  </span>
                  <span className="text-[8px] tracking-wider text-foreground font-sans truncate max-w-[120px] text-center font-bold">
                    {currentTaskTitle || "INFERENCE"}
                  </span>
                </>
              ) : effectiveStatus === 'listening' ? (
                <>
                  <MicOff className="h-9 w-9 text-destructive drop-shadow-[0_0_10px_hsl(var(--destructive))]" />
                  <span className="text-[10px] tracking-widest text-destructive font-bold font-mono mt-1">
                    STOP
                  </span>
                </>
              ) : effectiveStatus === 'monitoring' ? (
                <>
                  <Radio className="h-8 w-8 text-accent drop-shadow-[0_0_8px_hsl(var(--accent))] animate-pulse" />
                  <span className="text-sm font-bold tracking-[0.2em] text-accent mt-1">
                    HERMES
                  </span>
                  <span className="text-[8px] tracking-widest text-primary/80 font-mono">
                    SAY "HERMES"
                  </span>
                </>
              ) : (
                <>
                  <div className="text-3xl font-black tracking-[0.25em] [text-shadow:0_0_20px_hsl(var(--primary))]">
                    HERMES
                  </div>
                  <div className="flex items-center gap-1 text-[9px] tracking-widest text-accent font-mono mt-0.5">
                    <Mic size={11} className="text-accent" />
                    <span>TAP TO SPEAK</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Orbiting Particles */}
          <div className="absolute inset-0 pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
            {particles.slice(60, 75).map((style, i) => (
              <div
                key={`orbit-${i}`}
                className="absolute inset-0 animate-orbit"
                style={{
                  ...style,
                  '--radius': `${115 + (i % 6) * 3}px`,
                  '--duration': `${11 + i * 2}s`,
                  transform: 'translateZ(75px)',
                } as React.CSSProperties}
              >
                <div
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ transform: 'translateX(var(--radius))' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Status / Real-time Transcript Banner */}
      <div className="relative mt-1 flex flex-col items-center justify-center max-w-md px-4 text-center z-20">
        <div
          className={cn(
            'text-xs tracking-widest font-mono flex items-center justify-center gap-2',
            isWakeWordDetected
              ? 'text-accent font-bold animate-pulse'
              : isExecuting
              ? 'text-accent font-bold animate-pulse'
              : effectiveStatus === 'listening'
              ? 'text-destructive font-bold animate-pulse'
              : effectiveStatus === 'speaking'
              ? 'text-emerald-400'
              : effectiveStatus === 'monitoring'
              ? 'text-accent'
              : 'text-primary/80',
            orbitron.className
          )}
        >
          {isWakeWordDetected ? (
            <>
              <Zap size={14} className="text-accent animate-bounce" />
              <span>⚡ "HERMES" AWOKEN! RECORDING COMMAND...</span>
            </>
          ) : isExecuting ? (
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-1.5 text-accent font-bold font-sans text-xs sm:text-sm">
                <Zap size={15} className="text-accent animate-bounce" />
                <span>⚡ EXECUTING TASK // {currentTaskTitle || "HERMES INFERENCE RUNNING IN WSL..."}</span>
              </div>
              {effectiveProtocol && (
                <div className="text-[9px] text-primary/90 font-mono tracking-widest bg-accent/15 px-2.5 py-0.5 rounded-full border border-accent/40 shadow-[0_0_10px_hsl(var(--accent)/0.2)]">
                  {effectiveProtocol}
                </div>
              )}
            </div>
          ) : effectiveStatus === 'listening' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
              <span>RECORDING COMMAND... (SPEAK NOW)</span>
            </>
          ) : effectiveStatus === 'speaking' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>HERMES RESPONDING...</span>
            </>
          ) : effectiveStatus === 'monitoring' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>AMBIENT LISTENING // SAY "HERMES" HANDS-FREE</span>
            </>
          ) : (
            <span>TAP CORE OR MICROPHONE TO SPEAK COMMAND</span>
          )}
        </div>

        {/* Real-time Spoken Transcript */}
        {transcript && (effectiveStatus === 'listening' || effectiveStatus === 'thinking') && (
          <div className="mt-2 px-3 py-1.5 rounded-md border border-accent/40 bg-background/80 text-xs text-accent italic max-w-sm truncate animate-fade-in shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
            "{transcript}"
          </div>
        )}

        {/* Live Microphone Input Telemetry Indicator (Revealed on Speech / Listening) */}
        {(effectiveStatus === 'listening' || effectiveStatus === 'monitoring' || isVoiceActive) && (
          <div className="mt-2 flex items-center justify-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-background/60 text-[9px] font-mono text-muted-foreground animate-fade-in">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isVoiceActive ? 'bg-destructive animate-ping' : 'bg-emerald-400'
              )}
            />
            <span className={cn(isVoiceActive ? 'text-destructive font-bold' : 'text-primary')}>
              {isVoiceActive ? 'VOICE DETECTED' : 'MIC ACTIVE'}
            </span>
            <span className="text-primary/40">{'//'}</span>
            <span>{inputDb} dBFS</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoopingVoiceHUD;
