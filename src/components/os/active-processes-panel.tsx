'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import JarvisPanel from './JarvisPanel';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  FastForward,
  Activity,
  Cpu,
  Layers,
  Search,
  ArrowUpDown,
  X,
  AlertCircle,
  Terminal,
  Trash2,
  Flame,
} from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export interface ProcessItem {
  pid: string;
  name: string;
  cpu?: string;
  mem?: string;
}

interface ActiveProcessesPanelProps {
  processes: ProcessItem[];
  className?: string;
}

export const ActiveProcessesPanel: React.FC<ActiveProcessesPanelProps> = ({
  processes,
  className,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const { toast } = useToast();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTerminateProcess = async (pid: string) => {
    if (pid === '1') {
      toast({
        title: "Protected Process",
        description: "PID 1 (init / systemd) is protected against operator termination.",
        variant: "destructive",
      });
      return;
    }

    soundFx.playJarvisAlert();
    setIsTerminating(true);
    try {
      const res = await fetch('/api/system/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `kill -9 ${pid}` }),
      });
      const data = await res.json();
      if (res.ok) {
        soundFx.playTaskSuccess();
        toast({
          title: `Process ${pid} Terminated`,
          description: `SIGKILL signal dispatched to task "${selectedProcess?.name}".`,
        });
        setSelectedProcess(null);
      } else {
        toast({
          title: "Termination Failed",
          description: data.stderr || "Access denied or process not found.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Execution Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsTerminating(false);
    }
  };

  // Default baseline WSL processes
  const rawItems = processes.length > 0 ? processes : [
    { pid: '358', name: 'hermes-gateway', cpu: '3.8%', mem: '6.7%' },
    { pid: '1', name: 'systemd', cpu: '0.0%', mem: '0.2%' },
    { pid: '15724', name: 'next-server', cpu: '3.9%', mem: '5.1%' },
    { pid: '15711', name: 'npm start', cpu: '0.4%', mem: '2.1%' },
    { pid: '299', name: 'containerd', cpu: '0.2%', mem: '0.4%' },
    { pid: '508', name: 'language_server', cpu: '8.1%', mem: '8.6%' },
    { pid: '114', name: 'dbus-daemon', cpu: '0.1%', mem: '0.2%' },
    { pid: '113', name: 'cron', cpu: '0.0%', mem: '0.1%' },
    { pid: '412', name: 'wsl-relay', cpu: '0.1%', mem: '0.3%' },
    { pid: '620', name: 'python3-hermes', cpu: '2.4%', mem: '4.2%' },
  ];

  // Filter and sort items
  const sortedAndFiltered = useMemo(() => {
    let result = rawItems.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.pid.includes(q);
    });

    result.sort((a, b) => {
      if (sortBy === 'cpu') {
        return parseFloat(b.cpu || '0') - parseFloat(a.cpu || '0');
      } else if (sortBy === 'mem') {
        return parseFloat(b.mem || '0') - parseFloat(a.mem || '0');
      } else {
        return parseInt(a.pid || '0', 10) - parseInt(b.pid || '0', 10);
      }
    });

    return result;
  }, [rawItems, searchQuery, sortBy]);

  // Duplicate items for a 100% seamless infinite marquee loop when not searching
  const seamlessItems = useMemo(() => {
    if (searchQuery.trim() || sortedAndFiltered.length <= 4) {
      return sortedAndFiltered;
    }
    return [...sortedAndFiltered, ...sortedAndFiltered];
  }, [sortedAndFiltered, searchQuery]);

  const togglePause = () => {
    soundFx.playClick(900);
    setIsPaused((prev) => !prev);
  };

  const toggleSpeed = () => {
    soundFx.playClick(1100);
    setSpeedMultiplier((prev) => (prev === 1 ? 2 : 1));
  };

  const cycleSort = () => {
    soundFx.playClick(1000);
    setSortBy((prev) => (prev === 'cpu' ? 'mem' : prev === 'mem' ? 'pid' : 'cpu'));
  };

  // Base scroll duration
  const scrollDurationSec = Math.max(
    10,
    Math.round((sortedAndFiltered.length * 2.2) / speedMultiplier)
  );

  const handleWheel = () => {
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <JarvisPanel
        title="ACTIVE SUB-PROCESSES"
        badge={`${sortedAndFiltered.length} LIVE`}
        className={cn('w-72 relative p-2.5 pt-5', className)}
      >
        {/* Top Controls Row */}
        <div className="flex items-center justify-between border-b border-primary/20 pb-1 mb-1 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
              )}
            />
            <span className="text-[9px] tracking-wider text-primary font-bold">
              {isPaused ? 'PAUSED' : 'AUTO-SCROLL'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Search Toggle */}
            <button
              onClick={() => {
                soundFx.playClick(1000);
                setIsSearchOpen((prev) => !prev);
              }}
              className={cn(
                'rounded border p-1 transition-colors',
                isSearchOpen
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-primary/20 bg-background/60 text-muted-foreground hover:text-accent'
              )}
              title="Filter / Search Processes"
            >
              <Search size={10} />
            </button>

            {/* Sort Toggle */}
            <button
              onClick={cycleSort}
              className="rounded border border-primary/20 bg-background/60 px-1.5 py-0.5 text-[8px] text-muted-foreground hover:text-accent hover:border-accent transition-colors uppercase font-mono"
              title={`Sort by ${sortBy.toUpperCase()}`}
            >
              {sortBy}
            </button>

            {/* Speed Multiplier */}
            <button
              onClick={toggleSpeed}
              className="rounded border border-primary/20 bg-background/60 px-1.5 py-0.5 text-[8px] text-muted-foreground hover:text-accent hover:border-accent transition-colors"
              title="Toggle Scroll Velocity"
            >
              {speedMultiplier === 1 ? '1x' : '2x⚡'}
            </button>

            {/* Pause / Play */}
            <button
              onClick={togglePause}
              className="rounded border border-primary/20 bg-background/60 p-1 text-muted-foreground hover:text-accent hover:border-accent transition-colors"
              title={isPaused ? 'Resume Auto-Scroll' : 'Pause Auto-Scroll'}
            >
              {isPaused ? <Play size={10} className="text-emerald-400" /> : <Pause size={10} className="text-accent" />}
            </button>
          </div>
        </div>

        {/* Search Input Bar (when opened) */}
        {isSearchOpen && (
          <div className="relative mb-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name or PID..."
              autoFocus
              className="w-full h-6 px-2 pr-5 rounded border border-primary/30 bg-background/80 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent"
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}

        {/* Column Headers */}
        <div className="grid grid-cols-12 text-[8.5px] font-mono font-bold tracking-wider text-primary/70 pb-0.5 border-b border-primary/10 px-1">
          <span className="col-span-3">PID</span>
          <span className="col-span-5">PROCESS</span>
          <span className="col-span-2 text-right">CPU</span>
          <span className="col-span-2 text-right">MEM</span>
        </div>

        {/* Main Holographic Scrolling Window */}
        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          className="relative h-[98px] overflow-hidden select-none group"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 2%, black 98%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 2%, black 98%, transparent 100%)',
          }}
        >
          {/* Holographic Vertical Scanning Laser Beam */}
          <div className="pointer-events-none absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent/60 to-transparent animate-laser-sweep z-10" />

          {/* Animated Marquee Process Ticker */}
          <div
            className={cn(
              'flex flex-col space-y-0.5 py-0.5 group-hover:[animation-play-state:paused]',
              !searchQuery && 'animate-continuous-scroll',
              isPaused && 'paused'
            )}
            style={{
              '--scroll-duration': `${scrollDurationSec}s`,
            } as React.CSSProperties}
          >
            {seamlessItems.map((proc, idx) => {
              const cpuVal = parseFloat(proc.cpu || '0');
              const isHighCpu = cpuVal >= 4.0;
              return (
                <div
                  key={`${proc.pid}-${idx}`}
                  onClick={() => {
                    soundFx.playClick(1000);
                    setSelectedProcess(proc);
                  }}
                  className="grid grid-cols-12 items-center text-[10px] font-mono rounded px-1.5 py-0.5 transition-all duration-150 hover:bg-primary/20 hover:text-accent cursor-pointer border border-transparent hover:border-accent/40 group/row"
                  title={`Click to inspect PID ${proc.pid}: ${proc.name}`}
                >
                  {/* PID with Pulsing Dot */}
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 group-hover/row:scale-125 transition-transform" />
                    <span className="text-accent font-bold truncate">[{proc.pid}]</span>
                  </div>

                  {/* Process Name */}
                  <span className="col-span-5 text-foreground/90 truncate font-semibold">
                    {proc.name}
                  </span>

                  {/* CPU Percentage */}
                  <span
                    className={cn(
                      'col-span-2 text-right font-bold',
                      isHighCpu ? 'text-destructive' : 'text-accent'
                    )}
                  >
                    {proc.cpu || '0.2%'}
                  </span>

                  {/* MEM Percentage */}
                  <span className="col-span-2 text-right text-muted-foreground group-hover/row:text-primary">
                    {proc.mem || '1.5%'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </JarvisPanel>

      {/* Process Inspection Dialog */}
      <Dialog open={!!selectedProcess} onOpenChange={(open) => !open && setSelectedProcess(null)}>
        <DialogContent className="max-w-md border border-primary/40 bg-background/95 backdrop-blur-2xl p-4 font-headline text-foreground shadow-[0_0_40px_hsl(var(--primary)/0.25)]">
          <DialogHeader>
            <div className="flex items-center gap-2 border-b border-primary/20 pb-2">
              <Activity size={16} className="text-accent animate-pulse" />
              <DialogTitle className="font-mono text-xs font-black tracking-widest text-primary">
                PROCESS INSPECTOR // PID {selectedProcess?.pid}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[11px] font-mono text-muted-foreground">
              Kernel Task Telemetry & Resource Boundaries in WSL2
            </DialogDescription>
          </DialogHeader>

          {selectedProcess && (
            <div className="space-y-3 my-2 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 bg-primary/5 p-2.5 rounded-xl border border-primary/20">
                <div>
                  <span className="text-[10px] text-muted-foreground block">PROCESS NAME:</span>
                  <span className="font-bold text-accent">{selectedProcess.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">PROCESS ID:</span>
                  <span className="font-bold text-foreground">{selectedProcess.pid}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">CPU CONSUMPTION:</span>
                  <span className="font-bold text-primary">{selectedProcess.cpu || '0.4%'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">RESIDENT MEMORY:</span>
                  <span className="font-bold text-foreground">{selectedProcess.mem || '1.8%'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-background/60 p-2 rounded-lg border border-primary/10">
                <span>NICE VALUE: 0 (NORMAL)</span>
                <span>STATE: S (INTERRUPTIBLE SLEEP)</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-primary/15">
                <button
                  type="button"
                  onClick={() => handleTerminateProcess(selectedProcess.pid)}
                  disabled={isTerminating || selectedProcess.pid === '1'}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs border border-destructive/50 bg-destructive/15 hover:bg-destructive/25 text-destructive font-mono font-bold cursor-pointer transition-all disabled:opacity-50"
                  title="Dispatch SIGKILL to process"
                >
                  <Trash2 size={12} className={isTerminating ? 'animate-spin' : ''} />
                  <span>{isTerminating ? 'TERMINATING...' : 'KILL PROCESS'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProcess(null)}
                  className="px-3 py-1 rounded text-xs border border-primary/30 hover:bg-primary/20 text-foreground cursor-pointer font-mono"
                >
                  DISMISS
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ActiveProcessesPanel;
