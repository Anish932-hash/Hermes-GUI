'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Monitor,
  FolderOpen,
  Globe,
  Sparkles,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  Cpu,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { soundFx } from '@/lib/audio-synth';
import { WindowsAppLauncher } from './windows-app-launcher';

interface WindowsBridgeTelemetry {
  isWsl: boolean;
  windowsUser: string;
  hasWindowsTerminal: boolean;
  windowsTerminalPath?: string;
  installedBrowsers: Array<{ name: string; path: string; available: boolean }>;
  distroName: string;
  isStandaloneAppInstalled?: boolean;
  isStandaloneAppRunning?: boolean;
}

interface WindowsKaliBridgeProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerAutoSetup?: () => void;
}

export function WindowsKaliBridgeModal({
  isOpen,
  onOpenChange,
  onTriggerAutoSetup,
}: WindowsKaliBridgeProps) {
  const { toast } = useToast();
  const [telemetry, setTelemetry] = useState<WindowsBridgeTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string>('');

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/system/windows-bridge');
      const data = await res.json();
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      }
    } catch (e) {
      console.warn('Failed to fetch Windows bridge telemetry', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
    }
  }, [isOpen]);

  const executeAction = async (action: string, label: string) => {
    setIsLoading(true);
    soundFx.playClick(1100);
    setActionStatus(`Executing ${label}...`);

    try {
      const res = await fetch('/api/system/windows-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (data.success) {
        soundFx.playTaskSuccess();
        toast({
          title: `[✔] ${label} Successful`,
          description: data.message || 'Action executed on Windows host.',
        });
        setActionStatus(`Completed: ${data.message}`);
      } else {
        toast({
          title: `Action Notice`,
          description: data.error || 'Operation returned non-standard status.',
          variant: 'destructive',
        });
        setActionStatus(`Warning: ${data.error || 'Execution notice'}`);
      }
    } catch (err: any) {
      toast({
        title: 'Windows Bridge Error',
        description: err.message,
        variant: 'destructive',
      });
      setActionStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-black/90 border border-primary/40 backdrop-blur-2xl text-foreground font-mono shadow-[0_0_50px_hsl(var(--primary)/0.25)] p-0 overflow-hidden">
        {/* Header HUD */}
        <div className="relative border-b border-primary/20 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-primary/50 bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
                <Monitor className="h-5 w-5 text-accent animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-wider text-foreground uppercase flex items-center gap-2">
                  <span>WINDOWS HOST & KALI ORCHESTRATOR</span>
                  <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono">
                    ONLINE
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Autonomous Zero-Touch Orchestration: WSL2 Kali, Dedicated Desktop App Windows & Subsystems
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Windows Host Diagnostics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                <Shield size={12} className="text-primary" />
                <span>Host User</span>
              </div>
              <div className="mt-1 text-sm font-bold text-foreground">
                {telemetry?.windowsUser?.toUpperCase() || 'ANISH'}
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                <Cpu size={12} className="text-accent" />
                <span>WSL Distro</span>
              </div>
              <div className="mt-1 text-sm font-bold text-accent">
                {telemetry?.distroName || 'kali-linux'}
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                <Terminal size={12} className="text-emerald-400" />
                <span>Win Terminal</span>
              </div>
              <div className="mt-1 text-sm font-bold text-emerald-400">
                {telemetry?.hasWindowsTerminal ? 'READY' : 'STANDBY'}
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                <Layers size={12} className="text-blue-400" />
                <span>App Window</span>
              </div>
              <div className="mt-1 text-sm font-bold text-blue-400">
                {telemetry?.isStandaloneAppRunning ? 'ACTIVE' : (telemetry?.isStandaloneAppInstalled ? 'READY' : 'ELECTRON')}
              </div>
            </div>
          </div>

          {/* Windows Native Application Deploy Info */}
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3.5 space-y-1.5">
            <div className="text-xs font-bold text-primary flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <span>NATIVE WINDOWS DESKTOP SHORTCUTS CONFIGURED</span>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div>
                • <strong className="text-foreground">Hermes Agent OS.lnk:</strong> Double-click directly on your Windows Desktop to auto-setup and launch the full multi-window cockpit.
              </div>
              <div>
                • <strong className="text-foreground">Hermes Kali Linux.lnk:</strong> Instant 1-click launch of the interactive Kali Linux terminal.
              </div>
              <div className="text-[10px] text-primary/70 font-mono mt-1">
                Executable Path: <code className="text-accent">C:\Users\anish\Hermes-Agent-OS\Hermes-Agent-OS.exe</code>
              </div>
            </div>
          </div>

          {/* Quick Launch Control Center */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Play size={12} className="text-primary" />
              <span>Host Actions & Multi-Window Spawners</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Spawner 1: Kali Terminal */}
              <button
                onClick={() => executeAction('launch-kali', 'Kali Linux Terminal')}
                disabled={isLoading}
                className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Terminal size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>SPAWN KALI TERMINAL</span>
                    <kbd className="px-1 py-0.2 text-[9px] bg-emerald-500/20 rounded border border-emerald-500/40 text-emerald-300">
                      K
                    </kbd>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Opens interactive Windows Terminal tab with Kali shell
                  </div>
                </div>
              </button>

              {/* Spawner 2: Dedicated Desktop App Window */}
              <button
                onClick={() => executeAction('launch-studio-app', 'Hermes Borderless App Window')}
                disabled={isLoading}
                className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                  <Monitor size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span>LAUNCH APP WINDOW</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Spawns borderless standalone Windows application frame
                  </div>
                </div>
              </button>

              {/* Spawner 3: God's Eye 3D Earth */}
              <button
                onClick={() => executeAction('launch-godseye', "God's Eye 3D Earth")}
                disabled={isLoading}
                className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-500/40 bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                  <Globe size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <span>LAUNCH GOD'S EYE 3D</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Opens Cesium 3D Earth in dedicated desktop app window
                  </div>
                </div>
              </button>

              {/* Spawner 4: Open Windows Explorer */}
              <button
                onClick={() => executeAction('open-explorer', 'Windows Explorer')}
                disabled={isLoading}
                className="flex items-center gap-3 p-3 rounded-lg border border-accent/30 bg-accent/10 hover:bg-accent/20 hover:border-accent/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent/20 text-accent group-hover:scale-110 transition-transform">
                  <FolderOpen size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                    <span>OPEN IN EXPLORER</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Opens Windows Explorer to WSL studio codebase
                  </div>
                </div>
              </button>
            </div>
          </div>

          <WindowsAppLauncher />

          {/* Action Log Status */}
          {actionStatus && (
            <div className="rounded border border-primary/20 bg-background/80 p-2 text-[11px] font-mono text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
              <span>{actionStatus}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-primary/20 bg-background/60 p-3.5 flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground font-mono">
            Press <kbd className="px-1 py-0.2 bg-primary/10 rounded border border-primary/20 text-accent font-bold">K</kbd> anywhere to spawn Kali Terminal
          </div>
          <div className="flex items-center gap-2">
            {onTriggerAutoSetup && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  onTriggerAutoSetup();
                }}
                className="px-3 py-1.5 rounded border border-accent/40 bg-accent/15 text-accent text-xs font-bold hover:bg-accent/25 hover:border-accent transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                <span>FULL AUTO-SETUP</span>
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
