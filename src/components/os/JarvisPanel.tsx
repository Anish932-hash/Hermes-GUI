import { cn } from '@/lib/utils';
import React from 'react';

interface JarvisPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  badge?: string;
}

const Corner = ({ className }: { className?: string }) => (
  <div className={cn('absolute h-3 w-3 border-accent/80 pointer-events-none transition-colors duration-300', className)} />
);

const JarvisPanel = ({ title, badge = 'ONLINE', children, className, ...props }: JarvisPanelProps) => {
  return (
    <div
      className={cn(
        'group relative rounded-xl border border-primary/25 bg-background/60 p-4 pt-6 backdrop-blur-md shadow-[0_0_25px_hsl(var(--primary)/0.08)] transition-all duration-300 hover:border-primary/45 hover:shadow-[0_0_35px_hsl(var(--primary)/0.15)]',
        className
      )}
      {...props}
    >
      {/* 4 Strictly Anchored Marvel Corner Brackets */}
      <Corner className="top-0 left-0 border-t-2 border-l-2 rounded-tl-sm group-hover:border-accent" />
      <Corner className="top-0 right-0 border-t-2 border-r-2 rounded-tr-sm group-hover:border-accent" />
      <Corner className="bottom-0 left-0 border-b-2 border-l-2 rounded-bl-sm group-hover:border-accent" />
      <Corner className="bottom-0 right-0 border-b-2 border-r-2 rounded-br-sm group-hover:border-accent" />

      {/* Subtle Holographic Laser Scanner Beam across Top */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden pointer-events-none" />

      {/* Title Header with Tech Status Dot */}
      {title && (
        <div className="absolute -top-3 left-4 flex items-center gap-2 bg-background/90 px-2 py-0.5 rounded border border-primary/30 text-xs font-mono tracking-widest text-primary backdrop-blur-md shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
          <h3 className="uppercase font-bold text-foreground/90">{title}</h3>
          {badge && (
            <span className="text-[9px] text-accent/80 font-mono hidden sm:inline">[{badge}]</span>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

export default JarvisPanel;
