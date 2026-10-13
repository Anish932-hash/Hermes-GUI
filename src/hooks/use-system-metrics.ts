'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { type SystemPerformanceInput, type SystemPerformanceOutput } from '@/ai/flows/system-performance-analysis';
import { soundFx } from '@/lib/audio-synth';

export interface SystemSpecs {
  cpu: string;
  gpu: string;
  ram: string;
  os: string;
}

export type BoostStatus = 'idle' | 'boosting' | 'cooling';

export type FullSystemMetrics = SystemPerformanceInput & {
  specs: SystemSpecs;
  openedApps: string[];
  boostStatus: BoostStatus;
  isRealTelemetry: boolean;
  gpuAvailable?: boolean;
  batteryAvailable?: boolean;
  cpuTemperatureC?: number;
  cpuFrequencyGHz?: number;
  uptime?: string;
  loadAverage?: string;
  ramUsedMB?: number;
  ramTotalMB?: number;
  diskTotalGB?: number;
  diskUsedGB?: number;
  topProcesses?: Array<{ pid: string; name: string; cpu: string; mem: string; app?: string; status?: string }>;
};

const useSystemMetrics = () => {
  const [metrics, setMetrics] = useState<FullSystemMetrics>({
    cpuUsage: -1,
    gpuUsage: -1,
    ramUsage: -1,
    diskUsage: 0,
    networkInMbps: 0,
    networkOutMbps: 0,
    batteryLevel: -1,
    batteryCharging: false,
    specs: {
      cpu: 'Detecting CPU',
      gpu: 'GPU telemetry unavailable',
      ram: 'Detecting memory',
      os: 'Detecting Linux environment',
    },
    openedApps: [],
    boostStatus: 'idle',
    isRealTelemetry: false,
    uptime: '—',
    loadAverage: '—',
    topProcesses: [],
  });

  const [analysis] = useState<SystemPerformanceOutput | null>(null);
  const [isAnalyzing] = useState(false);

  const boostTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef(metrics);

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const boostPerformance = useCallback(() => {
    if (metrics.boostStatus !== 'idle') return;

    soundFx.playBoost();
    setMetrics((prev) => ({ ...prev, boostStatus: 'boosting' }));

    // Trigger real system boost (sync, SQLite WAL checkpoint, memory compaction)
    fetch('/api/system/boost', { method: 'POST' }).catch((err) => {
      console.warn('Real system boost call failed:', err);
    });

    if (boostTimeoutRef.current) clearTimeout(boostTimeoutRef.current);
    boostTimeoutRef.current = setTimeout(() => {
      setMetrics((prev) => ({ ...prev, boostStatus: 'cooling' }));
      boostTimeoutRef.current = setTimeout(() => {
        setMetrics((prev) => ({
          ...prev,
          boostStatus: 'idle',
        }));
      }, 2500);
    }, 1800);
  }, [metrics.boostStatus]);

  // Fetch real system metrics from Next.js API
  useEffect(() => {
    let isMounted = true;

    const fetchRealMetrics = async () => {
      if (metricsRef.current.boostStatus !== 'idle') return;

      try {
        const res = await fetch('/api/system/metrics');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json() as {
          cpuUsage?: number;
          gpuUsage?: number;
          gpuAvailable?: boolean;
          ramUsage?: number;
          diskUsage?: number;
          ramUsedMB?: number;
          ramTotalMB?: number;
          diskTotalGB?: number;
          diskUsedGB?: number;
          batteryAvailable?: boolean;
          cpuTemperatureC?: number;
          cpuFrequencyGHz?: number;
          uptimeFormatted?: string;
          loadAverage?: string;
          cpuModel?: string;
          gpuModel?: string;
          distro?: string;
          topProcesses?: Array<{ pid: string; name: string; cpu: string; mem: string }>;
          networkInMbps?: number;
          networkOutMbps?: number;
        };

        if (isMounted) {
          setMetrics((prev) => ({
            ...prev,
            cpuUsage: data.cpuUsage ?? prev.cpuUsage,
            gpuUsage: data.gpuUsage ?? prev.gpuUsage,
            gpuAvailable: data.gpuAvailable ?? prev.gpuAvailable,
            ramUsage: data.ramUsage ?? prev.ramUsage,
            diskUsage: data.diskUsage ?? prev.diskUsage,
            ramUsedMB: data.ramUsedMB,
            ramTotalMB: data.ramTotalMB,
            diskTotalGB: data.diskTotalGB,
            diskUsedGB: data.diskUsedGB,
            batteryAvailable: data.batteryAvailable ?? prev.batteryAvailable,
            cpuTemperatureC: data.cpuTemperatureC,
            cpuFrequencyGHz: data.cpuFrequencyGHz,
            uptime: data.uptimeFormatted,
            loadAverage: data.loadAverage,
            specs: {
              cpu: (data.cpuModel || prev.specs.cpu).replace(/with Radeon Graphics/i, '').trim(),
              gpu: (data.gpuModel || prev.specs.gpu).replace(/\(\/dev\/dxg\)/i, '').trim(),
              ram: `${Math.round((data.ramTotalMB || 3549) / 1024 * 10) / 10} GB WSL`,
              os: data.distro || 'Kali Linux (WSL2)',
            },
            topProcesses: data.topProcesses || prev.topProcesses,
            openedApps: (data.topProcesses || []).map((p) => `${p.name} (PID ${p.pid})`),
            isRealTelemetry: true,
          }));
        }
      } catch {
        // Keep the last observed values. Synthetic oscillations look live but
        // are not system telemetry.
      }
    };

    fetchRealMetrics();
    const intervalId = setInterval(fetchRealMetrics, 2500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (boostTimeoutRef.current) clearTimeout(boostTimeoutRef.current);
    };
  }, []);

  return { metrics, analysis, isAnalyzing, boostPerformance };
};

export default useSystemMetrics;
