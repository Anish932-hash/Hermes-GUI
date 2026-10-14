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
  const [autoHealEnabled, setAutoHealEnabled] = useState(false);
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

        // Scanning is read-only. Remediation is manual and requires a separate confirmation.

      }
    } catch (err) {
      console.warn('[AUTONOMOUS_HEALER] Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [autoHealEnabled, isFixing]);

  // Execute full autonomous auto-setup and self-healing
  const runAutoSetup = useCallback(async () => {
    const confirmed = window.confirm('Run Hermes Agent OS auto-setup?\n\nThis may start services, checkpoint the state database, and copy a configured provider key into the Hermes environment file.\n\nContinue only if you want these changes applied.');
    if (!confirmed) return null;
    setIsFixing(true);
    try {
      const res = await fetch('/api/system/auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'system.auto-setup' }),
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
