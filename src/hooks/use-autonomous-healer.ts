'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface DiagnosticSubsystem {
  id: string;
  name: string;
  category: 'CORE' | 'GEOSPATIAL' | 'DATABASE' | 'VOICE' | 'RUNTIME' | 'SECURITY' | 'HARDWARE';
  status: 'ONLINE' | 'STANDBY' | 'DEGRADED' | 'OFFLINE';
  healthPercent: number;
  details: string;
  metrics?: Record<string, any>;
  autoFixed?: boolean;
}

export interface AutoSetupAction {
  step: string;
  status: 'SUCCESS' | 'SKIPPED' | 'WARNING';
  message: string;
}

export interface AutonomousDiagnostics {
  subsystems: DiagnosticSubsystem[];
  overallHealth: number;
  timestamp: string;
  systemSpecs: Record<string, any>;
}

export function useAutonomousHealer() {
  const [diagnostics, setDiagnostics] = useState<AutonomousDiagnostics | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [actionsLog, setActionsLog] = useState<AutoSetupAction[]>([]);
  const [autoHealEnabled, setAutoHealEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Run live system probe
  const runScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/system/auto-setup', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
        setLastScanTime(new Date());

        // Auto-heal check: if any subsystem is degraded and auto-heal is enabled, auto-trigger healing!
        const needsFix = data.subsystems?.some(
          (s: DiagnosticSubsystem) => s.status === 'OFFLINE' || (s.id === 'gods-eye-cesium' && s.status === 'STANDBY')
        );

        if (needsFix && autoHealEnabled && !isFixing) {
          console.log('[AUTONOMOUS_HEALER] Subsystem degradation detected. Triggering self-healing routine...');
          // Trigger heal asynchronously
          fetch('/api/system/auto-setup', { method: 'POST' })
            .then((r) => r.json())
            .then((fixData) => {
              if (fixData.actions) {
                setActionsLog(fixData.actions);
              }
              if (fixData.diagnostics) {
                setDiagnostics(fixData.diagnostics);
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[AUTONOMOUS_HEALER] Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [autoHealEnabled, isFixing]);

  // Execute full autonomous auto-setup and self-healing
  const runAutoSetup = useCallback(async () => {
    setIsFixing(true);
    try {
      const res = await fetch('/api/system/auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setActionsLog(data.actions || []);
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
          setLastScanTime(new Date());
        }
        return data;
      }
    } catch (err) {
      console.error('[AUTONOMOUS_HEALER] Auto-setup execution failed:', err);
    } finally {
      setIsFixing(false);
    }
    return null;
  }, []);

  // Initial scan on mount and periodic guardian interval (every 45s)
  useEffect(() => {
    runScan();

    if (autoHealEnabled) {
      intervalRef.current = setInterval(() => {
        runScan();
      }, 45000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runScan, autoHealEnabled]);

  return {
    diagnostics,
    isScanning,
    isFixing,
    lastScanTime,
    actionsLog,
    autoHealEnabled,
    setAutoHealEnabled,
    runScan,
    runAutoSetup,
  };
}
