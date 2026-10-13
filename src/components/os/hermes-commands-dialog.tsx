'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Zap,
  Terminal,
  Play,
  CornerDownLeft,
  X,
  Shield,
  Brain,
  Wrench,
  Boxes,
  Sparkles,
  Activity,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  HERMES_COMMANDS,
  type CommandCategory,
  type HermesCommand,
} from '@/lib/hermes-commands';
import { soundFx } from '@/lib/audio-synth';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';

interface HermesCommandsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (commandStr: string, executeImmediately?: boolean) => void;
}

const CATEGORIES: Array<{ key: CommandCategory | 'ALL'; label: string; count: number; icon: any }> = [
  { key: 'ALL', label: 'ALL PROTOCOLS', count: HERMES_COMMANDS.length, icon: Layers },
  { key: 'Session', label: 'SESSION', count: HERMES_COMMANDS.filter((c) => c.category === 'Session').length, icon: Terminal },
  { key: 'Configuration', label: 'CONFIG', count: HERMES_COMMANDS.filter((c) => c.category === 'Configuration').length, icon: Brain },
  { key: 'Tools & Skills', label: 'TOOLS & SKILLS', count: HERMES_COMMANDS.filter((c) => c.category === 'Tools & Skills').length, icon: Boxes },
  { key: 'Security & Cyber', label: 'SECURITY & CYBER', count: HERMES_COMMANDS.filter((c) => c.category === 'Security & Cyber').length, icon: Shield },
  { key: 'Creative', label: 'CREATIVE', count: HERMES_COMMANDS.filter((c) => c.category === 'Creative').length, icon: Sparkles },
  { key: 'Info & Telemetry', label: 'INFO & TELEMETRY', count: HERMES_COMMANDS.filter((c) => c.category === 'Info & Telemetry').length, icon: Activity },
];

export const HermesCommandsDialog: React.FC<HermesCommandsDialogProps> = ({
  isOpen,
  onClose,
  onSelectCommand,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommandCategory | 'ALL'>('ALL');

  const filteredCommands = useMemo(() => {
    let list = HERMES_COMMANDS;
    if (activeCategory !== 'ALL') {
      list = list.filter((c) => c.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim().replace(/^\//, '');
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.aliases?.some((a) => a.toLowerCase().includes(q)) ||
          c.argsHint?.toLowerCase().includes(q) ||
          c.tag?.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const handlePickCommand = (cmd: HermesCommand, execute: boolean) => {
    soundFx.playClick(1000);
    // If user clicks Run and command doesn't require mandatory args, run immediately
    if (execute && !cmd.argsHint?.startsWith('<')) {
      onSelectCommand(cmd.command, true);
    } else {
      // Put in input with args hint or example
      const fillText = cmd.argsHint ? `${cmd.command} ` : cmd.command;
      onSelectCommand(fillText, false);
    }
    onClose();
  };

  const getCategoryBadgeClass = (category: CommandCategory) => {
    switch (category) {
      case 'Security & Cyber':
        return 'border-rose-500/40 text-rose-400 bg-rose-500/10';
      case 'Creative':
        return 'border-purple-500/40 text-purple-400 bg-purple-500/10';
      case 'Tools & Skills':
        return 'border-amber-500/40 text-amber-400 bg-amber-500/10';
      case 'Configuration':
        return 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
      case 'Info & Telemetry':
        return 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10';
      default:
        return 'border-primary/40 text-primary bg-primary/10';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] max-h-[820px] p-0 flex flex-col bg-background/95 backdrop-blur-2xl border border-primary/40 shadow-[0_0_50px_hsl(var(--primary)/0.25)] rounded-2xl overflow-hidden font-headline">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-primary/20 shrink-0 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-primary/50 bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
                <Zap size={22} className="animate-pulse" />
              </div>
              <div>
                <DialogTitle className={cn("text-lg sm:text-xl font-bold tracking-wider text-primary flex items-center gap-2", orbitron.className)}>
                  HERMES AGENT // COMMAND REGISTRY
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-accent font-mono">
                    {HERMES_COMMANDS.length} PROTOCOLS
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono mt-0.5">
                  Complete catalog of canonical Hermes slash commands, skills, tools & autonomous triggers.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by command (/status, /yolo, /imagine), keyword, category, or argument..."
              className="pl-10 pr-10 h-10 rounded-xl border-primary/30 bg-background/80 font-mono text-xs sm:text-sm text-foreground focus-visible:ring-1 focus-visible:ring-accent"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-3 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    soundFx.playClick(900);
                    setActiveCategory(cat.key);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                    isActive
                      ? "border-accent bg-accent/20 text-accent shadow-[0_0_12px_hsl(var(--accent)/0.3)]"
                      : "border-primary/20 bg-background/40 text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}
                >
                  <Icon size={12} />
                  <span>{cat.label}</span>
                  <span className={cn(
                    "text-[10px] px-1 py-0.2 rounded font-mono",
                    isActive ? "bg-accent/30 text-accent font-bold" : "bg-primary/10 text-muted-foreground"
                  )}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Command Grid Stream */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 sm:p-5">
          <div className="flex items-center justify-between mb-2.5 text-xs font-mono text-muted-foreground shrink-0">
            <span>
              SHOWING <strong className="text-accent">{filteredCommands.length}</strong> OF {HERMES_COMMANDS.length} COMMANDS
            </span>
            <span className="text-[11px] text-primary/70">
              CLICK [RUN] FOR INSTANT EXECUTION OR [INSERT] TO COMPOSE
            </span>
          </div>

          <ScrollArea className="flex-1 min-h-0 w-full pr-2.5">
            {filteredCommands.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={36} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm font-mono text-muted-foreground">No matching commands found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Try searching by category, slash name, or keyword.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('ALL');
                  }}
                  className="mt-4 border-primary/30 text-xs font-mono"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-16 pt-1">
                {filteredCommands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="group relative rounded-xl border border-primary/20 bg-background/60 p-3.5 hover:border-accent hover:bg-primary/5 hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)] transition-all flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      {/* Top Bar: Command Name + Category Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-mono font-bold text-accent group-hover:text-primary transition-colors">
                            {cmd.command}
                          </span>
                          {cmd.argsHint && (
                            <span className="text-[11px] font-mono text-muted-foreground/80 truncate max-w-[170px]">
                              {cmd.argsHint}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wider font-bold",
                            getCategoryBadgeClass(cmd.category)
                          )}
                        >
                          {cmd.category}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-foreground/90 font-sans mt-1.5 leading-relaxed">
                        {cmd.description}
                      </p>

                      {/* Aliases & Subcommands */}
                      {(cmd.aliases || cmd.subcommands || cmd.example) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                          {cmd.aliases && (
                            <span className="bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-primary/80">
                              alias: {cmd.aliases.map((a) => `/${a}`).join(', ')}
                            </span>
                          )}
                          {cmd.tag && (
                            <span className="bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded text-accent font-bold">
                              {cmd.tag}
                            </span>
                          )}
                          {cmd.example && (
                            <span className="text-muted-foreground/70 truncate max-w-full italic">
                              eg: {cmd.example}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-primary/10">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePickCommand(cmd, false)}
                        className="h-7 px-2.5 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-primary/15"
                      >
                        <CornerDownLeft size={12} className="mr-1" />
                        INSERT
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handlePickCommand(cmd, true)}
                        className="h-7 px-3 text-[11px] font-mono font-bold bg-primary/20 text-accent border border-primary/40 hover:bg-accent hover:text-accent-foreground hover:shadow-[0_0_12px_hsl(var(--accent)/0.3)] transition-all"
                      >
                        <Play size={11} className="mr-1 fill-current" />
                        RUN
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
