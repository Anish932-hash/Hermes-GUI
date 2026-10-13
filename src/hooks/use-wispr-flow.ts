'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { soundFx } from '@/lib/audio-synth';
import type { WisprUser, WisprKeybind, WisprDictation, WisprStatusResponse } from '@/lib/wispr-flow';

export type WisprExecutionMode = 'manual_approve' | 'auto_execute';
export type WisprActivationMode = 'key_ptt' | 'hands_free';

const WISPR_SETTINGS_EVENT = 'hermes:wispr-settings-changed';
const WISPR_PROCESSED_EVENT = 'hermes:wispr-dictation-processed';
const handledDictationIds = new Set<string>();
const approvedDictationIds = new Set<string>();

function rememberHandledDictation(id: string): boolean {
  if (!id || handledDictationIds.has(id)) return false;
  handledDictationIds.add(id);
  if (handledDictationIds.size > 200) {
    const oldest = handledDictationIds.values().next().value;
    if (oldest) handledDictationIds.delete(oldest);
  }
  return true;
}

function claimApproval(id: string): boolean {
  if (!id || approvedDictationIds.has(id)) return false;
  approvedDictationIds.add(id);
  if (approvedDictationIds.size > 200) {
    const oldest = approvedDictationIds.values().next().value;
    if (oldest) approvedDictationIds.delete(oldest);
  }
  return true;
}

export interface UseWisprFlowOptions {
  pollingIntervalMs?: number;
  autoSubmitDefault?: boolean;
  defaultExecutionMode?: WisprExecutionMode;
  defaultActivationMode?: WisprActivationMode;
  autoLaunch?: boolean;
  onNewDictation?: (dictation: WisprDictation) => void;
  onAutoSubmit?: (text: string) => void;
  onPendingApproval?: (dictation: WisprDictation) => void;
}

export function useWisprFlow(options: UseWisprFlowOptions = {}) {
  const {
    pollingIntervalMs = 2500,
    autoSubmitDefault = false,
    defaultExecutionMode = 'manual_approve',
    defaultActivationMode = 'key_ptt',
    autoLaunch = true,
    onNewDictation,
    onAutoSubmit,
    onPendingApproval,
  } = options;

  const [isInstalled, setIsInstalled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [version, setVersion] = useState('');
  const [user, setUser] = useState<WisprUser | null>(null);
  const [keybinds, setKeybinds] = useState<WisprKeybind[]>([]);
  const [recentDictations, setRecentDictations] = useState<WisprDictation[]>([]);
  const [lastDictation, setLastDictation] = useState<WisprDictation | null>(null);
  const [totalDictationsCount, setTotalDictationsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  // Execution Mode: 'manual_approve' vs 'auto_execute'
  const [executionMode, setExecutionModeState] = useState<WisprExecutionMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hermes_wispr_execution_mode');
        if (saved === 'auto_execute' || saved === 'manual_approve') return saved;
        const legacyAuto = localStorage.getItem('hermes_wispr_auto_submit');
        if (legacyAuto !== null) return legacyAuto === 'true' ? 'auto_execute' : 'manual_approve';
      } catch {}
    }
    return autoSubmitDefault ? 'auto_execute' : defaultExecutionMode;
  });

  // Activation Mode: 'key_ptt' (Caps Lock) vs 'hands_free' (Keyless continuous ambient)
  const [activationMode, setActivationModeState] = useState<WisprActivationMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hermes_wispr_activation_mode');
        if (saved === 'hands_free' || saved === 'key_ptt') return saved;
      } catch {}
    }
    return defaultActivationMode;
  });

  // Pending dictation waiting for operator approval
  const [pendingDictation, setPendingDictation] = useState<WisprDictation | null>(null);

  const autoLaunchAttemptedRef = useRef(false);
  const autoLaunchRef = useRef(autoLaunch);
  const isMountedRef = useRef(true);
  const lastKnownIdRef = useRef<string | null>(null);
  const seenDictationIdsRef = useRef<Set<string> | null>(null);
  const onNewDictationRef = useRef(onNewDictation);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  const onPendingApprovalRef = useRef(onPendingApproval);
  const executionModeRef = useRef(executionMode);
  const activationModeRef = useRef(activationMode);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleProcessed = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id && pendingDictation?.id === id) setPendingDictation(null);
    };
    window.addEventListener(WISPR_PROCESSED_EVENT, handleProcessed);
    return () => window.removeEventListener(WISPR_PROCESSED_EVENT, handleProcessed);
  }, [pendingDictation]);

  useEffect(() => {
    autoLaunchRef.current = autoLaunch;
  }, [autoLaunch]);

  useEffect(() => {
    onNewDictationRef.current = onNewDictation;
  }, [onNewDictation]);

  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);

  useEffect(() => {
    onPendingApprovalRef.current = onPendingApproval;
  }, [onPendingApproval]);

  useEffect(() => {
    executionModeRef.current = executionMode;
  }, [executionMode]);

  useEffect(() => {
    activationModeRef.current = activationMode;
  }, [activationMode]);

  // Multiple panels use this hook. Keep their policy controls in sync within
  // this tab, and also honor changes made in another tab.
  useEffect(() => {
    const applySettings = (detail?: Partial<{ executionMode: WisprExecutionMode; activationMode: WisprActivationMode }>) => {
      if (detail?.executionMode === 'auto_execute' || detail?.executionMode === 'manual_approve') {
        executionModeRef.current = detail.executionMode;
        setExecutionModeState(detail.executionMode);
      }
      if (detail?.activationMode === 'hands_free' || detail?.activationMode === 'key_ptt') {
        activationModeRef.current = detail.activationMode;
        setActivationModeState(detail.activationMode);
      }
    };
    const handleCustom = (event: Event) => applySettings((event as CustomEvent).detail);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'hermes_wispr_execution_mode') {
        applySettings({ executionMode: event.newValue as WisprExecutionMode });
      }
      if (event.key === 'hermes_wispr_activation_mode') {
        applySettings({ activationMode: event.newValue as WisprActivationMode });
      }
    };
    window.addEventListener(WISPR_SETTINGS_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(WISPR_SETTINGS_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setExecutionMode = useCallback((mode: WisprExecutionMode) => {
    setExecutionModeState(mode);
    executionModeRef.current = mode;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hermes_wispr_execution_mode', mode);
        localStorage.setItem('hermes_wispr_auto_submit', String(mode === 'auto_execute'));
      } catch {}
      window.dispatchEvent(new CustomEvent(WISPR_SETTINGS_EVENT, { detail: { executionMode: mode } }));
    }
    soundFx.playClick(mode === 'auto_execute' ? 1200 : 900);
  }, []);

  const setActivationMode = useCallback((mode: WisprActivationMode) => {
    setActivationModeState(mode);
    activationModeRef.current = mode;
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('hermes_wispr_activation_mode', mode); } catch {}
      window.dispatchEvent(new CustomEvent(WISPR_SETTINGS_EVENT, { detail: { activationMode: mode } }));
    }
    soundFx.playClick(mode === 'hands_free' ? 1300 : 900);
  }, []);

  const approveDictation = useCallback((target?: WisprDictation | string) => {
    const textToApprove = typeof target === 'string'
      ? target
      : (target?.formattedText || target?.pastedText || pendingDictation?.formattedText || pendingDictation?.pastedText || '');
    const clean = textToApprove.trim();
    if (clean) {
      const dictationId = typeof target === 'object' ? target?.id : pendingDictation?.id;
      if (dictationId && !claimApproval(dictationId)) {
        setPendingDictation(null);
        return clean;
      }
      soundFx.playChirp();
      setPendingDictation(null);
      if (dictationId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WISPR_PROCESSED_EVENT, { detail: { id: dictationId } }));
      }
      if (onAutoSubmitRef.current) {
        onAutoSubmitRef.current(clean);
      }
    }
    return clean;
  }, [pendingDictation]);

  const discardDictation = useCallback(() => {
    soundFx.playClick(700);
    setPendingDictation(null);
    if (pendingDictation?.id && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WISPR_PROCESSED_EVENT, { detail: { id: pendingDictation.id } }));
    }
  }, [pendingDictation]);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const refreshTask = (async () => {
      try {
      if (isMountedRef.current) setIsSyncing(true);
      const res = await fetch('/api/system/wispr-flow', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok || !isMountedRef.current) return;

      const data: WisprStatusResponse = await res.json();
      if (!isMountedRef.current) return;

      setIsInstalled(data.installed);
      setIsRunning(data.running);
      setVersion(data.version);
      setUser(data.user);
      setKeybinds(data.keybinds);
      setRecentDictations(data.recentDictations || []);
      setTotalDictationsCount(data.totalDictationsCount || 0);

      // Silent Auto-Launch Wispr Flow if installed but not running
      if (data.installed && !data.running && autoLaunchRef.current && !autoLaunchAttemptedRef.current) {
        autoLaunchAttemptedRef.current = true;
        fetch('/api/system/wispr-flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'launch' }),
        }).catch(() => {});
      }

      const latest = data.lastDictation;
      if (latest) {
        const recent = data.recentDictations || [];
        if (!seenDictationIdsRef.current) {
          seenDictationIdsRef.current = new Set(recent.map((item) => item.id).filter(Boolean));
        }
        const seenIds = seenDictationIdsRef.current!;
        const newDictations = recent.filter((item) => item.id && !seenIds.has(item.id)).reverse();

        for (const dictation of newDictations) {
          seenIds.add(dictation.id);
          const text = (dictation.formattedText || dictation.pastedText || '').trim();
          const hasCallback = !!onNewDictationRef.current ||
            (executionModeRef.current === 'auto_execute' ? !!onAutoSubmitRef.current : !!onPendingApprovalRef.current);
          const shouldDeliver = hasCallback && rememberHandledDictation(dictation.id);

          if (text && executionModeRef.current === 'manual_approve') {
            setPendingDictation(dictation);
          }
          if (!shouldDeliver) continue;

          soundFx.playWakeWordChime();
          onNewDictationRef.current?.(dictation);
          if (!text) continue;
          if (executionModeRef.current === 'auto_execute') {
            onAutoSubmitRef.current?.(text);
          } else {
            onPendingApprovalRef.current?.(dictation);
          }
        }

        lastKnownIdRef.current = latest.id || lastKnownIdRef.current;
        setLastDictation(latest);
      }
      } catch (err) {
      console.warn('Wispr Flow sync notice:', err);
      } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
      refreshInFlightRef.current = null;
    }
    })();
    refreshInFlightRef.current = refreshTask;
    return refreshTask;
  }, []);

  const launchApp = useCallback(async () => {
    soundFx.playClick(1000);
    try {
      const res = await fetch('/api/system/wispr-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Wispr Flow launch failed (${res.status})`);
      autoLaunchAttemptedRef.current = true;
      setTimeout(refresh, 1200);
      return data;
    } catch (err) {
      console.warn('Wispr launch notice:', err);
    }
  }, [refresh]);

  const triggerPtt = useCallback(async () => {
    soundFx.playClick(1100);
    try {
      const res = await fetch('/api/system/wispr-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ptt' }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || data.error || `Wispr Flow shortcut failed (${res.status})`);
      setTimeout(refresh, 1200);
      return data;
    } catch (err) {
      console.warn('Wispr trigger notice:', err);
    }
  }, [refresh]);

  // Initial load and periodic polling
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollingIntervalMs]);

  return {
    isInstalled,
    isRunning,
    version,
    user,
    keybinds,
    recentDictations,
    lastDictation,
    totalDictationsCount,
    isSyncing,
    // Execution & Approval
    executionMode,
    setExecutionMode,
    // Activation (Keyless vs Hotkey)
    activationMode,
    setActivationMode,
    // Pending Approval
    pendingDictation,
    setPendingDictation,
    approveDictation,
    discardDictation,
    // Backward compatibility
    autoSubmit: executionMode === 'auto_execute',
    setAutoSubmit: (val: boolean) => setExecutionMode(val ? 'auto_execute' : 'manual_approve'),
    // Actions
    launchApp,
    triggerPtt,
    refresh,
  };
}
