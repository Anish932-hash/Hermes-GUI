'use client';

import React, { useState } from 'react';
import { type SystemPerformanceOutput } from '@/ai/flows/system-performance-analysis';
import {
  AlertCircle,
  ShieldCheck,
  Zap,
  Flame,
  Shield,
  Cpu,
  Radio,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import JarvisPanel from './JarvisPanel';
import { cn } from '@/lib/utils';
import { soundFx } from '@/lib/audio-synth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SystemAnalysisPanelProps {
  analysis: SystemPerformanceOutput | null;
  isAnalyzing: boolean;
  onRunProtocol?: (title: string, protocol: string, query?: string) => void;
  onBoost?: () => void;
  onOpenConfig?: () => void;
}

export const SystemAnalysisPanel: React.FC<SystemAnalysisPanelProps> = ({
  analysis,
  isAnalyzing,
  onRunProtocol,
  onBoost,
  onOpenConfig,
}) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const Icon = analysis?.hasCriticalIssues ? AlertCircle : ShieldCheck;
  const iconColor = analysis?.hasCriticalIssues ? 'text-destructive' : 'text-emerald-400';
  const title = analysis?.hasCriticalIssues ? 'CRITICAL ALERTS' : 'SYSTEM NOMINAL';
  const healthScore = analysis?.healthScore ?? 98;

  const handleAction = (titleText: string, protocol: string, query?: string) => {
    soundFx.playClick(1000);
    setIsOptionsOpen(false);
    if (onRunProtocol) {
      onRunProtocol(titleText, protocol, query);
    }
  };

  const handleBoostClick = () => {
    soundFx.playBoost();
    setIsOptionsOpen(false);
    if (onRunProtocol) {
      onRunProtocol('Reactor Overclock & Memory Purge', 'PROTOCOL: HYPER_BOOST');
    } else if (onBoost) {
      onBoost();
    }
  };

  return (
    <>
      {/* Sleek, Non-Obtrusive Footer Card (Does NOT cover process list or main workspace) */}
      <JarvisPanel
        title="HERMES AI STATUS"
        badge="AI AUDIT"
        className="w-80 sm:w-[410px] max-w-full p-2.5 pt-3 transition-all duration-300"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left: Live Status Badge & Summary (Clickable to open options) */}
          <div
            onClick={() => {
              soundFx.playClick(900);
              setIsOptionsOpen(true);
            }}
            className="flex items-center gap-2 min-w-0 cursor-pointer group"
            title="Click to view full AI audit and options"
          >
            <div className="relative shrink-0">
              <Icon size={17} className={cn(iconColor, 'drop-shadow-[0_0_8px_currentColor]')} />
              <span className="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping opacity-30 pointer-events-none" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn('font-mono font-bold text-[10px] tracking-wider uppercase group-hover:underline', iconColor)}>
                  {title}
                </span>
                <span className="text-[9px] font-mono text-accent font-bold px-1 rounded bg-primary/10 border border-primary/20">
                  {healthScore}%
                </span>
              </div>
              <p
                className="text-[10px] text-muted-foreground font-mono truncate max-w-[170px] sm:max-w-[240px]"
                title={analysis?.overallSummary || 'WSL sub-systems optimal.'}
              >
                {analysis?.overallSummary || 'WSL sub-systems optimal.'}
              </p>
            </div>
          </div>

          {/* Right: Quick Surge + Dedicated Button to Extend Options */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleBoostClick}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-destructive/40 bg-destructive/15 text-destructive text-[10px] font-mono font-bold hover:bg-destructive/25 hover:border-destructive hover:shadow-[0_0_12px_hsl(var(--destructive)/0.35)] transition-all cursor-pointer"
              title="Instant Reactor Overclock Surge"
            >
              <Flame size={11} className="text-destructive animate-pulse" />
              <span>SURGE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick(1000);
                setIsOptionsOpen(true);
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-accent/50 bg-accent/15 text-accent text-[10px] font-mono font-bold hover:bg-accent/25 hover:border-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.35)] transition-all cursor-pointer"
              title="Click to extend options & autonomous protocols"
            >
              <Zap size={11} className="text-accent animate-pulse" />
              <span>OPTIONS (5)</span>
            </button>
          </div>
        </div>
      </JarvisPanel>

      {/* Extended Options & Full Diagnostics Modal (Opens cleanly without covering process list) */}
      <Dialog open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
        <DialogContent className="max-w-xl max-h-[88vh] sm:max-h-[90vh] flex flex-col border border-primary/40 bg-background/95 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_0_50px_hsl(var(--primary)/0.25)] font-headline text-foreground overflow-hidden">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="rounded-lg border border-accent/60 bg-accent/20 p-2 text-accent shadow-[0_0_12px_hsl(var(--accent)/0.3)] shrink-0">
                  <Zap size={18} />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xs sm:text-sm font-black tracking-widest text-primary [text-shadow:0_0_10px_hsl(var(--primary))] font-mono truncate">
                    HERMES AI STATUS // EXTENDED OPTIONS & PROTOCOLS
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground font-mono truncate">
                    Autonomous Diagnostic Matrix, Critical Telemetry & System Controls
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold shrink-0 ml-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>INTEGRITY: {healthScore}%</span>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[72vh] sm:max-h-[76vh] pr-2 my-1 w-full">
            <div className="space-y-3 pb-8 pr-1">
              {/* Status Overview Card */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 font-mono space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={iconColor} />
                    <span className={cn('font-bold text-xs uppercase', iconColor)}>{title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase">ENVIRONMENT: KALI LINUX (WSL2)</span>
                </div>
                <p className="text-xs text-foreground/90 font-sans leading-relaxed">
                  {analysis?.overallSummary || analysis?.statusSummary || 'Hermes Agent Core and WSL sub-systems operating at peak performance.'}
                </p>
              </div>

              {/* Actionable Recommendations with Direct Execution Buttons */}
              {analysis?.recommendations && analysis.recommendations.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-background/60 p-3 space-y-2">
                  <div className="text-[10px] font-mono text-accent font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={12} className="text-accent" />
                    <span>ACTIONABLE RECOMMENDATIONS:</span>
                  </div>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-primary/15 bg-background/40 hover:bg-background/80 transition-colors">
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                          <span className="text-accent font-bold mt-0.5 select-none text-xs">▸</span>
                          <span className="leading-snug break-words font-sans text-xs text-foreground/90">{rec}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAction(`Execute: ${rec.slice(0, 32)}...`, 'PROTOCOL: RECOMMENDATION_EXECUTE', rec)}
                          className="px-2 py-1 rounded text-[9px] font-mono font-bold border border-accent/50 bg-accent/15 text-accent hover:bg-accent hover:text-black transition-all shrink-0 cursor-pointer shadow-sm"
                          title="Run autonomous execution for this recommendation"
                        >
                          ⚡ EXECUTE
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical Issues with Direct Hotfix Buttons (if any) */}
              {analysis?.hasCriticalIssues && analysis?.issues && analysis.issues.length > 0 && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-2 font-mono">
                  <div className="text-[10px] text-destructive font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-destructive" />
                    <span>CRITICAL ALERTS DETECTED:</span>
                  </div>
                  {analysis.issues.map((issue, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-destructive/30 bg-destructive/15 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-destructive">[{issue.category.toUpperCase()}]:</span>{' '}
                        <span className="text-destructive/90 break-words font-sans">{issue.recommendation}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAction(`Resolve Alert: [${issue.category.toUpperCase()}]`, 'PROTOCOL: CRITICAL_HOTFIX', issue.recommendation)}
                        className="px-2 py-1 rounded text-[9px] font-mono font-bold border border-destructive/60 bg-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all shrink-0 cursor-pointer shadow-sm"
                      >
                        HOTFIX
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Extended Interactive Options (The 5 Autonomous Protocols) */}
              <div className="space-y-2 pt-1 pb-4">
                <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-primary" />
                  <span>SELECT PROTOCOL OPTION TO EXECUTE:</span>
                </div>

                {/* Option 1: Overclock Surge */}
                <button
                  type="button"
                  onClick={handleBoostClick}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 hover:border-destructive transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg border border-destructive/40 bg-destructive/20 text-destructive shrink-0">
                      <Flame size={16} className="group-hover:animate-bounce" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-destructive font-mono truncate">REACTOR OVERCLOCK SURGE</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug">
                        Purge RAM buffers, compact SQLite WAL journals & surge CPU clock
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-destructive font-bold px-2 py-1 rounded border border-destructive/40 bg-destructive/20 shrink-0 ml-2">
                    SURGE NOW
                  </span>
                </button>

                {/* Option 2: Verify 61 Skills */}
                <button
                  type="button"
                  onClick={() => handleAction('Verify 61 Arsenal Skills Matrix', 'PROTOCOL: SKILL_ARSENAL_VERIFY', 'List active cybersecurity and automation skills loaded.')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 shrink-0">
                      <Shield size={16} className="group-hover:animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-emerald-400 font-mono truncate">VERIFY 61 ARSENAL SKILLS MATRIX</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug">
                        Audit all 61 active cybersecurity, network, and automation tools
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/20 shrink-0 ml-2">
                    RUN AUDIT
                  </span>
                </button>

                {/* Option 3: Deep WSL Diagnostics */}
                <button
                  type="button"
                  onClick={() => handleAction('Deep WSL Subsystem Diagnostics', 'PROTOCOL: SYSTEM_DIAGNOSTICS', 'Check current memory, CPU usage, and top running WSL processes.')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-accent transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg border border-primary/30 bg-primary/20 text-primary shrink-0">
                      <Cpu size={16} className="group-hover:text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-foreground font-mono truncate">DEEP SUBSYSTEM DIAGNOSTICS</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug">
                        Inspect Linux virtual memory, active WSL processes, and load averages
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-primary font-bold px-2 py-1 rounded border border-primary/30 bg-primary/20 shrink-0 ml-2">
                    EXECUTE
                  </span>
                </button>

                {/* Option 4: Probe Gateway Telemetry */}
                <button
                  type="button"
                  onClick={() => handleAction('Hermes Gateway Telemetry Probe', 'PROTOCOL: HERMES_GATEWAY_PROBE', 'Inspect status of Hermes gateway PID 358 and messaging channels.')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/20 hover:border-accent transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg border border-accent/40 bg-accent/20 text-accent shrink-0">
                      <Radio size={16} className="group-hover:animate-spin-slow" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-accent font-mono truncate">PROBE GATEWAY TELEMETRY</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug">
                        Inspect Hermes gateway daemon PID 358, Telegram, and socket state
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-accent font-bold px-2 py-1 rounded border border-accent/40 bg-accent/20 shrink-0 ml-2">
                    PROBE
                  </span>
                </button>

                {/* Option 5: Hermes Configurations Matrix */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick(1000);
                    setIsOptionsOpen(false);
                    if (onOpenConfig) onOpenConfig();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/25 hover:border-accent transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg border border-primary/40 bg-primary/20 text-accent shrink-0">
                      <SlidersHorizontal size={16} className="group-hover:rotate-45 transition-transform" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-accent font-mono truncate">HERMES CONFIGURATIONS MATRIX</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug">
                        Manage ~/.hermes/config.yaml, model presets, SOUL.md, API keys & gateways
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-accent font-bold px-2 py-1 rounded border border-accent/40 bg-accent/20 shrink-0 ml-2">
                    CONFIGURE
                  </span>
                </button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SystemAnalysisPanel;
