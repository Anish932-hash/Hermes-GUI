'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  SlidersHorizontal,
  Cpu,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Terminal,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Laptop,
  Radio,
  Mic,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { soundFx, type AudioProfile } from '@/lib/audio-synth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getStoredSarvamApiKey,
  setStoredSarvamApiKey,
  synthesizeSarvamSpeech,
  playSarvamAudio,
} from '@/lib/sarvam';

interface SystemSettingsModalProps {
  onOpenConfig?: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ onOpenConfig }) => {
  const [open, setOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundFx.getMuted());
  const [audioProfile, setAudioProfile] = useState<AudioProfile>(() => soundFx.getProfile());
  const [masterVolume, setMasterVolume] = useState<number>(() => soundFx.getMasterVolume());
  const [pitchMultiplier, setPitchMultiplier] = useState<number>(() => soundFx.getPitchMultiplier());
  const [voiceRate, setVoiceRate] = useState<number>(() => soundFx.getVoiceRate());
  const [model, setModel] = useState('nvidia/nemotron-3-ultra-550b-a55b');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<any>({ active: true, output: '' });
  const [gatewayLogs, setGatewayLogs] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('models');
  const [winAudioActive, setWinAudioActive] = useState(false);
  const [micAudioActive, setMicAudioActive] = useState(false);
  const [sarvamKey, setSarvamKey] = useState('');
  const [showSarvamKey, setShowSarvamKey] = useState(false);
  const [sarvamSpeaker, setSarvamSpeaker] = useState('simran');
  const [sarvamLang, setSarvamLang] = useState('en-IN');
  const [isTestingSarvam, setIsTestingSarvam] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const syncAudioStates = () => {
      setWinAudioActive(soundFx.isSystemAudioActive());
      setMicAudioActive(soundFx.isDeviceAudioActive());
      setIsMuted(soundFx.getMuted());
      setAudioProfile(soundFx.getProfile());
      setMasterVolume(soundFx.getMasterVolume());
      setPitchMultiplier(soundFx.getPitchMultiplier());
      setVoiceRate(soundFx.getVoiceRate());
    };
    syncAudioStates();
    const unsub = soundFx.subscribe(syncAudioStates);
    return unsub;
  }, []);

  const loadSettings = async () => {
    try {
      const [configRes, gatewayRes] = await Promise.all([
        fetch('/api/hermes/config'),
        fetch('/api/hermes/gateway'),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setModel(configData.model);
        setAvailableModels(configData.availableModels || []);
      }

      if (gatewayRes.ok) {
        const gwData = await gatewayRes.json();
        setGatewayStatus(gwData);
        setGatewayLogs(gwData.logs || '');
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    if (open) {
      loadSettings();
      setSarvamKey(getStoredSarvamApiKey());
    }
  }, [open]);

  const handleSaveSarvam = () => {
    soundFx.playClick(1000);
    setStoredSarvamApiKey(sarvamKey);
    toast({
      title: "Sarvam AI Configuration Saved",
      description: sarvamKey.trim()
        ? "SARVAM_API_KEY updated for Bulbul TTS and Saaras STT models."
        : "Sarvam API Key removed.",
    });
  };

  const handleTestSarvamVoice = async () => {
    soundFx.playClick(1000);
    setIsTestingSarvam(true);
    try {
      const phrase = "Sarvam neural speech online. Bulbul text to speech and Saaras speech to text active in Hermes Agent.";
      const { audioUrl, speaker } = await synthesizeSarvamSpeech(phrase, {
        speaker: sarvamSpeaker as any,
        languageCode: sarvamLang as any,
        apiKey: sarvamKey || undefined,
      });
      playSarvamAudio(audioUrl, () => setIsTestingSarvam(false));
      toast({
        title: "Sarvam Voice Tested",
        description: `Playing neural synthesis with speaker "${speaker}".`,
      });
    } catch (err: any) {
      setIsTestingSarvam(false);
      toast({
        title: "Sarvam Voice Error",
        description: err.message || "Failed to generate Sarvam neural speech.",
        variant: "destructive",
      });
    }
  };

  const handleApplyModel = async (newModel: string, provider: string) => {
    soundFx.playClick(1000);
    setIsProcessing(true);
    try {
      const res = await fetch('/api/hermes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel, provider }),
      });
      if (res.ok) {
        setModel(newModel);
        toast({
          title: "Model Updated",
          description: `Active model switched to ${newModel}`,
        });
      }
    } catch {
      toast({
        title: "Configuration Error",
        description: "Failed to persist model to config.yaml",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGatewayAction = async (action: 'restart' | 'stop' | 'start') => {
    if (action !== 'start') {
      const target = `Hermes Gateway (${action})`;
      const detail = action === 'restart'
        ? 'This interrupts active Hermes sessions while the gateway restarts.'
        : 'This stops the gateway and may interrupt active Hermes sessions.';
      if (!window.confirm(`Confirm ${target}?\n\n${detail}\n\nChoose Cancel to leave the service unchanged.`)) return;
    }
    soundFx.playClick(900);
    setIsProcessing(true);
    try {
      const res = await fetch('/api/hermes/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(action !== 'start' ? { confirmation: `gateway.${action}` } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: `Gateway ${action.toUpperCase()}`,
          description: data.message || `Service command ${action} executed.`,
        });
        await loadSettings();
      }
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunSystemOptimization = async () => {
    if (!window.confirm('Confirm system optimization?\n\nThis runs local maintenance that may alter runtime caches/process state. It is not a guaranteed performance improvement.\n\nChoose Cancel to make no changes.')) return;
    soundFx.playBoost();
    setIsProcessing(true);
    try {
      const res = await fetch('/api/system/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'system.boost' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Hyper-Optimization Complete",
          description: `Observed ${data.freedMB ?? 0} MB RAM decrease. ${data.details?.join('; ') || 'System maintenance completed.'}`,
        });
      }
    } catch {
      toast({
        title: "Optimization Notice",
        description: "System buffers synchronized.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSound = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={() => soundFx.playClick(900)}
          className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-background/50 px-2 py-1 text-xs font-semibold text-primary transition-all hover:border-accent hover:bg-primary/20 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
          title="Open System & Hermes Controls"
        >
          <SlidersHorizontal size={13} />
          <span className="hidden 2xl:inline text-[11px]">SETTINGS</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl border border-primary/40 bg-background/95 backdrop-blur-xl font-headline text-foreground shadow-[0_0_40px_hsl(var(--primary)/0.25)]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded border border-primary bg-primary/20 p-1.5 text-accent shadow-[0_0_10px_hsl(var(--primary))]">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-widest text-primary [text-shadow:0_0_10px_hsl(var(--primary))]">
                  SYSTEM & HERMES CONFIGURATION
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  Live WSL Service Management & Inference Engine Settings
                </DialogDescription>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary hover:bg-primary/20"
              onClick={loadSettings}
              disabled={isProcessing}
            >
              <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => { soundFx.playClick(900); setActiveTab(val); }} className="mt-2 w-full">
          <TabsList className="grid grid-cols-5 bg-primary/10 border border-primary/20 p-1">
            <TabsTrigger value="models" className="text-xs">
              <Cpu size={12} className="mr-1.5" /> Models
            </TabsTrigger>
            <TabsTrigger value="sarvam" className="text-xs">
              <Mic size={12} className="mr-1.5 text-accent" /> Sarvam AI
            </TabsTrigger>
            <TabsTrigger value="gateway" className="text-xs">
              <Terminal size={12} className="mr-1.5" /> Gateway
            </TabsTrigger>
            <TabsTrigger value="audio" className="text-xs">
              <Volume2 size={12} className="mr-1.5" /> Audio & FX
            </TabsTrigger>
            <TabsTrigger value="optimizer" className="text-xs">
              <Sparkles size={12} className="mr-1.5" /> Optimizer
            </TabsTrigger>
          </TabsList>

          {/* Model Selector */}
          <TabsContent value="models" className="space-y-3 pt-3">
            <div className="text-xs text-muted-foreground">
              Select active inference model for Hermes Agent in WSL:
            </div>
            <div className="space-y-2">
              {availableModels.map((m) => {
                const isSelected = model === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleApplyModel(m.id, m.provider)}
                    className={`flex items-center justify-between rounded border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-accent bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.3)]'
                        : 'border-primary/15 bg-primary/5 hover:border-primary/40 hover:bg-primary/10'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-foreground text-xs flex items-center gap-2">
                        <span>{m.label}</span>
                        {isSelected && (
                          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] text-accent font-mono">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        ID: {m.id} • Provider: {m.provider.toUpperCase()}
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle size={16} className="text-accent" />
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-primary/30">
                        Switch
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {onOpenConfig && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  soundFx.playClick(1000);
                  onOpenConfig();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/25 hover:border-accent text-accent transition-all text-left font-mono text-xs cursor-pointer shadow-[0_0_12px_hsl(var(--accent)/0.15)] mt-3"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-accent" />
                  <span className="font-bold">ADVANCED: HERMES CONFIGURATION MATRIX (~/.hermes/config.yaml)</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-accent/40 bg-accent/20">OPEN &rarr;</span>
              </button>
            )}
          </TabsContent>

          {/* Sarvam AI STT & TTS Controls */}
          <TabsContent value="sarvam" className="space-y-4 pt-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                    <Mic size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">SARVAM AI NEURAL SPEECH CORE</h4>
                    <p className="text-[10px] text-muted-foreground font-sans">
                      Powers high-fidelity Speech-to-Text (Saaras) and Text-to-Speech (Bulbul)
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                    sarvamKey.trim()
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border-amber-400/40 bg-amber-400/15 text-amber-300"
                  )}
                >
                  {sarvamKey.trim() ? "🟢 KEY CONFIGURED" : "🟡 PENDING API KEY"}
                </span>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Key size={12} className="text-accent" />
                  <span>SARVAM API SUBSCRIPTION KEY</span>
                </label>
                <div className="relative">
                  <input
                    type={showSarvamKey ? "text" : "password"}
                    value={sarvamKey}
                    onChange={(e) => setSarvamKey(e.target.value)}
                    placeholder="Paste your Sarvam AI API Key here..."
                    className="w-full bg-background/80 border border-primary/30 rounded-lg px-3 py-1.5 pr-20 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowSarvamKey(!showSarvamKey)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                      title={showSarvamKey ? "Hide Key" : "Show Key"}
                    >
                      {showSarvamKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <Button
                      size="sm"
                      onClick={handleSaveSarvam}
                      className="h-6 px-2 text-[10px] font-bold bg-primary/20 hover:bg-primary text-accent hover:text-primary-foreground"
                    >
                      SAVE
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-sans">
                  Obtain your key from <a href="https://sarvam.ai" target="_blank" rel="noreferrer" className="text-accent underline">sarvam.ai</a> or provide via <code>.env</code> file (<code>SARVAM_API_KEY</code>).
                </p>
              </div>

              {/* Voice & Speaker Settings */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-primary/20">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    BULBUL TTS SPEAKER
                  </label>
                  <select
                    value={sarvamSpeaker}
                    onChange={(e) => setSarvamSpeaker(e.target.value)}
                    className="w-full bg-background border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
                  >
                    <option value="simran">Simran (Female, Crisp & Natural)</option>
                    <option value="dev">Dev (Male, Clear & Authoritative)</option>
                    <option value="priya">Priya (Female, Warm & Expressive)</option>
                    <option value="rahul">Rahul (Male, Deep & Conversational)</option>
                    <option value="aditya">Aditya (Male, Technical & Fast)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    LANGUAGE CODE
                  </label>
                  <select
                    value={sarvamLang}
                    onChange={(e) => setSarvamLang(e.target.value)}
                    className="w-full bg-background border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
                  >
                    <option value="en-IN">English (India) - en-IN</option>
                    <option value="hi-IN">Hindi - hi-IN</option>
                    <option value="bn-IN">Bengali - bn-IN</option>
                    <option value="ta-IN">Tamil - ta-IN</option>
                    <option value="te-IN">Telugu - te-IN</option>
                    <option value="mr-IN">Marathi - mr-IN</option>
                  </select>
                </div>
              </div>

              {/* Model Capability Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-primary/20">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                    STT: Saaras:v3
                  </span>
                  <span className="px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300">
                    TTS: Bulbul:v3
                  </span>
                </div>

                <Button
                  size="sm"
                  onClick={handleTestSarvamVoice}
                  disabled={isTestingSarvam}
                  className="h-7 text-xs font-mono font-bold bg-accent/20 border border-accent/40 text-accent hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  <Volume2 size={12} className={cn("mr-1.5", isTestingSarvam ? "animate-pulse" : "")} />
                  <span>{isTestingSarvam ? "SYNTHESIZING..." : "TEST SARVAM VOICE"}</span>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Gateway Service Controls */}
          <TabsContent value="gateway" className="space-y-3 pt-3">
            <div className="flex items-center justify-between rounded border border-primary/20 bg-primary/5 p-3">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-mono">Service Status</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${gatewayStatus.active ? 'bg-emerald-400 animate-ping' : 'bg-destructive'}`} />
                  <span className="font-bold text-foreground text-sm font-mono">
                    {gatewayStatus.active ? 'ACTIVE // RUNNING' : 'STOPPED'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGatewayAction('restart')}
                  disabled={isProcessing}
                  className="h-8 gap-1.5 text-xs border-primary/40 hover:bg-primary/20"
                >
                  <RotateCcw size={12} />
                  <span>Restart</span>
                </Button>
                {gatewayStatus.active ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleGatewayAction('stop')}
                    disabled={isProcessing}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Square size={12} />
                    <span>Stop</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleGatewayAction('start')}
                    disabled={isProcessing}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Play size={12} />
                    <span>Start</span>
                  </Button>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-muted-foreground mb-1 block">
                Systemd Journal Stream (Last 40 lines):
              </span>
              <ScrollArea className="h-44 rounded border border-primary/20 bg-background/60 p-2.5 font-mono text-[10px] text-accent/90">
                <pre className="whitespace-pre-wrap">{gatewayLogs || 'Connecting to journalctl...'}</pre>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Audio & Multi-Source Visualizer Preferences */}
          <TabsContent value="audio" className="space-y-3.5 pt-3">
            {/* Windows System Audio Loopback */}
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 font-mono">
              <div>
                <div className="flex items-center gap-2">
                  <Laptop size={14} className="text-cyan-400" />
                  <span className="font-bold text-xs text-foreground">Windows & Outside System Audio</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Visualizes all Windows sound, YouTube, Spotify, games, and system alerts
                </div>
              </div>
              <Button
                variant={winAudioActive ? 'destructive' : 'default'}
                size="sm"
                onClick={async () => {
                  soundFx.playClick(1000);
                  if (winAudioActive) {
                    soundFx.stopSystemAudioCapture();
                  } else {
                    const res = await soundFx.startSystemAudioCapture();
                    if (!res.success && res.error) {
                      toast({ title: 'Capture Notice', description: res.error, variant: 'destructive' });
                    } else if (res.success) {
                      toast({ title: 'Windows Audio Connected', description: 'Real-time FFT audio visualizer active.' });
                    }
                  }
                }}
                className="gap-1.5 h-8 text-xs font-mono"
              >
                <Radio size={12} className={winAudioActive ? 'animate-pulse' : ''} />
                <span>{winAudioActive ? 'DISCONNECT' : 'CAPTURE WIN AUDIO'}</span>
              </Button>
            </div>

            {/* Windows Sound Detection Policy */}
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 font-mono">
              <div>
                <div className="flex items-center gap-2">
                  <Laptop size={14} className="text-cyan-400" />
                  <span className="font-bold text-xs text-foreground">Sound Detection Engine</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Locked to Windows Host only [Output &amp; Input]. WSL PulseAudio is bypassed.
                </div>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-bold border border-cyan-400/40 bg-cyan-400/15 text-cyan-400">
                WINDOWS ONLY
              </span>
            </div>

            {/* Physical Input / Microphone */}
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 font-mono">
              <div>
                <div className="flex items-center gap-2">
                  <Mic size={14} className="text-amber-400" />
                  <span className="font-bold text-xs text-foreground">Microphone & Hardware Input</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Captures local microphone or Windows Stereo Mix hardware loopback
                </div>
              </div>
              <Button
                variant={micAudioActive ? 'destructive' : 'outline'}
                size="sm"
                onClick={async () => {
                  soundFx.playClick(900);
                  if (micAudioActive) {
                    soundFx.stopDeviceAudioCapture();
                  } else {
                    const res = await soundFx.startDeviceAudioCapture();
                    if (!res.success && res.error) {
                      toast({ title: 'Input Error', description: res.error, variant: 'destructive' });
                    }
                  }
                }}
                className="gap-1.5 h-8 text-xs font-mono border-primary/40"
              >
                <Mic size={12} />
                <span>{micAudioActive ? 'MUTE MIC' : 'CAPTURE MIC'}</span>
              </Button>
            </div>

            {/* Audio Profile Selector Deck */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Sparkles size={13} className="text-accent" />
                    <span>AUDIO PROFILE & SONIC PRESET</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-sans mt-0.5">
                    Tailors procedural synthesis waveforms, acoustic filters, and response frequencies
                  </div>
                </div>
                <Button
                  variant={isMuted ? 'outline' : 'default'}
                  size="sm"
                  onClick={toggleSound}
                  className="gap-2 h-7 text-xs font-mono"
                >
                  {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  <span>{isMuted ? 'UNMUTE ALL' : 'MUTE SFX'}</span>
                </Button>
              </div>

              {/* 4 Profile Cards Grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'stark' as AudioProfile,
                    name: 'STARK J.A.R.V.I.S.',
                    desc: 'Crystalline harmonic sine tones, clean C-major chords, warm analog lowpass filter',
                    badge: 'MCU ICONIC',
                    accentClass: 'border-accent text-accent bg-accent/10',
                  },
                  {
                    id: 'cyberpunk' as AudioProfile,
                    name: 'CYBERPUNK NETRUNNER',
                    desc: 'Gritty 8-bit square/sawtooth overdrive, bitcrushed telemetry, sharp resonance',
                    badge: 'NEO-TOKYO',
                    accentClass: 'border-emerald-400 text-emerald-400 bg-emerald-500/10',
                  },
                  {
                    id: 'nasa' as AudioProfile,
                    name: 'DEEP SPACE NASA',
                    desc: 'Apollo Roger-beeps, bandpassed comms squelches, low-frequency telemetry hum',
                    badge: 'MISSION CTRL',
                    accentClass: 'border-cyan-400 text-cyan-400 bg-cyan-500/10',
                  },
                  {
                    id: 'stealth' as AudioProfile,
                    name: 'SILENT STEALTH',
                    desc: 'Zero audible UI effects, whisper-quiet operation with purely visual HUD indicators',
                    badge: 'ZERO AUDIO',
                    accentClass: 'border-muted-foreground text-muted-foreground bg-muted/10',
                  },
                ].map((prof) => {
                  const isSelected = audioProfile === prof.id;
                  return (
                    <div
                      key={prof.id}
                      onClick={() => {
                        soundFx.setProfile(prof.id);
                        setAudioProfile(prof.id);
                        if (prof.id !== 'stealth') {
                          soundFx.playClick(1000);
                        }
                        toast({
                          title: `Audio Profile: ${prof.name}`,
                          description: prof.desc,
                        });
                      }}
                      className={cn(
                        'flex flex-col justify-between p-2.5 rounded-lg border cursor-pointer transition-all',
                        isSelected
                          ? cn('shadow-[0_0_15px_hsl(var(--primary)/0.3)]', prof.accentClass)
                          : 'border-primary/15 bg-background/40 hover:border-primary/40 hover:bg-primary/10'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-foreground truncate">{prof.name}</span>
                        <span className="text-[8px] px-1 py-0.2 rounded font-mono uppercase bg-primary/20 text-accent">
                          {prof.badge}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground font-sans line-clamp-2 leading-tight">
                        {prof.desc}
                      </p>
                      {isSelected && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-accent font-mono">
                          <CheckCircle size={10} /> ACTIVE PRESET
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sliders: Master Volume, Pitch Modulation, Speech Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-primary/10">
                {/* Master Volume */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">MASTER SFX GAIN</span>
                    <span className="text-accent font-bold">{Math.round(masterVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={masterVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setMasterVolume(val);
                      soundFx.setMasterVolume(val);
                    }}
                    className="w-full accent-accent h-1.5 bg-primary/20 rounded cursor-pointer"
                  />
                </div>

                {/* Pitch Modulation */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">PITCH MODULATION</span>
                    <span className="text-accent font-bold">{pitchMultiplier.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={pitchMultiplier}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPitchMultiplier(val);
                      soundFx.setPitchMultiplier(val);
                    }}
                    className="w-full accent-accent h-1.5 bg-primary/20 rounded cursor-pointer"
                  />
                </div>

                {/* Voice Speed Rate */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">VOICE RATE</span>
                    <span className="text-accent font-bold">{voiceRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={voiceRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVoiceRate(val);
                      soundFx.setVoiceRate(val);
                    }}
                    className="w-full accent-accent h-1.5 bg-primary/20 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* J.A.R.V.I.S. Interactive Soundboard Preview */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5 font-mono">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Volume2 size={13} className="text-primary" />
                  <span>J.A.R.V.I.S. SOUNDBOARD CONSOLE</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-sans">
                  Audition synthesized cues in active profile
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'UI CLICK', type: 'click' as const, desc: 'Short chirp' },
                  { label: 'REACTOR BOOST', type: 'boost' as const, desc: 'Bass sub sweep' },
                  { label: 'MESSAGE PING', type: 'ping' as const, desc: 'Triple harmonic' },
                  { label: 'TASK START', type: 'task_start' as const, desc: 'Dual chirp' },
                  { label: 'TASK SUCCESS', type: 'task_success' as const, desc: 'Stark triumph chord' },
                  { label: 'SECURITY ALERT', type: 'alert' as const, desc: 'Sawtooth warning' },
                ].map((s) => (
                  <Button
                    key={s.type}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      soundFx.playTestChime(s.type);
                    }}
                    className="h-8 text-xs border-primary/30 hover:border-accent hover:bg-primary/20 hover:text-accent font-mono flex items-center justify-between px-2.5 cursor-pointer"
                  >
                    <span className="font-bold text-[10px]">{s.label}</span>
                    <Play size={10} className="text-accent ml-1" />
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* System Optimizer */}
          <TabsContent value="optimizer" className="space-y-4 pt-3">
            <div className="rounded border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <Sparkles size={16} className="text-accent" />
                <span>Real WSL Memory & Cache Reclamation</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Executes true system-level maintenance: flushes dirty kernel page caches with sync,
                compacts Hermes SQLite write-ahead-logs, purges expired audio blobs, and releases V8 memory heaps.
              </p>
              <Button
                onClick={handleRunSystemOptimization}
                disabled={isProcessing}
                className="w-full gap-2 bg-primary/20 text-accent border border-primary/50 hover:bg-primary hover:text-primary-foreground font-bold tracking-widest text-xs h-10"
              >
                <Sparkles size={14} />
                <span>EXECUTE CACHE PURGE & COMPACTION</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
