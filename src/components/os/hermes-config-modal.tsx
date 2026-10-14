'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  SlidersHorizontal,
  Cpu,
  RotateCcw,
  Volume2,
  Sparkles,
  Terminal,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileCode,
  Shield,
  Key,
  Radio,
  Sliders,
  Settings,
  Brain,
  Layers,
  Save,
  Check,
  Send,
  Wrench,
  Flame,
  Zap,
} from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';

interface HermesConfigModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

export const HermesConfigModal: React.FC<HermesConfigModalProps> = ({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  triggerButton,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const [activeTab, setActiveTab] = useState('model');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Configuration State
  const [model, setModel] = useState('nvidia/nemotron-3-ultra-550b-a55b');
  const [provider, setProvider] = useState('nvidia');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [streaming, setStreaming] = useState(true);
  const [reasoning, setReasoning] = useState('on');
  const [maxSessions, setMaxSessions] = useState(5);
  const [soulPrompt, setSoulPrompt] = useState('');
  const [rawYaml, setRawYaml] = useState('');
  const [configPath, setConfigPath] = useState('~/.hermes/config.yaml');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [envKeys, setEnvKeys] = useState<Record<string, boolean>>({});

  // Gateway Service state
  const [gatewayStatus, setGatewayStatus] = useState<any>({ active: true, output: '' });
  const [gatewayLogs, setGatewayLogs] = useState('');

  const { toast } = useToast();

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const [configRes, gatewayRes] = await Promise.all([
        fetch('/api/hermes/config'),
        fetch('/api/hermes/gateway'),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        if (data.model) setModel(data.model);
        if (data.provider) setProvider(data.provider);
        if (data.temperature !== undefined) setTemperature(data.temperature);
        if (data.maxTokens !== undefined) setMaxTokens(data.maxTokens);
        if (data.streaming !== undefined) setStreaming(data.streaming);
        if (data.reasoning) setReasoning(data.reasoning);
        if (data.maxSessions !== undefined) setMaxSessions(data.maxSessions);
        if (data.soulPrompt) setSoulPrompt(data.soulPrompt);
        if (data.rawYaml) setRawYaml(data.rawYaml);
        if (data.configPath) setConfigPath(data.configPath);
        if (data.availableModels) setAvailableModels(data.availableModels);
        if (data.availableProviders) setAvailableProviders(data.availableProviders);
        if (data.envKeys) setEnvKeys(data.envKeys);
      }

      if (gatewayRes.ok) {
        const gwData = await gatewayRes.json();
        setGatewayStatus(gwData);
        setGatewayLogs(gwData.logs || '');
      }
    } catch (err: any) {
      console.warn('Failed to load Hermes configuration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  // Save Structured Model & Inference Settings
  const handleSaveInference = async () => {
    soundFx.playClick(1000);
    setIsSaving(true);
    try {
      const res = await fetch('/api/hermes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          provider,
          temperature,
          maxTokens,
          streaming,
          reasoning,
          maxSessions,
        }),
      });

      if (res.ok) {
        soundFx.playTaskSuccess();
        toast({
          title: 'Hermes Configuration Saved',
          description: `Applied model: ${model} (${provider}) with temperature ${temperature}`,
        });
        await loadConfig();
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err: any) {
      toast({
        title: 'Save Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save SOUL Personality Prompt
  const handleSaveSoul = async () => {
    if (!window.confirm('Save the Hermes SOUL.md instructions?\n\nThis changes the system-level instructions Hermes reads. Continue only if you trust the new content.')) return;
    soundFx.playClick(1000);
    setIsSaving(true);
    try {
      const res = await fetch('/api/hermes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soulPrompt, confirmation: 'config.soul-write' }),
      });

      if (res.ok) {
        soundFx.playTaskSuccess();
        toast({
          title: 'Hermes SOUL Updated',
          description: 'Custom instructions saved directly to ~/.hermes/SOUL.md',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error Updating SOUL.md',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save Raw YAML
  const handleSaveRawYaml = async () => {
    if (!window.confirm('Apply the complete raw Hermes config.yaml?\n\nThis replaces the active configuration file. A backup will be created, but invalid settings can prevent the runtime from starting.')) return;
    soundFx.playClick(1000);
    setIsSaving(true);
    try {
      const res = await fetch('/api/hermes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawYaml, confirmation: 'config.raw-write' }),
      });

      if (res.ok) {
        soundFx.playTaskSuccess();
        toast({
          title: 'Config.yaml Applied',
          description: 'Updated ~/.hermes/config.yaml. A backup copy was archived at config.yaml.bak.',
        });
        await loadConfig();
      }
    } catch (err: any) {
      toast({
        title: 'Error Saving YAML',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Gateway Service Actions
  const handleGatewayAction = async (action: 'restart' | 'stop' | 'start') => {
    if (action !== 'start' && !window.confirm(`Confirm ${action} Hermes Gateway?\n\n${action === 'restart' ? 'Active sessions may be interrupted while the gateway restarts.' : 'Active sessions may be interrupted and the gateway will stop.'}`)) return;
    soundFx.playClick(900);
    setIsSaving(true);
    try {
      const res = await fetch('/api/hermes/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(action !== 'start' ? { confirmation: `gateway.${action}` } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: `Gateway ${action.toUpperCase()}`,
          description: data.message || `Service command ${action} executed.`,
        });
        await loadConfig();
      }
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Presets for SOUL Persona
  const applySoulPreset = (presetName: string) => {
    soundFx.playClick(800);
    let prompt = '';
    if (presetName === 'stark') {
      prompt = `You are Hermes Agent, enhanced with the Stark Mark-85 tactical operating persona. Be hyper-direct, rigorous, and technically precise. Deliver immediate actionable reports without conversational filler or apologies. When running cybersecurity diagnostics, code refactoring, or automation routines, format outputs with clear execution milestones and verify all side effects. Depth is delivered on demand with mathematical clarity.`;
    } else if (presetName === 'security') {
      prompt = `You are Hermes Agent operating as an autonomous Offensive & Defensive Cybersecurity specialist in Kali Linux WSL2. Prioritize perimeter defense, port scanning, vulnerability audits, log parsing, and secure hardening. Flag any open attack surfaces or unvalidated binaries with severity badges [CRITICAL], [HIGH], [MEDIUM], [INFO]. Keep instructions strictly executable via bash and Python tooling.`;
    } else if (presetName === 'architect') {
      prompt = `You are Hermes Agent operating as a Principal Fullstack Systems Architect. You specialize in Next.js, Node.js, TypeScript, SQLite WAL optimization, real-time WebSockets, and high-performance frontend interfaces. Focus on clean architecture, zero-dependency efficiency, and strict type safety.`;
    } else if (presetName === 'default') {
      prompt = `You are Hermes Agent, built by Nous Research. Be direct: match the length of your reply to the weight of the ask — a one-line question gets a one-line answer, and finished work gets a short report of what changed, what's verified, and what's left, never a replay of the process. Plain claims over adjectives; when unsure, say so plainly. Agree because it's right, not because the user said it. Depth is earned — give it when the user asks for detail, teaches, or the stakes demand it, not by default.`;
    }
    setSoulPrompt(prompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {triggerButton ? (
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <button
            onClick={() => soundFx.playClick(900)}
            className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-background/60 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-accent hover:border-accent hover:shadow-[0_0_15px_hsl(var(--primary)/0.25)] transition-all shrink-0 cursor-pointer"
            title="Hermes Agent Configurations [~/.hermes/config.yaml]"
          >
            <SlidersHorizontal size={13} className="text-primary" />
            <span className="hidden 2xl:inline text-[11px] font-bold">CONFIG</span>
          </button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-thin border border-primary/40 bg-background/95 backdrop-blur-2xl p-4 sm:p-6 font-headline text-foreground shadow-[0_0_60px_hsl(var(--primary)/0.3)]">
        <DialogHeader className="border-b border-primary/20 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-accent bg-accent/20 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]">
                <Wrench size={18} />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <DialogTitle className={cn('text-base sm:text-lg font-black tracking-widest text-primary [text-shadow:0_0_10px_hsl(var(--primary))]', orbitron.className)}>
                  HERMES // CONFIGURATION MATRIX
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                  <span>~/.hermes/config.yaml</span>
                  <span>•</span>
                  <span className="text-accent">Live Model, Inference, Gateway & Persona</span>
                </DialogDescription>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary hover:bg-primary/20 cursor-pointer"
              onClick={loadConfig}
              disabled={isLoading}
              title="Reload from disk"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="model" value={activeTab} onValueChange={setActiveTab} className="mt-3 w-full">
          <TabsList className="grid grid-cols-5 bg-primary/10 border border-primary/20 p-1 rounded-xl">
            <TabsTrigger value="model" className="text-xs font-mono font-bold flex items-center gap-1">
              <Cpu size={12} /> <span className="hidden sm:inline">Model</span>
            </TabsTrigger>
            <TabsTrigger value="soul" className="text-xs font-mono font-bold flex items-center gap-1">
              <Brain size={12} /> <span className="hidden sm:inline">Persona</span>
            </TabsTrigger>
            <TabsTrigger value="gateway" className="text-xs font-mono font-bold flex items-center gap-1">
              <Radio size={12} /> <span className="hidden sm:inline">Gateway</span>
            </TabsTrigger>
            <TabsTrigger value="keys" className="text-xs font-mono font-bold flex items-center gap-1">
              <Key size={12} /> <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="yaml" className="text-xs font-mono font-bold flex items-center gap-1">
              <FileCode size={12} /> <span className="hidden sm:inline">YAML</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MODEL & INFERENCE */}
          <TabsContent value="model" className="space-y-4 pt-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-primary/90 uppercase tracking-wider">
                  Active Inference Model:
                </span>
                <span className="text-[10px] font-mono text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/30">
                  PROVIDER: {provider.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableModels.map((m) => {
                  const isSelected = model === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        soundFx.playClick(900);
                        setModel(m.id);
                        if (m.provider) setProvider(m.provider);
                      }}
                      className={cn(
                        'flex flex-col justify-between rounded-xl border p-3 cursor-pointer transition-all duration-200',
                        isSelected
                          ? 'border-accent bg-primary/20 shadow-[0_0_18px_hsl(var(--primary)/0.25)]'
                          : 'border-primary/15 bg-background/50 hover:border-primary/35 hover:bg-primary/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                            <span>{m.label}</span>
                            {m.recommended && (
                              <span className="rounded bg-emerald-400/20 px-1 py-0.2 text-[8px] text-emerald-400 font-mono font-bold">
                                REC
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-sans mt-0.5 leading-snug line-clamp-2">
                            {m.description}
                          </p>
                        </div>
                        {isSelected ? (
                          <CheckCircle size={15} className="text-accent shrink-0 mt-0.5" />
                        ) : (
                          <span className="h-3 w-3 rounded-full border border-primary/30 shrink-0 mt-1" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mt-2 pt-1 border-t border-primary/10">
                        <span className="text-primary/70">Context: {m.contextWindow || '64k'}</span>
                        <span className="text-accent">{m.provider.toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inference Parameters */}
            <div className="rounded-xl border border-primary/20 bg-background/50 p-3.5 space-y-3 font-mono text-xs">
              <span className="text-[11px] font-bold text-primary uppercase tracking-widest block">
                Inference Hyperparameters:
              </span>

              {/* Temperature Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground">Temperature (Sampling Randomness):</span>
                  <span className="font-bold text-accent">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-primary/20 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>0.00 (Deterministic / Cyber CLI)</span>
                  <span>0.70 (Standard Agent)</span>
                  <span>1.00 (Creative)</span>
                </div>
              </div>

              {/* Max Tokens & Reasoning Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-primary/10">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Max Output Tokens:</label>
                  <div className="flex items-center gap-1.5">
                    {[2048, 4096, 8192, 16384].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMaxTokens(t)}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer',
                          maxTokens === t
                            ? 'bg-accent/20 border-accent text-accent font-bold shadow-sm'
                            : 'border-primary/20 bg-primary/5 text-muted-foreground hover:bg-primary/10'
                        )}
                      >
                        {t >= 1000 ? `${t / 1024}k` : t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Reasoning Mode:</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReasoning('on')}
                      className={cn(
                        'flex-1 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer',
                        reasoning === 'on'
                          ? 'bg-emerald-400/20 border-emerald-400 text-emerald-400 font-bold'
                          : 'border-primary/20 bg-primary/5 text-muted-foreground'
                      )}
                    >
                      ON (Chain-of-Thought)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReasoning('off')}
                      className={cn(
                        'flex-1 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer',
                        reasoning === 'off'
                          ? 'bg-destructive/20 border-destructive text-destructive font-bold'
                          : 'border-primary/20 bg-primary/5 text-muted-foreground'
                      )}
                    >
                      OFF (Direct Output)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={handleSaveInference}
                disabled={isSaving}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs cursor-pointer shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              >
                <Save size={13} />
                <span>Save Inference Configuration</span>
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: SOUL & PERSONA */}
          <TabsContent value="soul" className="space-y-3 pt-3 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary block">Hermes SOUL Instructions (~/.hermes/SOUL.md)</span>
                <span className="text-[10px] text-muted-foreground">The foundational personality, style, and operational persona.</span>
              </div>

              {/* Persona Presets */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground mr-1 hidden sm:inline">Presets:</span>
                <button
                  type="button"
                  onClick={() => applySoulPreset('stark')}
                  className="px-2 py-0.5 rounded border border-accent/40 bg-accent/10 hover:bg-accent/25 text-[9px] text-accent font-bold transition-all cursor-pointer"
                  title="Stark Mark-85 Tactical Persona"
                >
                  ⚡ J.A.R.V.I.S.
                </button>
                <button
                  type="button"
                  onClick={() => applySoulPreset('security')}
                  className="px-2 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/25 text-[9px] text-emerald-400 font-bold transition-all cursor-pointer"
                  title="Offensive/Defensive Cyber Sec"
                >
                  🛡️ Cyber Sec
                </button>
                <button
                  type="button"
                  onClick={() => applySoulPreset('architect')}
                  className="px-2 py-0.5 rounded border border-primary/40 bg-primary/10 hover:bg-primary/25 text-[9px] text-primary font-bold transition-all cursor-pointer"
                  title="Senior Systems Architect"
                >
                  💻 Architect
                </button>
                <button
                  type="button"
                  onClick={() => applySoulPreset('default')}
                  className="px-2 py-0.5 rounded border border-primary/30 bg-background hover:bg-primary/15 text-[9px] text-muted-foreground transition-all cursor-pointer"
                  title="Original Nous Hermes Default"
                >
                  Original
                </button>
              </div>
            </div>

            <textarea
              value={soulPrompt}
              onChange={(e) => setSoulPrompt(e.target.value)}
              rows={8}
              placeholder="Enter system prompt and agent personality..."
              className="w-full rounded-xl border border-primary/30 bg-background/80 p-3 text-xs font-mono text-foreground focus:outline-none focus:border-accent leading-relaxed resize-y shadow-inner"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">Characters: {soulPrompt.length}</span>
              <Button
                onClick={handleSaveSoul}
                disabled={isSaving}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono cursor-pointer"
              >
                <Save size={13} />
                <span>Save SOUL Instructions</span>
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: GATEWAY & CHANNELS */}
          <TabsContent value="gateway" className="space-y-4 pt-3 font-mono">
            {/* Service Status & Action Bar */}
            <div className="rounded-xl border border-primary/25 bg-background/60 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">Hermes Gateway Service</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('h-2.5 w-2.5 rounded-full', gatewayStatus.active ? 'bg-emerald-400 animate-ping' : 'bg-destructive')} />
                  <span className="font-bold text-foreground text-sm">
                    {gatewayStatus.active ? 'ACTIVE // RUNNING (PID 358 / 410)' : 'OFFLINE // STOPPED'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGatewayAction('restart')}
                  disabled={isSaving}
                  className="h-8 gap-1.5 text-xs border-primary/40 hover:bg-primary/20 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Restart</span>
                </Button>
                {gatewayStatus.active ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleGatewayAction('stop')}
                    disabled={isSaving}
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                  >
                    <span>Stop</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleGatewayAction('start')}
                    disabled={isSaving}
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                  >
                    <span>Start</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Channels & Platforms */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">Connected Platforms & Transports:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl border border-primary/20 bg-background/50 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <span>Telegram Bot Bridge</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Channel ID: 8719182279</span>
                  </div>
                  <span className="text-[9px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded font-bold">
                    CONNECTED
                  </span>
                </div>

                <div className="rounded-xl border border-primary/20 bg-background/50 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <span>WhatsApp Multi-Device</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Session Store: ~/.hermes/whatsapp</span>
                  </div>
                  <span className="text-[9px] text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded font-bold">
                    PORT 3000
                  </span>
                </div>
              </div>
            </div>

            {/* Live Gateway Output Logs */}
            {gatewayLogs && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Gateway Daemon Output:</span>
                <pre className="rounded-xl border border-primary/20 bg-black/60 p-2.5 text-[10px] text-primary/80 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {gatewayLogs}
                </pre>
              </div>
            )}
          </TabsContent>

          {/* TAB 4: API KEYS & SECRETS */}
          <TabsContent value="keys" className="space-y-3 pt-3 font-mono">
            <div>
              <span className="text-xs font-bold text-primary block">Configured API Providers (~/.hermes/.env)</span>
              <span className="text-[10px] text-muted-foreground">Credentials are securely read and loaded into the Hermes execution environment.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl border border-primary/20 bg-background/50 p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-foreground block">NVIDIA NIM (Nemotron-3)</span>
                  <span className="text-[10px] text-muted-foreground">NVIDIA_API_KEY</span>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', envKeys.nvidia ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' : 'text-amber-400 bg-amber-400/10 border-amber-400/30')}>
                  {envKeys.nvidia ? 'CONFIGURED' : 'ENV INFERRED'}
                </span>
              </div>

              <div className="rounded-xl border border-primary/20 bg-background/50 p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-foreground block">OpenRouter Intelligence</span>
                  <span className="text-[10px] text-muted-foreground">OPENROUTER_API_KEY</span>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', envKeys.openrouter ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' : 'text-muted-foreground bg-primary/5 border-primary/20')}>
                  {envKeys.openrouter ? 'CONFIGURED' : 'UNSET'}
                </span>
              </div>

              <div className="rounded-xl border border-primary/20 bg-background/50 p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-foreground block">Tavily Web Search</span>
                  <span className="text-[10px] text-muted-foreground">TAVILY_API_KEY</span>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', envKeys.tavily ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' : 'text-muted-foreground bg-primary/5 border-primary/20')}>
                  {envKeys.tavily ? 'CONFIGURED' : 'UNSET'}
                </span>
              </div>

              <div className="rounded-xl border border-primary/20 bg-background/50 p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-foreground block">Google Gemini / AI Studio</span>
                  <span className="text-[10px] text-muted-foreground">GEMINI_API_KEY</span>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', envKeys.google ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' : 'text-muted-foreground bg-primary/5 border-primary/20')}>
                  {envKeys.google ? 'CONFIGURED' : 'UNSET'}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: RAW YAML EDITOR */}
          <TabsContent value="yaml" className="space-y-3 pt-3 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary block">Direct YAML Editor ({configPath})</span>
                <span className="text-[10px] text-muted-foreground">Direct configuration file with automated backup on save.</span>
              </div>
              <span className="text-[10px] text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/30">
                {rawYaml.split('\n').length} LINES
              </span>
            </div>

            <textarea
              value={rawYaml}
              onChange={(e) => setRawYaml(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-primary/30 bg-black/80 p-3 text-[11px] font-mono text-primary focus:outline-none focus:border-accent leading-normal resize-y shadow-inner scrollbar-thin"
              spellCheck={false}
            />

            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] text-muted-foreground">Changes take effect immediately on Hermes CLI & Studio.</span>
              <Button
                onClick={handleSaveRawYaml}
                disabled={isSaving}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono cursor-pointer"
              >
                <Save size={13} />
                <span>Save & Apply YAML</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
