'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Terminal, Play, Copy, Check, Trash2, Shield, CornerDownLeft, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { soundFx } from '@/lib/audio-synth';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import { useToast } from '@/hooks/use-toast';

interface CommandLog {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: string;
}

const PRESET_COMMANDS = [
  { label: 'KERNEL', cmd: 'uname -a' },
  { label: 'MEMORY', cmd: 'free -h' },
  { label: 'UPTIME', cmd: 'uptime -p' },
  { label: 'HERMES GATEWAY', cmd: 'ps aux | grep hermes | grep -v grep' },
  { label: 'DISK USAGE', cmd: 'df -h /' },
  { label: 'NETWORK IP', cmd: 'ip -brief address' },
  { label: 'OPEN PORTS', cmd: 'ss -tuln | head -n 12' },
  { label: 'DISTRO SPEC', cmd: 'cat /etc/os-release | grep PRETTY_NAME' },
];

export const WslTerminalDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const runCommand = async (cmdToRun: string) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed || isRunning) return;

    soundFx.playTerminalCommand();
    setIsRunning(true);
    setHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 30));
    setHistoryIndex(-1);

    const logId = Math.random().toString(36).substring(7);
    const newLog: CommandLog = {
      id: logId,
      command: trimmed,
      stdout: '',
      stderr: '',
      exitCode: 0,
      timestamp: new Date().toLocaleTimeString(),
    };

    setLogs((prev) => [...prev, newLog]);

    try {
      const res = await fetch('/api/system/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
      });
      const data = await res.json();

      setLogs((prev) =>
        prev.map((log) =>
          log.id === logId
            ? {
                ...log,
                stdout: data.stdout || '',
                stderr: data.stderr || '',
                exitCode: data.exitCode ?? 0,
              }
            : log
        )
      );

      if (data.exitCode === 0) {
        soundFx.playClick(1200);
      } else {
        soundFx.playJarvisAlert();
      }
    } catch (err: any) {
      setLogs((prev) =>
        prev.map((log) =>
          log.id === logId
            ? {
                ...log,
                stderr: err.message || 'Execution error',
                exitCode: 1,
              }
            : log
        )
      );
    } finally {
      setIsRunning(false);
      setCommand('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(command);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setCommand(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIdx = historyIndex - 1;
        setHistoryIndex(prevIdx);
        setCommand(history[prevIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const handleCopy = (log: CommandLog) => {
    const textToCopy = `$ ${log.command}\n${log.stdout || log.stderr}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(log.id);
    soundFx.playClick(1400);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const clearLogs = () => {
    soundFx.playClick();
    setLogs([]);
  };

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          onClick={() => soundFx.playClick(850)}
          className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-background/60 px-2 py-1 text-xs font-mono font-bold text-primary transition-all hover:border-accent hover:bg-primary/20 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] backdrop-blur-sm"
          title="Open WSL2 Live Command Shell"
        >
          <Terminal size={13} className="text-accent animate-pulse" />
          <span className="hidden 2xl:inline text-[10px]">SHELL</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl border-l-2 border-primary/40 bg-background/95 backdrop-blur-2xl p-0 flex flex-col font-mono text-primary shadow-[0_0_50px_hsl(var(--primary)/0.35)]"
      >
        {/* Terminal Header */}
        <SheetHeader className="p-4 border-b border-primary/25 bg-primary/5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg border border-accent/50 bg-accent/20 flex items-center justify-center">
              <Terminal size={16} className="text-accent" />
            </div>
            <div>
              <SheetTitle className={cn('text-sm font-black tracking-widest text-foreground', orbitron.className)}>
                KALI WSL2 // COMMAND MATRIX
              </SheetTitle>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>BASH SHELL // PID 358 INTEROP</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-6">
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              className="h-7 text-[10px] border-primary/30 text-muted-foreground hover:text-destructive hover:border-destructive"
              title="Clear Terminal Output"
            >
              <Trash2 size={12} className="mr-1" />
              <span>CLEAR</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Quick Command Chips */}
        <div className="p-3 border-b border-primary/15 bg-background/70 flex flex-wrap gap-1.5">
          <span className="text-[10px] text-muted-foreground flex items-center pr-1">
            <Sparkles size={11} className="mr-1 text-accent" /> PRESETS:
          </span>
          {PRESET_COMMANDS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => runCommand(preset.cmd)}
              disabled={isRunning}
              className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/25 hover:border-accent hover:text-accent transition-all disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Terminal Output Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/80 font-mono text-xs select-text">
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6 opacity-70">
              <Terminal size={40} className="mb-2 text-primary/40 animate-pulse" />
              <p className="text-xs uppercase tracking-widest text-primary font-bold">
                STARK PROTOCOL // SHELL READY
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                Execute live Linux commands inside the Kali WSL2 subsystem. Choose a preset above or type below.
              </p>
            </div>
          )}

          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-primary/20 bg-background/50 p-3 shadow-inner space-y-2 group"
            >
              <div className="flex items-center justify-between border-b border-primary/15 pb-1 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="text-accent font-bold">thecyberexpert@kali:~$</span>
                  <span className="text-foreground font-bold">{log.command}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{log.timestamp}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded text-[9px] font-bold',
                      log.exitCode === 0
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : 'bg-destructive/30 text-destructive border border-destructive/40'
                    )}
                  >
                    CODE {log.exitCode}
                  </span>
                  <button
                    onClick={() => handleCopy(log)}
                    className="text-muted-foreground hover:text-accent transition-colors"
                    title="Copy command & output"
                  >
                    {copiedId === log.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {log.stdout && (
                <pre className="whitespace-pre-wrap break-all text-[11px] text-emerald-300/90 font-mono bg-black/50 p-2 rounded border border-primary/10 overflow-x-auto">
                  {log.stdout}
                </pre>
              )}

              {log.stderr && (
                <pre className="whitespace-pre-wrap break-all text-[11px] text-destructive font-mono bg-destructive/10 p-2 rounded border border-destructive/20 overflow-x-auto">
                  {log.stderr}
                </pre>
              )}
            </div>
          ))}

          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-accent animate-pulse font-mono py-2">
              <RefreshCw size={12} className="animate-spin" />
              <span>EXECUTING IN WSL2 SUBSYSTEM...</span>
            </div>
          )}

          <div ref={terminalBottomRef} />
        </div>

        {/* Terminal Input Bar */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-primary/25 bg-background/90 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent font-bold text-xs">
              $
            </span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type bash command (e.g. uptime, free -h, hermes status)..."
              disabled={isRunning}
              className="pl-7 pr-3 h-10 bg-black/60 border-primary/30 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-accent"
            />
          </div>
          <Button
            type="submit"
            disabled={!command.trim() || isRunning}
            className="h-10 px-4 border border-accent/40 bg-accent/20 text-accent hover:bg-accent hover:text-black font-mono font-bold text-xs"
          >
            <Play size={13} className="mr-1" />
            <span>RUN</span>
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};
