'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Zap,
  Terminal,
  Shield,
  Layers,
  Cpu,
  Radio,
  Mic,
  MessageSquare,
  Flame,
  Volume2,
  VolumeX,
  Palette,
  Settings,
  HardDrive,
  Activity,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { soundFx } from '@/lib/audio-synth';
import { type AppMode } from '@/app/page';

interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: 'PROTOCOLS' | 'SYSTEM' | 'NAVIGATION' | 'AUDIO';
  icon: React.ReactNode;
  shortcut?: string;
  tags?: string[];
  action: () => void;
}

interface JarvisCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setMode: (mode: AppMode) => void;
  onRunProtocol?: (title: string, protocol: string, query?: string) => void;
  onBoost?: () => void;
  onOpenVoice?: () => void;
  onOpenTerminal?: () => void;
  onOpenSettings?: () => void;
  onOpenConfig?: () => void;
  onToggleSound?: () => void;
  isMuted?: boolean;
}

export const JarvisCommandPalette: React.FC<JarvisCommandPaletteProps> = ({
  isOpen,
  onClose,
  setMode,
  onRunProtocol,
  onBoost,
  onOpenVoice,
  onOpenTerminal,
  onOpenSettings,
  onOpenConfig,
  onToggleSound,
  isMuted = false,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'boost',
      title: 'Reactor Overclock Surge & RAM Purge',
      description: 'Flush dirty memory pages, compact SQLite WAL, and surge CPU clock',
      category: 'PROTOCOLS',
      icon: <Flame size={16} className="text-destructive animate-pulse" />,
      shortcut: 'B',
      tags: ['arc', 'reactor', 'overclock', 'surge', 'ram', 'purge', 'memory', 'cpu', 'boost', 'clean'],
      action: () => {
        onClose();
        if (onRunProtocol) {
          onRunProtocol('Reactor Overclock & Memory Purge', 'PROTOCOL: HYPER_BOOST');
        } else if (onBoost) {
          onBoost();
        }
      },
    },
    {
      id: 'verify-skills',
      title: 'Verify 61 Arsenal Skills Matrix',
      description: 'Audit and inspect all 61 active cybersecurity, network, and automation tools',
      category: 'PROTOCOLS',
      icon: <Shield size={16} className="text-emerald-400" />,
      shortcut: 'P1',
      tags: ['skills', 'arsenal', 'tools', 'matrix', 'audit', 'cybersecurity', 'verify'],
      action: () => {
        onClose();
        if (onRunProtocol) {
          onRunProtocol('Verify 61 Arsenal Skills Matrix', 'PROTOCOL: SKILL_ARSENAL_VERIFY', 'Audit and verify all 61 active cybersecurity, network, and automation tools in WSL.');
        }
      },
    },
    {
      id: 'deep-diagnostics',
      title: 'Deep WSL Subsystem Diagnostics',
      description: 'Inspect virtual memory, load averages, and top running WSL processes',
      category: 'PROTOCOLS',
      icon: <Cpu size={16} className="text-primary" />,
      shortcut: 'P2',
      tags: ['diagnostics', 'system', 'subsystem', 'wsl', 'processes', 'load', 'memory'],
      action: () => {
        onClose();
        if (onRunProtocol) {
          onRunProtocol('Deep WSL Subsystem Diagnostics', 'PROTOCOL: SYSTEM_DIAGNOSTICS', 'Check current memory, CPU usage, and top running WSL processes in Kali Linux.');
        }
      },
    },
    {
      id: 'gateway-probe',
      title: 'Hermes Gateway Telemetry Probe',
      description: 'Inspect status of Hermes gateway daemon, Telegram, and socket state',
      category: 'PROTOCOLS',
      icon: <Radio size={16} className="text-accent" />,
      shortcut: 'P3',
      tags: ['hermes', 'probe', 'gateway', 'pid', 'telegram', 'status', 'socket', 'telemetry'],
      action: () => {
        onClose();
        if (onRunProtocol) {
          onRunProtocol('Hermes Gateway Telemetry Probe', 'PROTOCOL: HERMES_GATEWAY_PROBE', 'Inspect status of Hermes gateway daemon PID 358 and messaging channels.');
        }
      },
    },
    {
      id: 'port-audit',
      title: 'Perimeter Port & Network Security Audit',
      description: 'Scan open Kali WSL2 listening sockets, firewall perimeter, and routing',
      category: 'PROTOCOLS',
      icon: <Activity size={16} className="text-accent" />,
      shortcut: 'P4',
      tags: ['perimeter', 'ports', 'firewall', 'network', 'kali', 'security', 'audit', 'sockets'],
      action: () => {
        onClose();
        if (onRunProtocol) {
          onRunProtocol('WSL Perimeter & Port Security Audit', 'PROTOCOL: KALI_SECURITY_AUDIT', 'Perform a quick security audit of current ports and network interface in WSL.');
        }
      },
    },
    {
      id: 'nav-chat',
      title: 'Switch to Hermes AI Chat Mode',
      description: 'Engage Nemotron-3 Ultra 550B neural conversation and code generation',
      category: 'NAVIGATION',
      icon: <MessageSquare size={16} className="text-primary" />,
      shortcut: 'C',
      tags: ['chat', 'hermes', 'ai', 'conversation', 'assistant', 'prompt', 'code', 'talk'],
      action: () => {
        onClose();
        soundFx.playClick(1100);
        setMode('chat');
      },
    },
    {
      id: 'nav-hud',
      title: 'Switch to Holographic OS HUD',
      description: 'Return to the central Stark Mark-85 3D gyroscopic dashboard',
      category: 'NAVIGATION',
      icon: <Layers size={16} className="text-primary" />,
      shortcut: 'ESC',
      tags: ['hud', 'dashboard', 'mark85', 'hologram', 'os', 'home', 'reactor'],
      action: () => {
        onClose();
        soundFx.playClick(900);
        setMode('hud');
      },
    },
    {
      id: 'godseye-console',
      title: "God's Eye 3D Earth Geospatial Console",
      description: 'Open in-UI 3D Earth satellite reconnaissance window with orbital camera',
      category: 'NAVIGATION',
      icon: <Globe size={16} className="text-accent" />,
      shortcut: 'G',
      tags: ['godseye', 'earth', 'globe', 'satellite', 'cesium', 'osint', 'geo', 'recon', 'map'],
      action: () => {
        onClose();
        soundFx.playClick(1000);
        window.dispatchEvent(new CustomEvent('hermes:open-godseye'));
      },
    },
    {
      id: 'voice-hud',
      title: 'Launch Hermes Voice Interaction HUD',
      description: 'Activate speech recognition and wake-word "Hermes" detection',
      category: 'NAVIGATION',
      icon: <Mic size={16} className="text-accent" />,
      shortcut: 'V',
      tags: ['voice', 'speech', 'mic', 'microphone', 'speak', 'talk', 'audio', 'hud'],
      action: () => {
        onClose();
        soundFx.playClick(1000);
        if (onOpenVoice) onOpenVoice();
      },
    },
    {
      id: 'wsl-terminal',
      title: 'Open Kali Linux Live Terminal',
      description: 'Launch interactive pseudo-terminal attached to WSL2 bash shell',
      category: 'SYSTEM',
      icon: <Terminal size={16} className="text-emerald-400" />,
      shortcut: 'T',
      tags: ['terminal', 'bash', 'shell', 'wsl', 'kali', 'cli', 'console'],
      action: () => {
        onClose();
        soundFx.playClick(1000);
        if (onOpenTerminal) onOpenTerminal();
      },
    },
    {
      id: 'hermes-config',
      title: 'Hermes Agent Configurations Matrix',
      description: 'Manage ~/.hermes/config.yaml, model presets, SOUL.md personality, API keys & gateways',
      category: 'SYSTEM',
      icon: <SlidersHorizontal size={16} className="text-accent" />,
      shortcut: 'H',
      tags: ['config', 'configuration', 'hermes', 'yaml', 'model', 'soul', 'keys', 'temperature', 'tokens', 'gateway', 'settings'],
      action: () => {
        onClose();
        soundFx.playClick(1000);
        if (onOpenConfig) onOpenConfig();
      },
    },
    {
      id: 'system-settings',
      title: 'Open Subsystem Settings & AI Config',
      description: 'Configure model parameters, voice synthesizer rate, and network proxies',
      category: 'SYSTEM',
      icon: <Settings size={16} className="text-primary" />,
      shortcut: 'S',
      tags: ['settings', 'config', 'preferences', 'models', 'gateway', 'options'],
      action: () => {
        onClose();
        soundFx.playClick(1000);
        if (onOpenSettings) onOpenSettings();
      },
    },
    {
      id: 'toggle-sound',
      title: isMuted ? 'Unmute Futuristic Sound FX' : 'Mute Futuristic Sound FX',
      description: 'Toggle real-time Web Audio API synthesizer feedback and alerts',
      category: 'AUDIO',
      icon: isMuted ? <VolumeX size={16} className="text-muted-foreground" /> : <Volume2 size={16} className="text-accent" />,
      shortcut: 'M',
      tags: ['sound', 'audio', 'mute', 'unmute', 'fx', 'synth', 'volume'],
      action: () => {
        onClose();
        if (onToggleSound) onToggleSound();
      },
    },
  ], [isMuted, onClose, onRunProtocol, onBoost, onOpenVoice, onOpenTerminal, onOpenSettings, onOpenConfig, onToggleSound, setMode]);

  // Filter commands by search term with multi-attribute & tags search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const lower = search.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower) ||
        c.category.toLowerCase().includes(lower) ||
        (c.shortcut && c.shortcut.toLowerCase().includes(lower)) ||
        (c.tags && c.tags.some((t) => t.includes(lower)))
    );
  }, [commands, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Arrow key navigation & enter execution
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
        soundFx.playHover();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
        soundFx.playHover();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border border-primary/40 bg-background/95 backdrop-blur-3xl p-0 shadow-[0_0_60px_hsl(var(--primary)/0.35)] overflow-hidden font-headline">
        <DialogHeader className="sr-only">
          <DialogTitle>J.A.R.V.I.S. Tactical Command Palette</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar (Pr-24 and mr-8 prevent collision with dialog close button) */}
        <div className="relative flex items-center border-b border-primary/20 px-4 py-3 bg-primary/5">
          <Search size={18} className="text-primary mr-3 shrink-0 animate-pulse" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Stark protocols, commands, skills..."
            autoFocus
            className="w-full bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none pr-4"
          />
          <span className="text-[10px] font-mono text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/40 shrink-0 select-none mr-8 hidden sm:inline">
            ESC TO EXIT
          </span>
        </div>

        {/* Command List */}
        <div className="max-h-[55vh] overflow-y-auto p-2 pb-8 space-y-1 scrollbar-thin">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-mono text-xs">
              <Sparkles size={24} className="mx-auto text-primary/40 mb-2 animate-bounce" />
              <span>No matching autonomous protocols found for "{search}"</span>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 border',
                    isSelected
                      ? 'bg-primary/20 border-primary text-foreground shadow-[0_0_15px_hsl(var(--primary)/0.25)] translate-x-1'
                      : 'border-transparent hover:bg-primary/10 text-muted-foreground'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'p-2 rounded-lg border transition-colors shrink-0',
                        isSelected
                          ? 'border-primary/60 bg-primary/30 text-accent'
                          : 'border-primary/20 bg-background/60 text-primary'
                      )}
                    >
                      {cmd.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {cmd.title}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/25">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-[11px] font-sans text-muted-foreground truncate max-w-md">
                        {cmd.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold text-accent bg-accent/10 border border-accent/40 rounded">
                        [{cmd.shortcut}]
                      </kbd>
                    )}
                    <ArrowRight
                      size={14}
                      className={cn(
                        'transition-transform',
                        isSelected ? 'text-accent translate-x-1' : 'opacity-0'
                      )}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-primary/20 bg-background/80 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ TO NAVIGATE</span>
            <span>•</span>
            <span>ENTER TO RUN</span>
            <span>•</span>
            <span>CTRL+K TO TOGGLE</span>
          </div>
          <div className="flex items-center gap-1.5 text-accent font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>HERMES v0.21.6 ONLINE</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JarvisCommandPalette;
