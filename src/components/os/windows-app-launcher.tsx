'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, MonitorPlay, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type WindowsApp = { name: string; source: 'registered-app' | 'start-menu-shortcut' };

export function WindowsAppLauncher() {
  const { toast } = useToast();
  const [apps, setApps] = useState<WindowsApp[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/windows-apps', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not discover Windows applications');
      setApps(Array.isArray(data.applications) ? data.applications : []);
    } catch (error) {
      toast({
        title: 'Windows app discovery failed',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleApps = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return apps
      .filter((app) => app.name.toLocaleLowerCase().includes(normalized))
      .slice(0, 30);
  }, [apps, query]);

  const launch = async (name: string) => {
    setLaunching(name);
    try {
      const response = await fetch('/api/system/windows-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const choices = Array.isArray(data.candidates) ? ` Matches: ${data.candidates.join(', ')}` : '';
        throw new Error((data.error || 'Windows refused the launch request') + choices);
      }
      toast({ title: `${data.name || name} launched`, description: 'Windows accepted the launch request.' });
    } catch (error) {
      toast({
        title: 'Could not launch application',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setLaunching(null);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <MonitorPlay className="h-4 w-4 text-accent" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Windows application launcher</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{apps.length} discovered</span>
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Windows app list" className="rounded border border-primary/20 p-1.5 hover:bg-primary/10 disabled:opacity-50">
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Notepad, Calculator, VS Code..."
          aria-label="Search Windows applications"
          className="w-full rounded-md border border-primary/25 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
        />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto" aria-live="polite">
        {loading && apps.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Discovering Start Menu applications…</p>
        ) : visibleApps.length ? visibleApps.map((app) => (
          <div key={`${app.source}:${app.name}`} className="flex items-center gap-3 rounded-md border border-primary/10 bg-background/50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{app.name}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {app.source === 'registered-app' ? 'Registered Windows app' : 'Start Menu shortcut'}
              </p>
            </div>
            <button type="button" onClick={() => void launch(app.name)} disabled={Boolean(launching) || loading} className="rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-[10px] font-bold text-accent hover:bg-accent/20 disabled:opacity-50">
              {launching === app.name ? 'LAUNCHING…' : 'LAUNCH'}
            </button>
          </div>
        )) : (
          <p className="p-3 text-xs text-muted-foreground">
            {query ? 'No matching apps. Try a shorter search.' : 'No apps discovered. Add a shortcut to the Windows Start Menu and refresh.'}
          </p>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Launches registered apps or Start Menu shortcuts only. This panel does not accept shell commands or arbitrary executable paths.
      </p>
    </section>
  );
}
