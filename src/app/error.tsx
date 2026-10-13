'use client';

import { useEffect } from 'react';
import { orbitron } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('HERMES AGENT OS Client Error:', error);
    try {
      soundFx.playWarning();
    } catch {}
  }, [error]);

  const handleReboot = () => {
    try {
      soundFx.playClick(1000);
      sessionStorage.removeItem('hermes_boot_seen');
    } catch {}
    reset();
  };

  const handleForceReload = () => {
    try {
      soundFx.playClick(1200);
      sessionStorage.removeItem('hermes_boot_seen');
    } catch {}
    window.location.href = '/?skipBoot=1';
  };

  return (
    <div className="relative flex min-h-screen w-screen flex-col items-center justify-center bg-background text-primary select-none p-4 font-headline overflow-hidden">
      {/* Background glow and grid */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-15">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--primary)/0.2) 1px, transparent 1px)`,
            backgroundSize: '2rem 2rem',
          }}
        />
      </div>

      <div className="relative z-10 max-w-lg w-full rounded-2xl border border-destructive/40 bg-card/80 p-6 backdrop-blur-xl shadow-[0_0_40px_hsl(var(--destructive)/0.2)] text-center flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/60 bg-destructive/15 text-destructive shadow-[0_0_20px_hsl(var(--destructive)/0.3)]">
          <ShieldAlert size={28} className="animate-pulse" />
        </div>

        <div className="space-y-1">
          <h2 className={cn('text-lg font-black tracking-widest text-destructive uppercase', orbitron.className)}>
            NEURAL SUBSYSTEM EXCEPTION DETECTED
          </h2>
          <p className="text-xs font-mono text-muted-foreground">
            Hermes Mark-XV automated recovery protocol engaged.
          </p>
        </div>

        <div className="w-full rounded-lg border border-primary/20 bg-black/60 p-3 font-mono text-[10px] text-left text-muted-foreground max-h-32 overflow-auto hermes-scrollbar">
          <span className="text-destructive font-bold">ERROR: </span>
          {error?.message || 'An unexpected client-side exception occurred.'}
        </div>

        <div className="flex items-center gap-3 pt-2 w-full justify-center">
          <button
            onClick={handleReboot}
            className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-mono font-bold text-primary hover:bg-primary/20 hover:border-primary transition-all cursor-pointer shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
          >
            <RotateCcw size={14} />
            <span>REINITIALIZE</span>
          </button>

          <button
            onClick={handleForceReload}
            className="flex items-center gap-2 rounded-lg border border-accent/60 bg-accent/20 px-4 py-2 text-xs font-mono font-bold text-accent hover:bg-accent/30 hover:border-accent transition-all cursor-pointer shadow-[0_0_15px_hsl(var(--accent)/0.3)]"
          >
            <RefreshCw size={14} />
            <span>REBOOT COCKPIT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
