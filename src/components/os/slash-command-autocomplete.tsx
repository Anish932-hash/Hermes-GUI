'use client';

import React, { useEffect, useRef } from 'react';
import {
  HERMES_COMMANDS,
  searchHermesCommands,
  type HermesCommand,
} from '@/lib/hermes-commands';
import { cn } from '@/lib/utils';
import { Zap, CornerDownLeft, Sparkles } from 'lucide-react';

interface SlashCommandAutocompleteProps {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  onSelect: (cmd: HermesCommand) => void;
  onClose: () => void;
}

export const SlashCommandAutocomplete: React.FC<SlashCommandAutocompleteProps> = ({
  isOpen,
  query,
  selectedIndex,
  onSelect,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const matchedCommands = React.useMemo(() => {
    return searchHermesCommands(query, 12);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen || matchedCommands.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2.5 z-50 rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-2xl shadow-[0_0_35px_hsl(var(--primary)/0.25)] overflow-hidden font-headline animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-primary/20 bg-primary/10 text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1.5 text-accent font-bold">
          <Zap size={13} className="animate-pulse" />
          <span>HERMES SLASH PROTOCOLS</span>
          <span className="text-[10px] text-primary/70">
            ({matchedCommands.length} matches)
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground/80">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-primary/20 border border-primary/30 text-accent font-bold">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-primary/20 border border-primary/30 text-accent font-bold ml-0.5">↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-primary/20 border border-primary/30 text-accent font-bold">↵</kbd> or <kbd className="px-1 py-0.5 rounded bg-primary/20 border border-primary/30 text-accent font-bold">Tab</kbd> Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-primary/20 border border-primary/30 text-accent font-bold">Esc</kbd> Close
          </span>
        </div>
      </div>

      {/* Commands List */}
      <div className="max-h-60 sm:max-h-72 overflow-y-auto p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-primary/20">
        {matchedCommands.map((cmd, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={cmd.name}
              ref={isSelected ? activeItemRef : null}
              type="button"
              onClick={() => onSelect(cmd)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between gap-3 text-xs font-mono group cursor-pointer border",
                isSelected
                  ? "bg-primary/20 border-accent text-accent shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
                  : "border-transparent text-foreground/90 hover:bg-primary/10 hover:border-primary/30"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn(
                  "font-bold text-sm",
                  isSelected ? "text-accent drop-shadow-[0_0_8px_hsl(var(--accent)/0.6)]" : "text-primary group-hover:text-accent"
                )}>
                  {cmd.command}
                </span>

                {cmd.argsHint && (
                  <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                    {cmd.argsHint}
                  </span>
                )}

                <span className="text-muted-foreground/70 text-[11px] font-sans truncate max-w-[200px] sm:max-w-xs">
                  — {cmd.description}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono uppercase tracking-wider">
                  {cmd.category}
                </span>
                {isSelected && (
                  <CornerDownLeft size={13} className="text-accent animate-bounce" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
