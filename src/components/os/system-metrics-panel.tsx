'use client';

import React from 'react';
import {
  Battery,
  Cpu,
  Disc,
  MemoryStick,
  Network,
  Zap,
  HardDrive,
  Thermometer,
  Activity,
  Flame,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import type { FullSystemMetrics } from '@/hooks/use-system-metrics';
import JarvisPanel from './JarvisPanel';
import MetricGauge from './metric-gauge';
import { cn } from '@/lib/utils';

const PowerIndicator = ({ level, charging }: { level: number; charging: boolean }) => (
  <div className="space-y-1.5 text-xs">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-1.5 text-primary/80">
        <Battery size={13} className="text-accent" />
        <span className="font-mono text-[11px]">ARC REACTOR / POWER</span>
      </div>
      <div className="flex items-center gap-1 font-bold text-foreground font-mono text-[11px]">
        {charging && level >= 0 && <Zap size={11} className="text-emerald-400 fill-emerald-400 animate-pulse" />}
        <span>{level >= 0 ? `${level.toFixed(0)}%` : 'N/A'}</span>
      </div>
    </div>
    <div className="w-full bg-primary/10 h-1.5 rounded-full overflow-hidden p-0.5 border border-primary/20">
      <div
        className="h-full rounded-full transition-all duration-300 shadow-[0_0_8px_currentColor]"
        style={{
          width: `${level >= 0 ? Math.min(100, Math.max(5, level)) : 0}%`,
          backgroundColor: level >= 0 && level < 20 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
        }}
      />
    </div>
    <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
      <span className="text-primary/70">{level >= 0 ? 'BATTERY TELEMETRY' : 'BATTERY UNAVAILABLE'}</span>
      <span className="text-emerald-400 font-bold tracking-wider">
        {level < 0 ? 'NO SENSOR' : charging ? 'CHARGING' : 'DISCHARGING'}
      </span>
    </div>
  </div>
);

const StorageIndicator = ({ diskUsage, total, used }: { diskUsage: number; total: number; used: number }) => (
  <div className="space-y-1 text-xs">
    <div className="flex justify-between items-center font-mono">
      <div className="flex items-center gap-1.5 text-primary/80">
        <HardDrive size={13} className="text-accent" />
        <span className="text-[11px]">WSL EXT4 ROOT:</span>
      </div>
      <span className="font-bold text-foreground text-[11px]">
        {total > 0 ? <>{used.toFixed(0)} / {total.toFixed(0)} GB <span className="text-accent">({diskUsage.toFixed(0)}%)</span></> : 'N/A'}
      </span>
    </div>
    <div className="w-full bg-primary/10 h-1.5 rounded-full overflow-hidden border border-primary/20">
      <div
        className="bg-primary h-full rounded-full transition-all duration-500 shadow-[0_0_8px_hsl(var(--primary))]"
        style={{ width: `${total > 0 ? Math.min(100, Math.max(3, diskUsage)) : 0}%` }}
      />
    </div>
  </div>
);

const SystemMetricsDisplay = ({ metrics }: { metrics: FullSystemMetrics }) => {
  const ramDisplay = metrics.ramUsedMB && metrics.ramTotalMB
    ? `${(metrics.ramUsedMB / 1024).toFixed(1)} / ${(metrics.ramTotalMB / 1024).toFixed(1)} GB`
    : metrics.ramUsage >= 0 ? `${metrics.ramUsage.toFixed(0)}%` : 'N/A';

  const temperature = metrics.cpuTemperatureC;
  const isTempHot = temperature !== undefined && temperature >= 80;

  return (
    <JarvisPanel title="WSL TELEMETRY & HARDWARE" badge="LIVE 200MS" className="w-80">
      <div className="space-y-3">
        {/* Core Hardware Metrics */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[10px] text-primary/80 tracking-widest font-mono font-bold">
              CORE LOADS // DUAL CHANNEL
            </h4>
            <span className="text-[9px] text-accent font-mono bg-accent/10 px-1.5 py-0.2 rounded border border-accent/25">
              /proc/stat
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-background/40 p-1.5 rounded-xl border border-primary/15">
            <MetricGauge name="CPU" value={metrics.cpuUsage} color="hsl(var(--chart-1))" icon={<Cpu size={20} />} compact />
            <MetricGauge name="GPU" value={metrics.gpuUsage} color="hsl(var(--chart-2))" icon={<Disc size={20} />} compact />
            <MetricGauge name="RAM" value={metrics.ramUsage} color="hsl(var(--chart-3))" icon={<MemoryStick size={20} />} compact />
          </div>

          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono mt-1.5 px-0.5">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>CPU: <strong className="text-foreground">{metrics.cpuUsage >= 0 ? `${metrics.cpuUsage.toFixed(0)}%` : 'N/A'}</strong></span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>RAM: <strong className="text-foreground">{ramDisplay}</strong></span>
            </span>
          </div>
        </div>

        {/* Real Thermal & Frequency Telemetry Bar */}
        <div className="flex items-center justify-between p-1.5 rounded-lg border border-primary/15 bg-background/50 font-mono text-[10px]">
          <div className="flex items-center gap-1.5">
            <Thermometer
              size={13}
              className={cn('transition-colors', isTempHot ? 'text-destructive animate-pulse' : 'text-emerald-400')}
            />
            <span className="text-primary/80">THERMAL:</span>
            <span className={cn('font-bold', isTempHot ? 'text-destructive' : 'text-emerald-400')}>
              {temperature !== undefined && temperature >= 0 ? `${temperature.toFixed(1)}°C` : 'N/A'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity size={12} className="text-accent" />
            <span>FREQ: <strong className="text-foreground">{metrics.cpuFrequencyGHz !== undefined && metrics.cpuFrequencyGHz > 0 ? `${metrics.cpuFrequencyGHz.toFixed(2)} GHz` : 'N/A'}</strong></span>
          </div>
        </div>

        <div className="h-px w-full bg-primary/15" />

        {/* Sub-Systems Telemetry */}
        <div className="space-y-2.5">
          {/* Network Flow with Tx/Rx Blinking Indicators */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-primary/80">
                <Network size={13} className="text-primary flex-shrink-0" />
                <span className="text-[11px]">WSL ETH0 FLOW:</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                  <ArrowDown size={11} />
                  <span>{metrics.networkInMbps.toFixed(1)}M</span>
                </span>
                <span className="flex items-center gap-0.5 text-accent font-bold">
                  <ArrowUp size={11} />
                  <span>{metrics.networkOutMbps.toFixed(1)}M</span>
                </span>
              </div>
            </div>
          </div>

          {/* Disk storage */}
          <StorageIndicator
            diskUsage={metrics.diskUsage}
            total={metrics.diskTotalGB ?? 0}
            used={metrics.diskUsedGB ?? 0}
          />
        </div>

        <div className="h-px w-full bg-primary/15" />

        {/* Reactor Power Core */}
        <PowerIndicator level={metrics.batteryLevel} charging={metrics.batteryCharging} />
      </div>
    </JarvisPanel>
  );
};

export default SystemMetricsDisplay;
