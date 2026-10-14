'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleHelp, Clock3, RefreshCw, ShieldAlert, X } from 'lucide-react';

type HealthState = 'online' | 'offline' | 'degraded' | 'unknown';
type HealthService = {
  id: string;
  label: string;
  state: HealthState;
  message: string;
  checkedAt: string;
};
type HealthPayload = {
  checkedAt: string;
  services: HealthService[];
  counts: Record<HealthState, number>;
};

const stateStyles: Record<HealthState, string> = {
  online: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  offline: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  unknown: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

function StateIcon({ state }: { state: HealthState }) {
  if (state === 'online') return <CheckCircle2 size={14} aria-hidden="true" />;
  if (state === 'unknown') return <CircleHelp size={14} aria-hidden="true" />;
  return <ShieldAlert size={14} aria-hidden="true" />;
}

export default function SystemHealthWidget() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/system/health', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
      const data = await response.json() as HealthPayload;
      if (!Array.isArray(data.services)) throw new Error('Health response was malformed');
      setPayload(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  const onlineCount = payload?.counts.online ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open system health"
        title="System health"
        className="fixed right-4 top-4 z-[80] flex items-center gap-2 rounded-xl border border-primary/30 bg-background/90 px-3 py-2 text-xs font-mono text-foreground shadow-lg backdrop-blur-xl transition-colors hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Activity size={15} className="text-primary" aria-hidden="true" />
        <span>SYSTEM HEALTH</span>
        {payload && <span className="text-muted-foreground">{onlineCount}/{payload.services.length}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 p-3 pt-16 backdrop-blur-sm sm:p-8 sm:pt-20" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-health-title"
            className="w-full max-w-2xl rounded-2xl border border-primary/35 bg-background/95 p-4 text-foreground shadow-[0_0_50px_hsl(var(--primary)/0.15)] backdrop-blur-2xl sm:p-6"
          >
            <header className="mb-4 flex items-start justify-between gap-4 border-b border-primary/20 pb-4">
              <div>
                <h2 id="system-health-title" className="flex items-center gap-2 text-base font-bold tracking-wide">
                  <Activity size={18} className="text-primary" aria-hidden="true" />
                  SYSTEM COMMAND CENTER
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Read-only checks. Offline services are not automatically restarted.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-primary/25 p-2 hover:bg-primary/10 disabled:opacity-50" aria-label="Refresh system health" title="Refresh">
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-primary/25 p-2 hover:bg-primary/10" aria-label="Close system health">
                  <X size={15} />
                </button>
              </div>
            </header>

            {error && <p role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

            {payload && (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['online', 'offline', 'degraded', 'unknown'] as const).map((state) => (
                  <div key={state} className={`rounded-xl border p-3 ${stateStyles[state]}`}>
                    <p className="text-[10px] uppercase tracking-wider">{state}</p>
                    <p className="mt-1 text-xl font-semibold">{payload.counts[state] ?? 0}</p>
                  </div>
                ))}
              </div>
            )}

            {loading && !payload && <p className="py-8 text-center text-sm text-muted-foreground">Checking services…</p>}

            {payload && (
              <div className="space-y-2">
                {payload.services.map((service) => (
                  <article key={service.id} className="rounded-xl border border-border/70 bg-card/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{service.label}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${stateStyles[service.state]}`}>
                        <StateIcon state={service.state} />
                        {service.state}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{service.message}</p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/75">
                      <Clock3 size={11} aria-hidden="true" />
                      Checked {new Date(service.checkedAt).toLocaleTimeString()}
                    </p>
                  </article>
                ))}
              </div>
            )}

            <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
              A process being present does not prove every feature is usable. Provider keys are not tested by this overview; browser-only credentials are intentionally not read by the server.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
