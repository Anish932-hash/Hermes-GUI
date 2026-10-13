'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  ShieldAlert,
  Zap,
  RefreshCw,
  Cpu,
  Radio,
  Globe,
  Database,
  Mic,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Play,
  Activity,
  Layers,
  Wrench,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Orbitron } from 'next/font/google';
import { useAutonomousHealer, DiagnosticSubsystem } from '@/hooks/use-autonomous-healer';
import { soundFx } from '@/lib/audio-synth';

const orbitron = Orbitron({ subsets: ['latin'] });

interface AutoSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AutoSetupModal({ isOpen, onClose }: AutoSetupModalProps) {
  const {
    diagnostics,
    isScanning,
    isFixing,
    lastScanTime,
    actionsLog,
    autoHealEnabled,
    setAutoHealEnabled,
    runScan,
    runAutoSetup,
  } = useAutonomousHealer();

  const [hasRunHeal, setHasRunHeal] = useState(false);

  const handleRunFullSetup = async () => {
    soundFx.playClick(1000);
    const result = await runAutoSetup();
    setHasRunHeal(true);
    soundFx.playTaskSuccess();
    soundFx.speakText(
      'Autonomous system provisioning completed. All seven subsystems operating within nominal parameters.'
    );
  };

  const handleManualScan = () => {
    soundFx.playClick(900);
    runScan();
  };

  const overallHealth = diagnostics?.overallHealth ?? 95;

  const getSubsystemIcon = (category: string) => {
    switch (category) {
      case 'HARDWARE':
        return <Cpu size={16} className="text-accent" />;
      case 'CORE':
        return <Activity size={16} className="text-accent" />;
      case 'GEOSPATIAL':
        return <Globe size={16} className="text-emerald-400" />;
      case 'DATABASE':
        return <Database size={16} className="text-primary" />;
      case 'VOICE':
        return <Mic size={16} className="text-accent" />;
      case 'RUNTIME':
        return <Terminal size={16} className="text-cyan-400" />;
      case 'SECURITY':
        return <Layers size={16} className="text-emerald-400" />;
      default:
        return <ShieldCheck size={16} className="text-accent" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col justify-between overflow-hidden border border-primary/40 bg-background/95 backdrop-blur-2xl p-4 sm:p-6 shadow-[0_0_50px_hsl(var(--primary)/0.35)] rounded-2xl text-foreground font-headline">
        {/* MODAL HEADER */}
        <DialogHeader className="shrink-0 border-b border-primary/20 pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/60 bg-accent/15 text-accent shadow-[0_0_15px_hsl(var(--accent)/0.3)]">
                <Wrench size={20} className="text-accent animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className={cn('text-sm sm:text-base font-black tracking-wider text-foreground uppercase', orbitron.className)}>
                    AUTONOMOUS SYSTEM DIAGNOSTICS &amp; SELF-HEALING
                  </DialogTitle>
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-400">
                    ZERO-TOUCH
                  </span>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Stark Mark-XV Self-Provisioning Subsystem Engine &amp; Hardware Discovery
                </p>
              </div>
            </div>

            {/* Health Score Readout */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="text-right font-mono">
                <span className="block text-[8px] uppercase tracking-wider text-muted-foreground">SYSTEM HEALTH</span>
                <span className={cn('text-sm font-black', overallHealth >= 90 ? 'text-emerald-400' : 'text-accent')}>
                  {overallHealth}% NOMINAL
                </span>
              </div>
              <div className="h-9 w-9 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center">
                {overallHealth >= 90 ? (
                  <ShieldCheck size={20} className="text-emerald-400" />
                ) : (
                  <ShieldAlert size={20} className="text-accent animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* CONTROLS STRIP */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 py-2 px-1 border-b border-primary/15 bg-black/30 rounded-lg mt-2 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunFullSetup}
              disabled={isFixing}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1 font-bold text-xs transition-all cursor-pointer shadow-md',
                isFixing
                  ? 'border-accent bg-accent/30 text-accent animate-pulse'
                  : 'border-accent/80 bg-accent/20 text-accent hover:bg-accent/35 hover:shadow-[0_0_15px_hsl(var(--accent)/0.5)]'
              )}
            >
              <Zap size={14} className={isFixing ? 'animate-spin' : 'animate-pulse'} />
              <span>{isFixing ? 'PROVISIONING & SELF-HEALING...' : '⚡ RUN FULL AUTO-SETUP & SELF-HEAL'}</span>
            </button>

            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary hover:text-accent hover:border-accent transition-all cursor-pointer"
            >
              <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? 'SCANNING...' : 'SCAN'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoHealEnabled}
                onChange={(e) => setAutoHealEnabled(e.target.checked)}
                className="rounded border-primary/40 text-accent focus:ring-0 cursor-pointer"
              />
              <span className="text-foreground/90 font-bold">BACKGROUND GUARDIAN</span>
              <span className="text-emerald-400 font-bold">({autoHealEnabled ? 'ACTIVE' : 'OFF'})</span>
            </label>

            {lastScanTime && (
              <span className="hidden sm:inline text-muted-foreground/80">
                PROBED: {lastScanTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* MAIN BODY: 7 SUBSYSTEMS MATRIX */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 hermes-scrollbar pr-1 my-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {diagnostics?.subsystems?.map((sub) => {
              const isOnline = sub.status === 'ONLINE';
              const isStandby = sub.status === 'STANDBY';

              return (
                <div
                  key={sub.id}
                  className={cn(
                    'flex flex-col justify-between rounded-xl border p-3 backdrop-blur-md transition-all',
                    isOnline
                      ? 'border-primary/25 bg-primary/5 hover:border-primary/45'
                      : isStandby
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-destructive/50 bg-destructive/10'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg border border-primary/20 bg-background/50">
                        {getSubsystemIcon(sub.category)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground font-mono flex items-center gap-1.5">
                          {sub.name}
                        </h4>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">
                          {sub.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isOnline ? 'bg-emerald-400 animate-ping' : isStandby ? 'bg-accent' : 'bg-destructive'
                        )}
                      />
                      <span
                        className={cn(
                          isOnline ? 'text-emerald-400' : isStandby ? 'text-accent' : 'text-destructive'
                        )}
                      >
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] font-mono text-foreground/85 leading-relaxed bg-black/40 p-2 rounded-lg border border-primary/10">
                    {sub.details}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1 border-t border-primary/10">
                    <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-primary/10 overflow-hidden mr-2">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          sub.healthPercent >= 90 ? 'bg-emerald-400' : 'bg-accent'
                        )}
                        style={{ width: `${sub.healthPercent}%` }}
                      />
                    </div>
                    <span>{sub.healthPercent}% INTEGRITY</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ACTION EXECUTION STREAM TERMINAL */}
          <div className="rounded-xl border border-primary/30 bg-black/85 p-3 shadow-inner font-mono text-[11px] space-y-1 mt-3">
            <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 mb-1.5 text-[10px] text-primary">
              <div className="flex items-center gap-1.5 font-bold">
                <Terminal size={12} className="text-accent" />
                <span>AUTONOMOUS PROVISIONING &amp; SELF-HEAL LOG // STDOUT</span>
              </div>
              <span className="text-emerald-400 text-[9px]">
                {actionsLog.length > 0 ? `${actionsLog.length} ACTIONS EXECUTED` : 'READY TO PROVISION'}
              </span>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 hermes-scrollbar pr-1 text-[10px] text-foreground/90">
              {actionsLog.length === 0 ? (
                <div className="text-muted-foreground/70 italic py-1">
                  Click &apos;⚡ RUN FULL AUTO-SETUP &amp; SELF-HEAL&apos; to trigger automatic zero-touch provisioning of God&apos;s Eye Cesium, Hermes Gateway, environment keys, and state databases.
                </div>
              ) : (
                actionsLog.map((act, i) => (
                  <div key={i} className="flex items-start gap-2 leading-tight">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-accent font-bold">[{act.step}]</span>{' '}
                      <span className="text-foreground/90">{act.message}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="shrink-0 border-t border-primary/20 pt-3 flex items-center justify-between font-mono text-[10px] text-muted-foreground mt-2">
          <span>HOST: KALI_WSL2 // ARCH: X86_64 // STARK PROTOCOL v0.21.6</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-1 text-primary hover:text-accent hover:border-accent font-bold transition-all cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
