'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';
import {
  Waves,
  X,
  Mic,
  Radio,
  ExternalLink,
  RefreshCw,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Copy,
  Keyboard,
  User,
  Activity,
  Send,
} from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import { Button } from '@/components/ui/button';
import { useWisprFlow } from '@/hooks/use-wispr-flow';
import type { WisprDictation } from '@/lib/wispr-flow';

interface WisprFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt?: (text: string, autoSubmit?: boolean) => void;
}

export const WisprFlowModal: React.FC<WisprFlowModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    isInstalled,
    isRunning,
    version,
    user,
    keybinds,
    recentDictations,
    lastDictation,
    totalDictationsCount,
    isSyncing,
    executionMode,
    setExecutionMode,
    activationMode,
    setActivationMode,
    pendingDictation,
    approveDictation,
    discardDictation,
    launchApp,
    triggerPtt,
    refresh,
  } = useWisprFlow({
    pollingIntervalMs: isOpen ? 1500 : 4000,
  });
  const pttShortcut = keybinds.find((keybind) => keybind.action.toLowerCase() === 'ptt')?.keys || 'Not configured';

  if (!isOpen) return null;

  const handleCopy = (dictation: WisprDictation) => {
    soundFx.playClick(1000);
    navigator.clipboard.writeText(dictation.formattedText || dictation.pastedText);
    setCopiedId(dictation.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUsePrompt = (text: string, executeNow: boolean) => {
    soundFx.playClick(1200);
    if (onSelectPrompt) {
      onSelectPrompt(text, executeNow);
    }
    onClose();
  };

  const handleApprovePending = () => {
    if (!pendingDictation) return;
    const text = pendingDictation.formattedText || pendingDictation.pastedText;
    soundFx.playChirp();
    if (onSelectPrompt) {
      onSelectPrompt(text, true);
    }
    approveDictation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-background/95 border border-accent/40 rounded-3xl shadow-[0_0_60px_hsl(var(--accent)/0.25)] overflow-hidden">
        {/* Cybernetic Scanlines */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/20 z-10 shrink-0 bg-background/90">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-accent/20 border border-accent/50 flex items-center justify-center text-accent shadow-[0_0_15px_hsl(var(--accent)/0.4)]">
              <Waves size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={cn('text-sm sm:text-base font-bold tracking-wider text-accent', orbitron.className)}>
                  WISPR FLOW // WINDOWS ENGINE
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-accent/15 border border-accent/40 text-accent">
                  v{version}
                </span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Deep Neural Dictation Bridge &bull; Windows Host Integration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                refresh();
              }}
              className={cn(
                'p-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/20 transition-all cursor-pointer',
                isSyncing && 'animate-spin text-accent'
              )}
              title="Refresh Dictation Stream"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/20 hover:text-accent transition-all cursor-pointer"
              title="Close Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin z-10">
          {/* Pending Operator Approval Banner */}
          {pendingDictation && (
            <div className="p-4 rounded-2xl border-2 border-accent bg-accent/15 backdrop-blur-md shadow-[0_0_30px_hsl(var(--accent)/0.3)] animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-accent flex items-center gap-1.5 uppercase">
                  <Waves size={14} className="animate-pulse" />
                  DICTATION AWAITING OPERATOR APPROVAL
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {new Date(pendingDictation.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm font-sans font-bold text-foreground mb-3 leading-relaxed">
                &ldquo;{pendingDictation.formattedText || pendingDictation.pastedText}&rdquo;
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={discardDictation}
                  className="h-7 text-xs font-mono text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  <X size={12} className="mr-1" />
                  Discard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleUsePrompt(pendingDictation.formattedText || pendingDictation.pastedText, false);
                    discardDictation();
                  }}
                  className="h-7 text-xs font-mono border-primary/40 text-primary hover:bg-primary/20 cursor-pointer"
                >
                  Edit in Prompt
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprovePending}
                  className="h-7 text-xs font-mono bg-accent hover:bg-accent/80 text-background font-bold shadow-[0_0_15px_hsl(var(--accent)/0.5)] cursor-pointer"
                >
                  <CheckCircle2 size={13} className="mr-1" />
                  Approve & Run ⚡
                </Button>
              </div>
            </div>
          )}

          {/* Status & Policy Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Engine Telemetry Card */}
            <div className="p-3.5 rounded-2xl border border-primary/25 bg-primary/5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 uppercase">
                  <Activity size={12} className="text-emerald-400" />
                  Engine State
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border flex items-center gap-1',
                    isRunning
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_hsl(var(--emerald-500)/0.2)]'
                      : 'border-destructive/50 bg-destructive/10 text-destructive'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isRunning ? 'bg-emerald-400 animate-ping' : 'bg-destructive')} />
                  {isRunning ? 'HOST ACTIVE' : 'OFFLINE'}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Dictation Hotkey:</span>
                  <span className="text-foreground font-bold text-accent">{pttShortcut} [PTT]</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Transcriptions:</span>
                  <span className="text-foreground font-bold">{totalDictationsCount} captures</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-primary/15">
                <Button
                  size="sm"
                  onClick={triggerPtt}
                  disabled={!isRunning || pttShortcut === 'Not configured'}
                  className="flex-1 h-7 text-[10px] font-mono bg-accent/20 hover:bg-accent/30 text-accent border border-accent/50 cursor-pointer"
                >
                  <Mic size={12} className="mr-1" />
                  Trigger PTT [{pttShortcut}]
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={launchApp}
                  className="h-7 text-[10px] font-mono border-primary/30 text-primary hover:bg-primary/20 cursor-pointer"
                >
                  <ExternalLink size={12} className="mr-1" />
                  Focus App
                </Button>
              </div>
            </div>

            {/* Authenticated User Card */}
            <div className="p-3.5 rounded-2xl border border-primary/25 bg-primary/5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 uppercase">
                  <User size={12} className="text-accent" />
                  Wispr Flow Profile
                </span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold">CONNECTED</span>
              </div>

              <div className="flex items-center gap-3 my-1">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-10 w-10 rounded-full border border-accent/40 shadow-[0_0_10px_hsl(var(--accent)/0.3)]"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold">
                    {user?.name?.[0] || 'W'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{user?.name || 'Anish Mondal'}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">{user?.email || 'milti.mondal@gmail.com'}</div>
                </div>
              </div>

              <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-primary/10">
                <span>Active Profile Database Linked</span>
              </div>
            </div>
          </div>

          {/* Workflow & Activation Policy Control Strip */}
          <div className="p-4 rounded-2xl border border-accent/35 bg-accent/5 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-bold tracking-wider text-accent flex items-center gap-2', orbitron.className)}>
                <Zap size={14} className="text-accent" />
                VOICE & DICTATION POLICY ENGINE
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary">
                CONFIG PERSISTED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              {/* Policy 1: Execution Mode (Manual Approval vs Auto-Execute) */}
              <div className="p-3 rounded-xl border border-primary/20 bg-background/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-primary font-bold text-[11px]">DISPATCH WORKFLOW</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{executionMode.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                    {executionMode === 'manual_approve'
                      ? 'Review each dictation before sending. Operator retains 100% control.'
                      : 'Zero-clicks. As soon as you stop speaking, prompt is sent to Hermes.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-background/80 border border-primary/20">
                  <button
                    type="button"
                    onClick={() => setExecutionMode('manual_approve')}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center',
                      executionMode === 'manual_approve'
                        ? 'bg-accent/25 text-accent border border-accent/60 shadow-[0_0_10px_hsl(var(--accent)/0.3)]'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    MANUAL APPROVAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionMode('auto_execute')}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center',
                      executionMode === 'auto_execute'
                        ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/60 shadow-[0_0_10px_hsl(var(--emerald-500)/0.3)]'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    AUTO-EXECUTE ⚡
                  </button>
                </div>
              </div>

              {/* Policy 2: Activation Method (Caps Lock PTT vs Keyless Hands-Free) */}
              <div className="p-3 rounded-xl border border-primary/20 bg-background/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-primary font-bold text-[11px]">ACTIVATION METHOD</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{activationMode.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                    {activationMode === 'hands_free'
                      ? 'Keyless ambient listening. Speak naturally with ZERO keyboard keys needed.'
                      : 'Hold or toggle Caps Lock on Windows host to activate dictation.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-background/80 border border-primary/20">
                  <button
                    type="button"
                    onClick={() => setActivationMode('key_ptt')}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center',
                      activationMode === 'key_ptt'
                        ? 'bg-primary/25 text-primary border border-primary/60 shadow-[0_0_10px_hsl(var(--primary)/0.3)]'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    CAPS LOCK [PTT]
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivationMode('hands_free')}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center',
                      activationMode === 'hands_free'
                        ? 'bg-accent/25 text-accent border border-accent/60 shadow-[0_0_10px_hsl(var(--accent)/0.3)]'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    KEYLESS HANDS-FREE 🎙️
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Keybindings Strip */}
          <div className="p-3 rounded-2xl border border-primary/20 bg-background/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-primary font-bold flex items-center gap-1.5">
                <Keyboard size={12} />
                ACTIVE WINDOWS SHORTCUTS
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">GLOBAL SYSTEM WIDE</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
              {keybinds.slice(0, 4).map((kb, i) => (
                <div key={i} className="p-1.5 rounded-lg border border-primary/15 bg-primary/5 flex flex-col justify-between">
                  <span className="text-muted-foreground capitalize text-[9px]">{kb.action.replace('_', ' ')}</span>
                  <span className="text-foreground font-bold mt-0.5 text-accent">{kb.keys}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Dictation Stream */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-accent animate-pulse" />
                <span className={cn('text-xs font-bold tracking-wider text-primary', orbitron.className)}>
                  RECENT DICTATIONS FEED
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground">REAL-TIME SQLITE INGESTION</span>
            </div>

            {recentDictations.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-primary/30 text-muted-foreground font-mono text-xs">
                No Wispr Flow dictations recorded yet. Press <span className="text-accent font-bold">Caps Lock</span> to dictate on Windows!
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentDictations.map((dictation) => {
                  const isLatest = lastDictation?.id === dictation.id;
                  const text = dictation.formattedText || dictation.pastedText;

                  return (
                    <div
                      key={dictation.id}
                      className={cn(
                        'p-3 sm:p-3.5 rounded-2xl border transition-all',
                        isLatest
                          ? 'border-accent/60 bg-accent/5 shadow-[0_0_20px_hsl(var(--accent)/0.15)]'
                          : 'border-primary/20 bg-background/70 hover:border-primary/40'
                      )}
                    >
                      {/* Top metadata row */}
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
                            {dictation.app}
                          </span>
                          {isLatest && (
                            <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-bold animate-pulse">
                              LATEST
                            </span>
                          )}
                          {dictation.detectedLanguage && (
                            <span className="text-muted-foreground uppercase">{dictation.detectedLanguage}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-muted-foreground">
                          {dictation.duration && (
                            <span>{dictation.duration.toFixed(1)}s</span>
                          )}
                          {dictation.e2eLatency && (
                            <span className="text-accent/80 font-bold">{dictation.e2eLatency}ms</span>
                          )}
                          <span>{new Date(dictation.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Transcribed Text */}
                      <p className="text-xs sm:text-sm text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap my-1 font-medium">
                        &ldquo;{text}&rdquo;
                      </p>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-primary/10">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(dictation)}
                          className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === dictation.id ? (
                            <>
                              <CheckCircle2 size={11} className="mr-1 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} className="mr-1" />
                              Copy
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUsePrompt(text, false)}
                          className="h-6 px-2.5 text-[10px] font-mono border-primary/30 text-primary hover:bg-primary/20 cursor-pointer"
                        >
                          Insert Prompt
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleUsePrompt(text, true)}
                          className="h-6 px-2.5 text-[10px] font-mono bg-accent/25 hover:bg-accent/35 text-accent border border-accent/50 cursor-pointer"
                        >
                          <Send size={10} className="mr-1" />
                          Send to Hermes
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WisprFlowModal;
