'use client';

import { useState, useEffect, useCallback } from 'react';
import StartupAnimation from '@/components/os/startup-animation';
import HUD from '@/components/os/hud';
import ChatMode from '@/components/os/chat-mode';
import { cn } from '@/lib/utils';

export type AppMode = 'hud' | 'chat';

export default function Home() {
  const [booting, setBooting] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('skipBoot') === '1' || urlParams.get('skip') === '1') return false;
        if (navigator.userAgent.includes('Electron')) return false;
        if (sessionStorage.getItem('hermes_boot_seen') === 'true') return false;
      } catch {}
    }
    return true;
  });
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const req = urlParams.get('mode') as AppMode | null;
        if (req === 'hud' || req === 'chat') return req;
      } catch {}
    }
    return 'chat';
  });
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);

  const changeMode = useCallback((nextMode: AppMode) => {
    setMode(nextMode);
    try {
      localStorage.setItem('hermes_app_mode', nextMode);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const requestedMode = params.get('mode');
      if (requestedMode === 'hud' || requestedMode === 'chat') return;

      const savedMode = localStorage.getItem('hermes_app_mode');
      if (savedMode === 'hud' || savedMode === 'chat') setMode(savedMode);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreLastSession = async () => {
      try {
        const savedSessionId = localStorage.getItem('hermes_last_session_id');
        if (savedSessionId !== null) {
          // An empty saved value means the operator deliberately started a fresh thread.
          if (savedSessionId) setActiveSessionId(savedSessionId);
          return;
        }

        // Migrate existing installs: pick the newest Hermes thread when no app preference exists.
        const response = await fetch('/api/hermes/sessions');
        if (!response.ok) return;

        const data = await response.json();
        const latestSessionId = data.sessions?.[0]?.id;
        if (!cancelled && typeof latestSessionId === 'string' && latestSessionId) {
          localStorage.setItem('hermes_last_session_id', latestSessionId);
          setActiveSessionId(latestSessionId);
        }
      } catch {
        // Keep the app usable when browser storage or the Hermes session service is unavailable.
      }
    };

    void restoreLastSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFinishBoot = useCallback((targetMode?: AppMode) => {
    if (targetMode) changeMode(targetMode);
    setBooting(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('hermes_boot_seen', 'true');
      } catch {}
    }
  }, [changeMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const skipBootParam = urlParams.get('skipBoot') === '1' || urlParams.get('skip') === '1';
        const requestedMode = urlParams.get('mode') as AppMode | null;
        if (requestedMode === 'hud' || requestedMode === 'chat') {
          setMode(requestedMode);
        }

        const isElectron = navigator.userAgent.includes('Electron');
        const alreadySeen = sessionStorage.getItem('hermes_boot_seen') === 'true';

        if (skipBootParam || isElectron || alreadySeen) {
          setBooting(false);
          return;
        }
      } catch {}
    }

    // Snappy fallback safety timer: auto-resolve within 2.5s max
    const bootTimer = setTimeout(() => {
      setBooting(false);
      try {
        sessionStorage.setItem('hermes_boot_seen', 'true');
      } catch {}
    }, 2500);

    return () => clearTimeout(bootTimer);
  }, []);

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    try {
      localStorage.setItem('hermes_last_session_id', sessionId);
    } catch {}
    changeMode('chat');
  };

  const handleSessionChange = (sessionId: string | undefined) => {
    setActiveSessionId(sessionId);
    try {
      // Persist the empty value too so a deliberate New Session isn't replaced by old history.
      localStorage.setItem('hermes_last_session_id', sessionId || '');
    } catch {}
  };

  const renderContent = () => {
    switch (mode) {
      case 'hud':
        return (
          <HUD
            setMode={changeMode}
            onSelectSession={handleSelectSession}
          />
        );
      case 'chat':
        return (
          <ChatMode
            setMode={changeMode}
            initialSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onSessionChange={handleSessionChange}
          />
        );
      default:
        return <HUD setMode={changeMode} onSelectSession={handleSelectSession} />;
    }
  };

  return (
    <div
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center overflow-hidden select-none bg-background text-foreground"
      )}
    >
      {booting ? (
        <StartupAnimation onComplete={handleFinishBoot} />
      ) : (
        renderContent()
      )}
    </div>
  );
}
