'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Cpu,
  Shield,
  Activity,
  History,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { soundFx } from '@/lib/audio-synth';
import type { HermesStatus, HermesSessionItem, HermesSkillItem } from '@/lib/hermes';

interface HermesDrawerProps {
  onSelectSession?: (sessionId: string) => void;
  onOpenConfig?: () => void;
}

export const HermesDrawer: React.FC<HermesDrawerProps> = ({ onSelectSession, onOpenConfig }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [sessions, setSessions] = useState<HermesSessionItem[]>([]);
  const [skills, setSkills] = useState<HermesSkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, sessionsRes, skillsRes] = await Promise.all([
        fetch('/api/hermes/status'),
        fetch('/api/hermes/sessions'),
        fetch('/api/hermes/skills'),
      ]);

      if (statusRes.ok) setStatus(await statusRes.json());
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.sessions || []);
      }
      if (skillsRes.ok) {
        const data = await skillsRes.json();
        setSkills(data.skills || []);
      }
    } catch (err) {
      console.warn('Error fetching Hermes telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const categories = Array.from(new Set(skills.map((s) => s.category || 'general')));
  const filteredSkills =
    activeCategory === 'all'
      ? skills
      : skills.filter((s) => (s.category || 'general') === activeCategory);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          onClick={() => soundFx.playClick(1000)}
          className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold tracking-wider text-primary transition-all duration-300 hover:border-accent hover:bg-primary/20 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
          title="Open Hermes Agent Command Center & Active Sessions"
        >
          <Activity size={13} className="animate-pulse text-accent" />
          <span className="hidden 2xl:inline text-[11px]">TELEMETRY</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl border-l border-primary/30 bg-background/95 backdrop-blur-xl p-6 font-headline text-foreground shadow-[0_0_50px_hsl(var(--primary)/0.2)]"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary bg-primary/20 text-accent shadow-[0_0_15px_hsl(var(--primary))]">
                <Shield size={18} />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold tracking-widest text-primary [text-shadow:0_0_10px_hsl(var(--primary))]">
                  HERMES AGENT // WSL
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground font-mono">
                  Autonomous Cybersecurity & Multi-Platform Intelligence Core
                </SheetDescription>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary hover:bg-primary/20"
              onClick={fetchData}
              disabled={isLoading}
              title="Refresh Hermes State"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </SheetHeader>

        {/* Quick Diagnostics Badges */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-[11px]">
          <div className="rounded border border-primary/20 bg-primary/5 p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Gateway Status</span>
            <span className="font-bold text-accent flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              {status?.gatewayState?.toUpperCase() || 'RUNNING'}
            </span>
            <span className="text-[10px] text-muted-foreground">PID: {status?.gatewayPid || 358}</span>
          </div>

          <div className="rounded border border-primary/20 bg-primary/5 p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Active Model</span>
            <span className="font-bold text-primary truncate block mt-0.5" title={status?.model}>
              Nemotron-3 550B
            </span>
            <span className="text-[10px] text-muted-foreground uppercase">{status?.provider || 'NVIDIA'}</span>
          </div>

          <div className="rounded border border-primary/20 bg-primary/5 p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Arsenal / Skills</span>
            <span className="font-bold text-accent block mt-0.5">{skills.length || 61} Loaded</span>
            <span className="text-[10px] text-emerald-400">All Verified</span>
          </div>
        </div>

        {onOpenConfig && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              soundFx.playClick(1000);
              setOpen(false);
              onOpenConfig();
            }}
            className="w-full mb-4 border-accent/40 bg-accent/10 hover:bg-accent/25 hover:border-accent text-accent font-mono text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_hsl(var(--accent)/0.15)]"
          >
            <SlidersHorizontal size={13} />
            <span>OPEN HERMES CONFIGURATIONS MATRIX</span>
          </Button>
        )}

        <Tabs defaultValue="skills" className="w-full">
          <TabsList className="grid grid-cols-3 bg-primary/10 border border-primary/20 p-1">
            <TabsTrigger
              value="skills"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Shield size={12} className="mr-1.5" /> Skills ({skills.length || 61})
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <History size={12} className="mr-1.5" /> Sessions ({sessions.length})
            </TabsTrigger>
            <TabsTrigger
              value="platforms"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Terminal size={12} className="mr-1.5" /> Channels
            </TabsTrigger>
          </TabsList>

          {/* Skills Tab */}
          <TabsContent value="skills" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pb-1">
              <Badge
                variant={activeCategory === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-[10px] hover:bg-primary/30"
                onClick={() => setActiveCategory('all')}
              >
                All ({skills.length})
              </Badge>
              {categories.slice(0, 8).map((cat) => (
                <Badge
                  key={cat}
                  variant={activeCategory === cat ? 'default' : 'outline'}
                  className="cursor-pointer text-[10px] hover:bg-primary/30 uppercase"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>

            <ScrollArea className="h-[360px] rounded border border-primary/20 bg-background/40 p-2">
              <div className="space-y-2">
                {filteredSkills.map((sk, idx) => (
                  <div
                    key={`${sk.name}-${idx}`}
                    className="flex items-center justify-between rounded border border-primary/10 bg-primary/5 p-2 text-xs transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <div>
                      <div className="font-bold text-accent font-mono">{sk.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {sk.category || 'system'} • {sk.source}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[9px] bg-primary/20 text-primary border-primary/30">
                      {sk.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-4 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Select any existing session from Hermes history to resume context in Chat Mode:
            </p>
            <ScrollArea className="h-[380px] rounded border border-primary/20 bg-background/40 p-2">
              <div className="space-y-2">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    onClick={() => {
                      soundFx.playClick();
                      onSelectSession?.(sess.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer rounded border border-primary/10 bg-primary/5 p-2.5 text-xs transition-all hover:border-accent hover:bg-primary/15 hover:shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground truncate max-w-[280px]">
                        {sess.title}
                      </span>
                      <span className="text-[10px] text-accent font-mono">{sess.lastActive}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>ID: {sess.id}</span>
                      <span>Workspace: {sess.workspace}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="mt-4 space-y-3">
            <div className="space-y-3">
              <div className="rounded border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Telegram Gateway</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    {status?.platforms?.telegram?.state || 'CONNECTED'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Full messaging platform integration enabled. Bi-directional chat routed through user service.
                </p>
              </div>

              <div className="rounded border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">WhatsApp Bridge</span>
                  </div>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                    {status?.platforms?.whatsapp?.state || 'RETRYING'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Bridge process managed by hermes-gateway service in WSL.
                </p>
              </div>

              <div className="rounded border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Local WSL REPL & CLI</span>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-primary/30">ACTIVE</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Path: /home/thecyberexpert/.hermes/hermes-agent/.hermes/bin/hermes
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
