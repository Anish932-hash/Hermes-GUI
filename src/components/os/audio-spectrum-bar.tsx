'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Volume2,
  SlidersHorizontal,
  Waves,
  Laptop,
  Terminal,
  Mic,
  Radio,
  CheckCircle,
  AlertCircle,
  X,
  Play,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface AudioSpectrumBarProps {
  className?: string;
  intensity?: number;
  label?: string;
  compact?: boolean;
}

type AudioSourceType = 'all_win' | 'windows' | 'hardware' | 'synth';

export const AudioSpectrumBar: React.FC<AudioSpectrumBarProps> = ({
  className,
  intensity = 0.35,
  label = 'WINDOWS AUDIO [OUTPUT / INPUT]',
  compact = false,
}) => {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 28 }, () => 8));
  const [peaks, setPeaks] = useState<number[]>(() => Array.from({ length: 28 }, () => 10));
  const [wavePoints, setWavePoints] = useState<number[]>(() => Array.from({ length: 32 }, () => 16));
  const [dbLevel, setDbLevel] = useState<string>('-48.0');
  const [isOutputActive, setIsOutputActive] = useState<boolean>(false);
  const [visualMode, setVisualMode] = useState<'fft' | 'oscilloscope'>('fft');

  // Source selection & modal state
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<AudioSourceType>('all_win');
  const [activeDetectedSource, setActiveDetectedSource] = useState<string>('STANDBY (WIN HOST)');

  // Hardware devices
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Source connection statuses (Strictly Windows Host Only)
  const [isWindowsCaptured, setIsWindowsCaptured] = useState(false);
  const [isDeviceCaptured, setIsDeviceCaptured] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>(Array.from({ length: 28 }, () => 10));

  // Sync state with audio-synth changes
  useEffect(() => {
    const updateCaptureStates = () => {
      setIsWindowsCaptured(soundFx.isSystemAudioActive());
      setIsDeviceCaptured(soundFx.isDeviceAudioActive());
    };

    updateCaptureStates();
    const unsub = soundFx.subscribe(updateCaptureStates);
    return unsub;
  }, []);

  // Enumerate input devices when modal opens
  useEffect(() => {
    if (isSourcesModalOpen) {
      soundFx.getAvailableInputDevices().then((devices) => {
        setInputDevices(devices);
        if (devices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devices[0].deviceId);
        }
      });
    }
  }, [isSourcesModalOpen, selectedDeviceId]);

  // Actions for audio capture
  const handleToggleWindowsAudio = async () => {
    soundFx.playClick(1000);
    setCaptureError(null);

    if (isWindowsCaptured) {
      soundFx.stopSystemAudioCapture();
    } else {
      const res = await soundFx.startSystemAudioCapture();
      if (!res.success && res.error) {
        setCaptureError(res.error);
      }
    }
  };

  const handleToggleDeviceAudio = async () => {
    soundFx.playClick(900);
    setCaptureError(null);

    if (isDeviceCaptured) {
      soundFx.stopDeviceAudioCapture();
    } else {
      const res = await soundFx.startDeviceAudioCapture(selectedDeviceId);
      if (!res.success && res.error) {
        setCaptureError(res.error);
      }
    }
  };

  // Main Real-Time 60FPS Multi-Source Audio Analysis Loop
  useEffect(() => {
    let tick = 0;
    const barCount = 28;
    const waveCount = 32;

    const freqDataSys = new Uint8Array(64);
    const timeDataSys = new Uint8Array(64);
    const freqDataDev = new Uint8Array(64);
    const timeDataDev = new Uint8Array(64);
    const freqDataSyn = new Uint8Array(64);
    const timeDataSyn = new Uint8Array(64);

    const updateAudioSpectrum = () => {
      tick += 0.05;

      const sysAnalyser = soundFx.getSystemAudioAnalyser();
      const devAnalyser = soundFx.getDeviceAudioAnalyser();
      const synAnalyser = soundFx.getMasterAnalyser();

      let sysActive = false;
      let devActive = false;
      let synActive = false;

      // 1. Probe Windows System Audio Analyser (Output)
      if (sysAnalyser && (sourceMode === 'all_win' || sourceMode === 'windows')) {
        sysAnalyser.getByteFrequencyData(freqDataSys);
        sysAnalyser.getByteTimeDomainData(timeDataSys);
        for (let i = 0; i < 32; i++) {
          if (freqDataSys[i] > 6) {
            sysActive = true;
            break;
          }
        }
      }

      // 2. Probe Device / Mic / Hardware Loopback Analyser (Input)
      if (devAnalyser && (sourceMode === 'all_win' || sourceMode === 'hardware')) {
        devAnalyser.getByteFrequencyData(freqDataDev);
        devAnalyser.getByteTimeDomainData(timeDataDev);
        for (let i = 0; i < 32; i++) {
          if (freqDataDev[i] > 6) {
            devActive = true;
            break;
          }
        }
      }

      // 3. Probe Internal Synthesizer Audio Analyser (SFX)
      if (synAnalyser && (sourceMode === 'all_win' || sourceMode === 'synth')) {
        synAnalyser.getByteFrequencyData(freqDataSyn);
        synAnalyser.getByteTimeDomainData(timeDataSyn);
        for (let i = 0; i < 32; i++) {
          if (freqDataSyn[i] > 8) {
            synActive = true;
            break;
          }
        }
      }

      // Determine active master source (Windows Host Only)
      let currentSource = 'STANDBY (WIN HOST)';
      let activeFreq: Uint8Array | null = null;
      let activeTime: Uint8Array | null = null;
      let isAnyActive = false;

      if (sysActive) {
        currentSource = 'WIN OUTPUT';
        activeFreq = freqDataSys;
        activeTime = timeDataSys;
        isAnyActive = true;
      } else if (devActive) {
        currentSource = 'WIN INPUT';
        activeFreq = freqDataDev;
        activeTime = timeDataDev;
        isAnyActive = true;
      } else if (synActive) {
        currentSource = 'WIN SFX';
        activeFreq = freqDataSyn;
        activeTime = timeDataSyn;
        isAnyActive = true;
      }

      setIsOutputActive(isAnyActive);
      setActiveDetectedSource(currentSource);

      const currentBars: number[] = [];
      const currentWave: number[] = [];
      let totalRms = 0;

      for (let b = 0; b < barCount; b++) {
        let barHeight = 0;

        if (activeFreq) {
          const binIndex = Math.min(63, Math.floor(Math.pow(b / barCount, 1.35) * 58));
          const rawAmp = activeFreq[binIndex] || 0;
          if (rawAmp > 3) {
            barHeight = Math.min(100, Math.round((rawAmp / 255) * 115));
          }
        }

        // Add high-tech idle visual noise if silent
        if (barHeight <= 3) {
          const qWave = Math.sin(tick * 2.2 + b * 0.4) * Math.cos(tick * 1.4 - b * 0.25);
          const noise = Math.max(4, Math.round(6 + qWave * 4 + intensity * 6));
          barHeight = noise;
        }

        currentBars.push(barHeight);

        // Studio peak-hold LED decay
        if (barHeight > (peaksRef.current[b] || 0)) {
          peaksRef.current[b] = barHeight;
        } else {
          peaksRef.current[b] = Math.max(
            barHeight,
            Math.round((peaksRef.current[b] || 0) * 0.92 - 0.4)
          );
        }
      }

      // Generate Oscilloscope Waveform points
      for (let w = 0; w < waveCount; w++) {
        if (activeTime) {
          const waveIndex = Math.min(63, Math.floor((w / waveCount) * 63));
          const sample = (activeTime[waveIndex] || 128) - 128;
          totalRms += sample * sample;
          currentWave.push(16 + (sample / 128) * 14);
        } else {
          const synthSample = Math.sin(tick * 2.8 + w * 0.3) * Math.cos(tick * 1.5) * (3 + intensity * 5);
          currentWave.push(16 + synthSample);
        }
      }

      setBars(currentBars);
      setPeaks([...peaksRef.current]);
      setWavePoints(currentWave);

      // Decibel meter calculation
      if (isAnyActive && activeTime) {
        const rms = Math.sqrt(totalRms / waveCount);
        const calculatedDb = Math.max(-48, Math.min(-0.2, 20 * Math.log10(Math.max(1, rms) / 128)));
        setDbLevel(calculatedDb.toFixed(1));
      } else {
        const idleDb = -48.0 + Math.sin(tick * 1.1) * 1.5;
        setDbLevel(idleDb.toFixed(1));
      }

      animFrameRef.current = requestAnimationFrame(updateAudioSpectrum);
    };

    animFrameRef.current = requestAnimationFrame(updateAudioSpectrum);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [intensity, sourceMode]);

  const numDb = parseFloat(dbLevel);
  const isHot = numDb > -12;
  const isNormal = numDb > -32;

  // SVG Waveform Path calculation
  const waveSvgPath = useMemo(() => {
    if (wavePoints.length < 2) return '';
    const step = 280 / (wavePoints.length - 1);
    let path = `M 0 ${wavePoints[0]}`;
    for (let i = 1; i < wavePoints.length; i++) {
      const prevX = (i - 1) * step;
      const prevY = wavePoints[i - 1];
      const currX = i * step;
      const currY = wavePoints[i];
      const midX = (prevX + currX) / 2;
      path += ` C ${midX} ${prevY}, ${midX} ${currY}, ${currX} ${currY}`;
    }
    return path;
  }, [wavePoints]);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => {
            soundFx.playClick(900);
            setIsSourcesModalOpen(true);
          }}
          className={cn(
            'flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all duration-300 font-mono text-[10px] select-none cursor-pointer shrink-0 hover:border-accent hover:shadow-[0_0_12px_hsl(var(--accent)/0.25)]',
            isOutputActive
              ? 'border-accent/60 bg-accent/15 text-accent shadow-[0_0_12px_hsl(var(--accent)/0.2)]'
              : 'border-primary/25 bg-background/80 text-muted-foreground hover:text-accent',
            className
          )}
          title={`Windows Sound Detection: ${activeDetectedSource} (${dbLevel} dB) — Click to configure Windows Output/Input sources`}
        >
          <Volume2
            size={12}
            className={cn('shrink-0', isOutputActive ? 'text-accent animate-pulse' : 'text-primary/70')}
          />
          <span className="text-[9px] font-bold text-cyan-400 hidden xl:inline">WIN AUDIO</span>
          <div className="flex items-end gap-[1.5px] h-3.5 w-14 shrink-0">
            {bars.slice(0, 12).map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-t-sm transition-all duration-75"
                style={{
                  height: `${Math.max(15, h)}%`,
                  backgroundColor: isOutputActive ? 'hsl(var(--accent))' : 'hsl(var(--primary)/0.5)',
                }}
              />
            ))}
          </div>
          <span className="text-[9px] font-mono font-bold text-accent shrink-0">
            {dbLevel} dB
          </span>
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full shrink-0',
              isHot ? 'bg-destructive animate-ping' : isOutputActive ? 'bg-accent animate-ping' : 'bg-emerald-400'
            )}
          />
        </button>
      ) : (
        <div
          className={cn(
            'relative flex flex-col gap-1 rounded-xl border border-primary/25 bg-background/70 p-2.5 backdrop-blur-md shadow-inner font-mono text-[10px] select-none transition-all duration-300',
            isOutputActive ? 'border-accent/60 shadow-[0_0_20px_hsl(var(--accent)/0.25)]' : '',
            className
          )}
        >
        {/* Visualizer Top Header */}
        <div className="flex items-center justify-between text-muted-foreground border-b border-primary/15 pb-1">
          {/* Left: Source Icon & Title */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Volume2
              size={12}
              className={cn(
                'transition-colors shrink-0',
                isOutputActive ? 'text-accent animate-pulse' : 'text-primary/70'
              )}
            />
            <span className="text-[9px] tracking-wider text-primary/90 font-bold whitespace-nowrap shrink-0">
              {label}
            </span>

            {/* Active Source Badge */}
            <span
              className={cn(
                'px-1.5 py-0.2 rounded text-[8px] font-mono font-bold tracking-tight uppercase shrink-0 transition-all border',
                activeDetectedSource === 'WIN SYSTEM'
                  ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-300 shadow-[0_0_8px_hsl(180_100%_50%/0.3)] animate-pulse'
                  : activeDetectedSource === 'WSL PULSE'
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 shadow-[0_0_8px_hsl(142_71%_45%/0.3)]'
                  : activeDetectedSource === 'MIC / INPUT'
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                  : activeDetectedSource === 'HUD SFX'
                  ? 'border-primary/50 bg-primary/15 text-accent'
                  : 'border-primary/20 bg-primary/5 text-muted-foreground/60'
              )}
            >
              {activeDetectedSource}
            </span>
          </div>

          {/* Right: Controls & Decibel Meter */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Audio Sources Config Trigger */}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick(900);
                setIsSourcesModalOpen(true);
              }}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all cursor-pointer',
                isWindowsCaptured || isDeviceCaptured
                  ? 'border-accent/60 bg-accent/15 text-accent shadow-[0_0_10px_hsl(var(--accent)/0.25)]'
                  : 'border-primary/25 bg-background/80 text-muted-foreground hover:text-accent hover:border-accent'
              )}
              title="Configure Audio Sources (Windows System Audio, Hardware Microphones)"
            >
              <Radio size={9} className={isWindowsCaptured ? 'animate-pulse text-accent' : ''} />
              <span>SOURCES</span>
            </button>

            {/* Mode Switcher Pill */}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick(1000);
                setVisualMode((m) => (m === 'fft' ? 'oscilloscope' : 'fft'));
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border border-primary/25 bg-background/80 text-muted-foreground hover:text-accent hover:border-accent transition-colors cursor-pointer"
              title="Toggle Visualizer Mode: FFT Spectrum vs Oscilloscope Wave"
            >
              {visualMode === 'fft' ? (
                <>
                  <Waves size={9} className="text-accent" />
                  <span>WAVE</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal size={9} className="text-accent" />
                  <span>FFT</span>
                </>
              )}
            </button>

            {/* Decibel Meter */}
            <div className="flex items-center gap-1 font-mono pl-0.5">
              <span
                className={cn(
                  'text-[10px] font-bold transition-colors',
                  isHot
                    ? 'text-destructive font-black animate-pulse'
                    : isNormal
                    ? 'text-accent'
                    : 'text-primary/70'
                )}
              >
                {dbLevel} dB
              </span>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  isHot
                    ? 'bg-destructive animate-ping'
                    : isOutputActive
                    ? 'bg-accent animate-ping'
                    : 'bg-emerald-400'
                )}
              />
            </div>
          </div>
        </div>

        {/* Main Visualizer Area */}
        {visualMode === 'fft' ? (
          /* 28 Real Equalizer Frequency Spectrum Bars with Peak-Hold LEDs */
          <div className="relative flex items-end justify-between gap-[2.5px] h-10 w-full pt-1.5 px-0.5">
            {bars.map((height, idx) => {
              const peak = peaks[idx] || height;
              const isHigh = height > 70;
              const isMid = height > 40;
              const isPeakHot = peak > 75;

              return (
                <div key={idx} className="relative flex-1 flex flex-col justify-end items-center h-full">
                  {/* Floating Studio Peak-Hold LED */}
                  <div
                    className={cn(
                      'absolute w-full h-[2px] rounded-full transition-all duration-75',
                      isPeakHot
                        ? 'bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]'
                        : peak > 45
                        ? 'bg-accent shadow-[0_0_5px_hsl(var(--accent))]'
                        : 'bg-primary/80 shadow-[0_0_3px_hsl(var(--primary))]'
                    )}
                    style={{ bottom: `${Math.min(98, Math.max(0, peak))}%` }}
                  />

                  {/* Main Equalizer Bar */}
                  <div
                    className={cn(
                      'w-full rounded-t-[1.5px] transition-all duration-75 ease-out',
                      isHigh
                        ? 'bg-gradient-to-t from-accent via-amber-400 to-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]'
                        : isMid
                        ? 'bg-gradient-to-t from-primary via-accent to-accent shadow-[0_0_5px_hsl(var(--accent)/0.4)]'
                        : 'bg-primary/40'
                    )}
                    style={{ height: `${Math.min(100, Math.max(5, height))}%` }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* Real-Time Oscilloscope Waveform */
          <div className="relative h-10 w-full pt-1 px-1 flex items-center justify-center">
            <svg viewBox="0 0 280 32" className="h-full w-full overflow-visible">
              {/* Center Zero Axis Line */}
              <line x1="0" y1="16" x2="280" y2="16" stroke="hsl(var(--primary)/0.2)" strokeDasharray="3 3" />
              {/* Ambient Waveform Shadow */}
              <path
                d={waveSvgPath}
                fill="none"
                stroke="hsl(var(--primary)/0.3)"
                strokeWidth="4"
                className="blur-[2px]"
              />
              {/* Sharp Laser Waveform */}
              <path
                d={waveSvgPath}
                fill="none"
                stroke={isOutputActive ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}
                strokeWidth="2"
                className="drop-shadow-[0_0_6px_hsl(var(--accent))]"
              />
            </svg>
          </div>
        )}

        {/* Real Frequency Band Labels */}
        <div className="flex justify-between items-center text-[8px] text-muted-foreground/60 px-0.5 pt-0.5 font-mono">
          <span>20Hz</span>
          <span>120Hz</span>
          <span>1kHz</span>
          <span>5kHz</span>
          <span>12kHz</span>
          <span>22kHz</span>
        </div>
      </div>
    )}

      {/* Universal Audio Sources Modal */}
      <Dialog open={isSourcesModalOpen} onOpenChange={setIsSourcesModalOpen}>
        <DialogContent className="max-w-xl border border-primary/40 bg-background/95 backdrop-blur-2xl p-5 shadow-[0_0_50px_hsl(var(--primary)/0.25)] font-headline text-foreground">
          <DialogHeader>
            <div className="flex items-center justify-between border-b border-primary/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg border border-accent/60 bg-accent/20 p-2 text-accent shadow-[0_0_12px_hsl(var(--accent)/0.3)]">
                  <Radio size={18} />
                </div>
                <div>
                  <DialogTitle className="text-sm font-black tracking-widest text-primary [text-shadow:0_0_10px_hsl(var(--primary))] font-mono">
                    AUDIO VISUALIZER // SOURCE MATRIX & TELEMETRY
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-mono">
                    Taps Outside Audio, Windows System Sound, WSL Linux PulseAudio, & Microphones
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{activeDetectedSource}</span>
              </div>
            </div>
          </DialogHeader>

          {captureError && (
            <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/15 text-destructive text-xs flex items-center gap-2 font-mono">
              <AlertCircle size={14} className="shrink-0" />
              <span>{captureError}</span>
            </div>
          )}

          <div className="space-y-3.5 my-2 font-mono">
            {/* Mode Selector Tabs */}
            <div className="flex items-center justify-between p-2 rounded-xl border border-primary/20 bg-primary/5 text-xs">
              <span className="text-muted-foreground font-bold">DETECTION BUS:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'all_win', label: 'ALL WINDOWS' },
                    { id: 'windows', label: 'WIN OUTPUT' },
                    { id: 'hardware', label: 'WIN INPUT' },
                    { id: 'synth', label: 'WIN SFX' },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      soundFx.playClick(950);
                      setSourceMode(id);
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] uppercase font-bold transition-all cursor-pointer',
                      sourceMode === id
                        ? 'bg-primary text-black shadow-[0_0_10px_hsl(var(--primary))]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source 1: Windows & Outside System Audio */}
            <div className="rounded-xl border border-primary/20 bg-background/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop size={15} className="text-cyan-400" />
                  <span className="font-bold text-xs text-foreground">
                    WINDOWS & EXTERNAL SYSTEM AUDIO [OUTPUT]
                  </span>
                </div>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[9px] font-bold border',
                    isWindowsCaptured
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                      : 'border-muted-foreground/30 bg-muted/10 text-muted-foreground'
                  )}
                >
                  {isWindowsCaptured ? 'STREAMING ACTIVE' : 'DISCONNECTED'}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
                Captures all external PC audio from outside: <strong>Windows System Sounds</strong>,
                <strong> Spotify</strong>, <strong>YouTube</strong>, <strong>Games</strong>, and media players with zero latency.
              </p>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-primary/80">
                  Tip: Check <strong>"Also share audio"</strong> in the browser share dialog.
                </span>
                <button
                  type="button"
                  onClick={handleToggleWindowsAudio}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm',
                    isWindowsCaptured
                      ? 'border-destructive/60 bg-destructive/20 text-destructive hover:bg-destructive hover:text-white'
                      : 'border-cyan-400/60 bg-cyan-400/20 text-cyan-300 hover:bg-cyan-400 hover:text-black shadow-[0_0_12px_hsl(180_100%_50%/0.3)]'
                  )}
                >
                  {isWindowsCaptured ? 'DISCONNECT WINDOWS AUDIO' : '⚡ CAPTURE WINDOWS AUDIO'}
                </button>
              </div>
            </div>

            {/* Source 2: Windows Sound Detection Policy */}
            <div className="rounded-xl border border-primary/20 bg-background/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop size={15} className="text-cyan-400" />
                  <span className="font-bold text-xs text-foreground">
                    SOUND DETECTION POLICY: WINDOWS ONLY
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold border border-cyan-400/40 bg-cyan-400/15 text-cyan-400">
                  WSL BYPASSED
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
                Sound detection and acoustic analysis are dedicated strictly to the <strong>Windows Host</strong> subsystem [Output &amp; Input]. WSL Linux internal PulseAudio sampling is disabled to prevent sound leakage, daemon conflicts, and background latency.
              </p>
            </div>

            {/* Source 3: Physical Microphone & Hardware Stereo Mix */}
            <div className="rounded-xl border border-primary/20 bg-background/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic size={15} className="text-amber-400" />
                  <span className="font-bold text-xs text-foreground">
                    MICROPHONE & HARDWARE STEREO MIX
                  </span>
                </div>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[9px] font-bold border',
                    isDeviceCaptured
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                      : 'border-muted-foreground/30 bg-muted/10 text-muted-foreground'
                  )}
                >
                  {isDeviceCaptured ? 'INPUT CONNECTED' : 'OFFLINE'}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="flex-1 bg-background border border-primary/30 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">Default Input Device (Stereo Mix / Mic)</option>
                  {inputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Device ${d.deviceId.slice(0, 10)}...`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleToggleDeviceAudio}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0',
                    isDeviceCaptured
                      ? 'border-destructive/60 bg-destructive/20 text-destructive hover:bg-destructive hover:text-white'
                      : 'border-amber-400/60 bg-amber-400/20 text-amber-300 hover:bg-amber-400 hover:text-black'
                  )}
                >
                  {isDeviceCaptured ? 'MUTE INPUT' : 'CONNECT INPUT'}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AudioSpectrumBar;
