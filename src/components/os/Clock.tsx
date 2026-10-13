'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';

const Clock = () => {
  const [date, setDate] = useState(new Date());
  const [showMet, setShowMet] = useState(false);
  const [sessionStartTime] = useState(() => Date.now());

  useEffect(() => {
    const timerId = setInterval(() => setDate(new Date()), 500);
    return () => clearInterval(timerId);
  }, []);

  const time = date.toLocaleTimeString('en-US', { hour12: false });
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();
  const seconds = date.getSeconds();

  // Mission Elapsed Time
  const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
  const metHours = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
  const metMinutes = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
  const metSeconds = String(elapsedSec % 60).padStart(2, '0');
  const metDisplay = `T+${metHours}:${metMinutes}:${metSeconds}`;

  return (
    <div
      onClick={() => setShowMet((s) => !s)}
      className="flex flex-col gap-0.5 cursor-pointer select-none group"
      title="Click to toggle Local Time / Mission Elapsed Time (MET)"
    >
      <div className="flex items-center gap-1.5 text-[8px] font-mono text-primary/60 tracking-widest">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-ping" />
        <span>SYS: MARK-85 // HERMES KERNEL</span>
      </div>
      <div className="flex items-baseline gap-2 sm:gap-3 text-primary">
        <div className={cn('text-xl sm:text-2xl md:text-3xl font-black tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-accent', orbitron.className)}>
          {showMet ? metDisplay : time}
        </div>
        <div className="hidden sm:flex flex-col text-left leading-tight border-l-2 border-primary/40 pl-2">
          <div className="text-xs sm:text-sm font-bold text-accent tracking-wider font-mono">
            {dayOfMonth} {month.substring(0, 3).toUpperCase()} {year}
          </div>
          <div className="text-[9px] tracking-[0.2em] text-muted-foreground font-mono flex items-center gap-1">
            <span>{showMet ? 'MET ACTIVE' : day.toUpperCase()}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>
      </div>

      {/* 60-Second Linear Heartbeat Progress Line */}
      <div className="w-full max-w-[200px] h-0.5 bg-primary/15 rounded-full overflow-hidden mt-0.5">
        <div
          className="h-full bg-accent transition-all duration-500 rounded-full shadow-[0_0_8px_hsl(var(--accent))]"
          style={{ width: `${((seconds + 1) / 60) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Clock;
