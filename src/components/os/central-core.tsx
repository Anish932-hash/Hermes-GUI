'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Radio, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import VoiceHUD from './voice-hud';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import { soundFx } from '@/lib/audio-synth';

interface CentralCoreProps {
  onOpenChatWithSession?: (sessionId?: string) => void;
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
}

const Hexagon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn('h-full w-full', className)}
    {...props}
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
  </svg>
);

const CentralCore = ({
  onOpenChatWithSession,
  isDialogOpen: externalOpen,
  setIsDialogOpen: setExternalOpen,
}: CentralCoreProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isDialogOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsDialogOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const [voiceMode, setVoiceMode] = useState<'manual' | 'auto'>('manual');
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  // Sync mode with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hermes_voice_mode') as 'manual' | 'auto';
      if (saved === 'manual' || saved === 'auto') {
        setVoiceMode(saved);
      }
    }
  }, []);

  // Holographic particles
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newParticles = Array.from({ length: 90 }).map(() => {
      const angle = Math.random() * 2 * Math.PI;
      const radius = 25 + Math.random() * 95;
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

  const [gyroTilt, setGyroTilt] = useState({ pitch: 0, yaw: 0 });

  // 3D gyroscopic mouse tilt
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!coreRef.current) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      coreRef.current.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
      setGyroTilt({
        pitch: Math.round(-y * 12 * 10) / 10,
        yaw: Math.round(x * 12 * 10) / 10,
      });
    };

    const handleMouseLeave = () => {
      if (coreRef.current) {
        coreRef.current.style.transform = 'rotateY(0deg) rotateX(0deg)';
        setGyroTilt({ pitch: 0, yaw: 0 });
      }
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleSelectMode = (mode: 'manual' | 'auto') => {
    soundFx.playClick(mode === 'auto' ? 1100 : 900);
    setVoiceMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hermes_voice_mode', mode);
    }
    setIsDialogOpen(true);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <div className="relative flex flex-col items-center justify-center">
        {/* Stark Gyroscopic 3D Tilt Readout Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 mb-1 rounded-full bg-background/80 border border-primary/25 text-[8px] font-mono text-muted-foreground select-none backdrop-blur-sm shadow-sm">
          <span className="h-1 w-1 rounded-full bg-accent animate-ping" />
          <span>GYRO PITCH: <strong className="text-foreground">{gyroTilt.pitch >= 0 ? `+${gyroTilt.pitch}` : gyroTilt.pitch}°</strong></span>
          <span>•</span>
          <span>YAW: <strong className="text-foreground">{gyroTilt.yaw >= 0 ? `+${gyroTilt.yaw}` : gyroTilt.yaw}°</strong></span>
        </div>

        <div
          ref={containerRef}
          className="h-[210px] w-[210px] sm:h-[240px] sm:w-[240px] lg:h-[265px] lg:w-[265px]"
          style={{ perspective: '1200px' }}
        >
          <div
            ref={coreRef}
            className="relative h-full w-full transition-transform duration-300 ease-out"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Background Holographic Glow */}
            <div
              className="absolute inset-0 rounded-full bg-primary/10 blur-3xl animate-pulse-slow"
              style={{ transform: 'translateZ(-120px)' }}
            />

            {/* Drifting Particles */}
            <div
              className="absolute inset-0"
              style={{ transform: 'translateZ(-60px)', transformStyle: 'preserve-3d' }}
            >
              {particles.slice(0, 40).map((style, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 h-[var(--size)] w-[var(--size)] rounded-full bg-accent/60 animate-particle-drift"
                  style={style}
                />
              ))}
            </div>

            {/* Concentric Gyro Rings */}
            <div className="absolute inset-0 h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
              <div
                className="absolute inset-[4%] rounded-full border border-dashed border-primary/20 animate-[spin_40s_linear_infinite]"
                style={{ transform: 'translateZ(-30px) rotateX(70deg)' }}
              />
              <div
                className="absolute inset-[10%] rounded-full border border-dotted border-accent/30 animate-[spin_30s_linear_infinite_reverse]"
                style={{ transform: 'translateZ(-20px) rotateX(70deg)' }}
              />
              <div
                className="absolute inset-[18%] rounded-full border-2 border-accent/60 animate-[spin_12s_linear_infinite_reverse]"
                style={{ transform: 'translateZ(15px) rotateX(70deg)' }}
              />
              <div
                className="absolute inset-[24%] rounded-full border border-dashed border-primary/40 animate-[spin_20s_linear_infinite]"
                style={{ transform: 'translateZ(35px) rotateX(70deg)' }}
              />
            </div>

            {/* Orbiting Ring Particles */}
            <div
              className="absolute inset-0"
              style={{ transform: 'translateZ(70px)', transformStyle: 'preserve-3d' }}
            >
              {particles.slice(50, 60).map((style, i) => (
                <div
                  key={i}
                  className="absolute inset-0 animate-orbit"
                  style={{
                    ...style,
                    '--radius': `${95 + i * 2}px`,
                    '--duration': `${12 + i * 2}s`,
                  } as React.CSSProperties}
                >
                  <div
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-accent"
                    style={{ transform: 'translateX(var(--radius))' }}
                  />
                </div>
              ))}
            </div>

            {/* Center Core Button */}
            <DialogTrigger asChild>
              <button
                onClick={() => soundFx.playClick(1000)}
                onMouseEnter={() => soundFx.playHover()}
                className="group absolute inset-[28%] rounded-full transition-all duration-300 ease-in-out hover:scale-105 cursor-pointer shadow-[0_0_35px_hsl(var(--primary)/0.25)]"
                style={{ transform: 'translateZ(60px)', transformStyle: 'preserve-3d' }}
                title="Activate Hermes Voice Interaction"
              >
                <div className="absolute inset-0 animate-breathing-glow rounded-full bg-primary/20 group-hover:animate-none group-hover:bg-primary/35 transition-colors" />
                <div className="absolute inset-0 animate-holographic-flicker rounded-full border-2 border-primary group-hover:border-accent transition-colors" />

                {/* Default Text Label */}
                <div
                  className={cn(
                    'absolute inset-0 flex flex-col items-center justify-center text-primary/90 opacity-100 transition-opacity duration-300 group-hover:opacity-0',
                    orbitron.className
                  )}
                >
                  <div className="text-2xl sm:text-3xl font-black tracking-[0.25em] [text-shadow:0_0_20px_hsl(var(--primary))]">
                    HERMES
                  </div>
                  <div className="text-[9px] tracking-widest text-accent font-mono">
                    AGENT CORE
                  </div>
                </div>

                {/* Hover Microphone Icon */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <Mic className="h-9 w-9 text-accent animate-pulse [filter:drop-shadow(0_0_12px_hsl(var(--accent)))]" />
                  <span className="text-[9px] font-bold tracking-widest text-accent font-mono mt-1">
                    START VOICE
                  </span>
                </div>
              </button>
            </DialogTrigger>
          </div>
        </div>

        {/* Prominent Dual Mode Switcher & Status Bar directly on the main HUD */}
        {!isDialogOpen && (
          <div className="mt-1.5 flex flex-col items-center justify-center gap-1 z-20">
            {/* Dual Mode Buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-background/90 border border-primary/35 backdrop-blur-md shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
              {/* MANUAL MODE BUTTON */}
              <button
                type="button"
                onClick={() => handleSelectMode('manual')}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-3.5 rounded-xl text-xs font-mono tracking-wider transition-all duration-200 select-none cursor-pointer',
                  voiceMode === 'manual'
                    ? 'bg-primary/25 text-primary border border-primary/60 font-bold shadow-[0_0_15px_hsl(var(--primary)/0.35)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
                title="Manual Push-To-Talk Mode"
              >
                <Mic size={13} className={voiceMode === 'manual' ? 'text-accent' : 'opacity-60'} />
                <span>MANUAL MODE</span>
              </button>

              {/* AUTO WAKE-WORD BUTTON */}
              <button
                type="button"
                onClick={() => handleSelectMode('auto')}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-3.5 rounded-xl text-xs font-mono tracking-wider transition-all duration-200 select-none cursor-pointer',
                  voiceMode === 'auto'
                    ? 'bg-accent/25 text-accent border border-accent/60 font-bold shadow-[0_0_15px_hsl(var(--accent)/0.35)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
                title="Automatic Wake-Word Detection Mode"
              >
                <Radio size={13} className={voiceMode === 'auto' ? 'text-accent animate-pulse' : 'opacity-60'} />
                <span>AUTO // "HERMES"</span>
              </button>
            </div>

            {/* Live Ambient Status Pill */}
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2 px-3.5 py-0.5 rounded-full border border-primary/25 bg-background/80 text-[10px] font-mono text-muted-foreground hover:border-accent hover:text-accent transition-all cursor-pointer shadow-sm"
              title="Click to launch Voice HUD"
            >
              {voiceMode === 'auto' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-emerald-400 font-bold tracking-wider">● AMBIENT ACTIVE</span>
                  <span className="text-foreground/80">• SAY "HERMES" TO AWAKEN</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-primary font-bold tracking-wider">● MANUAL PUSH-TO-TALK</span>
                  <span className="text-foreground/80">• CLICK OR PRESS CORE TO SPEAK</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <DialogContent className="flex h-auto w-auto max-w-none items-center justify-center border-none bg-transparent p-0 shadow-none focus-visible:ring-0 max-h-[94vh] overflow-y-auto">
        <DialogTitle className="sr-only">Voice Mode</DialogTitle>
        <DialogDescription className="sr-only">
          Voice interaction mode for Hermes Agent has been activated.
        </DialogDescription>
        {isDialogOpen && (
          <VoiceHUD
            closeDialog={() => setIsDialogOpen(false)}
            onOpenChatWithSession={onOpenChatWithSession}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CentralCore;
