'use client';

import LoopingVoiceHUD from './looping-voice-hud';
import { type AppMode } from '@/app/page';
import { cn } from '@/lib/utils';
import {
  Grid,
  MessageSquare,
  Send,
  Paperclip,
  X,
  PlusCircle,
  Shield,
  Activity,
  Terminal,
  RotateCcw,
  Mic,
  MicOff,
  Image as ImageIcon,
  Sparkles,
  Code,
  Globe,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Message } from './chat-message';
import ChatMessage from './chat-message';
import { nanoid } from 'nanoid';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { soundFx } from '@/lib/audio-synth';
import { HermesDrawer } from './hermes-drawer';
import { HermesConfigModal } from './hermes-config-modal';
import { SystemSettingsModal } from './system-settings-modal';
import { JarvisExecutionScreen } from './jarvis-execution-screen';
import { JarvisCommandPalette } from './jarvis-command-palette';
import { ThemeSwitcher } from './theme-switcher';
import { WslTerminalDrawer } from './wsl-terminal-drawer';
import { AudioSpectrumBar } from './audio-spectrum-bar';
import VoiceHUD from './voice-hud';

export interface JarvisTaskItem {
  id: string;
  title: string;
  protocol: string;
  command?: string;
  isCompleted?: boolean;
  realOutput?: string;
  sessionId?: string;
  startedAt: number;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Zap, Layers, Command, Wrench, Monitor, Waves, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { SlashCommandAutocomplete } from './slash-command-autocomplete';
import { HermesCommandsDialog } from './hermes-commands-dialog';
import { searchHermesCommands, type HermesCommand } from '@/lib/hermes-commands';
import { GodsEyeModal } from './gods-eye-modal';
import { AutoSetupModal } from './auto-setup-modal';
import { WindowsKaliBridgeModal } from './windows-kali-bridge';
import { WisprFlowModal } from './wispr-flow-modal';
import { useWisprFlow } from '@/hooks/use-wispr-flow';
import { buildGodsEyeUrl, GODS_EYE_PRESETS, cleanGeographicQuery, extractGodsEyeTarget, type GeoLocation } from '@/lib/godseye';
import { transcribeSarvamAudio } from '@/lib/sarvam';

const Corner = (props: React.HTMLAttributes<SVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M0 0 H 12 V 4 H 4 V 12 H 0 Z" />
  </svg>
);

interface ChatModeProps {
  setMode: (mode: AppMode) => void;
  initialSessionId?: string;
  onSelectSession?: (id: string) => void;
  onSessionChange?: (id: string | undefined) => void;
}

const ChatMode = ({ setMode, initialSessionId, onSelectSession, onSessionChange }: ChatModeProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [tasksQueue, setTasksQueue] = useState<JarvisTaskItem[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isPipDockExpanded, setIsPipDockExpanded] = useState<boolean>(false);

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    return tasksQueue.find((t) => t.id === activeTaskId) || null;
  }, [tasksQueue, activeTaskId]);

  const activeRunningTask = useMemo(() => {
    return tasksQueue.find((t) => !t.isCompleted) || (activeTask && !activeTask.isCompleted ? activeTask : null);
  }, [tasksQueue, activeTask]);

  const currentTaskTitle = useMemo(() => {
    if (activeRunningTask && !activeRunningTask.isCompleted) {
      return activeRunningTask.title;
    }
    if (isLoading) {
      return "HERMES NEURAL INFERENCE";
    }
    return undefined;
  }, [activeRunningTask, isLoading]);

  const currentProtocol = useMemo(() => {
    if (activeRunningTask && !activeRunningTask.isCompleted) {
      return activeRunningTask.protocol;
    }
    if (isLoading) {
      return "STARK PROTOCOL // NEMOTRON-3 INFERENCE";
    }
    return undefined;
  }, [activeRunningTask, isLoading]);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCommandsDialogOpen, setIsCommandsDialogOpen] = useState(false);
  const [isGodsEyeOpen, setIsGodsEyeOpen] = useState(false);
  const [isAutoSetupOpen, setIsAutoSetupOpen] = useState(false);
  const [isWindowsBridgeOpen, setIsWindowsBridgeOpen] = useState(false);
  const [isWisprModalOpen, setIsWisprModalOpen] = useState(false);
  const [godsEyeTarget, setGodsEyeTarget] = useState<string | undefined>(undefined);
  const [godsEyeLocation, setGodsEyeLocation] = useState<GeoLocation | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const { toast } = useToast();
  const sendQueryRef = useRef<(text: string, isProtocol?: boolean) => void>(() => {});

  const {
    isRunning: isWisprRunning,
    lastDictation: wisprLastDictation,
    executionMode: wisprExecutionMode,
    setExecutionMode: setWisprExecutionMode,
    activationMode: wisprActivationMode,
    setActivationMode: setWisprActivationMode,
    keybinds: wisprKeybinds,
    pendingDictation: wisprPendingDictation,
    setPendingDictation: setWisprPendingDictation,
    approveDictation: approveWisprDictation,
    discardDictation: discardWisprDictation,
  } = useWisprFlow({
    onAutoSubmit: (text) => {
      if (text && text.trim()) {
        soundFx.playChirp();
        toast({
          title: "⚡ Wispr Flow Auto-Executed",
          description: `"${text.trim()}"`,
        });
        sendQueryRef.current(text);
      }
    },
    onPendingApproval: (dictation) => {
      soundFx.playWakeWordChime();
      toast({
        title: "🌊 Wispr Flow Voice Input",
        description: `"${dictation.formattedText || dictation.pastedText}" - Awaiting Operator Approval`,
      });
    },
  });
  const wisprPttLabel = wisprKeybinds.find((keybind) => keybind.action.toLowerCase() === 'ptt')?.keys || 'shortcut not detected';

  // Handle keyboard shortcut for pending dictation approval (Enter to approve, Esc to discard)
  useEffect(() => {
    if (!wisprPendingDictation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        discardWisprDictation();
      } else if (e.key === 'Enter' && !e.shiftKey && (document.activeElement?.tagName !== 'TEXTAREA' || e.ctrlKey)) {
        e.preventDefault();
        approveWisprDictation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wisprPendingDictation, approveWisprDictation, discardWisprDictation]);

  const spawnKaliTerminal = async () => {
    soundFx.playClick(1100);
    toast({
      title: "🚀 Spawning Kali Linux Terminal",
      description: "Launching interactive Windows Terminal session on Windows host...",
    });
    try {
      const res = await fetch('/api/system/windows-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch-kali' }),
      });
      const data = await res.json();
      if (data.success) {
        soundFx.playTaskSuccess();
      }
    } catch (e: any) {
      toast({
        title: "Terminal Spawner Notice",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isRecordingInput, setIsRecordingInput] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const barRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const barAudioContextRef = useRef<AudioContext | null>(null);
  const barAnalyserRef = useRef<AnalyserNode | null>(null);
  const barStreamRef = useRef<MediaStream | null>(null);
  const barAnimFrameRef = useRef<number | null>(null);
  const barMaxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopBarAudioAnalysis = useCallback(() => {
    if (barMaxDurationRef.current) {
      clearTimeout(barMaxDurationRef.current);
      barMaxDurationRef.current = null;
    }
    if (barAnimFrameRef.current) {
      cancelAnimationFrame(barAnimFrameRef.current);
      barAnimFrameRef.current = null;
    }
    if (barStreamRef.current) {
      barStreamRef.current.getTracks().forEach((t) => t.stop());
      barStreamRef.current = null;
    }
    if (barAudioContextRef.current && barAudioContextRef.current.state !== 'closed') {
      try {
        barAudioContextRef.current.close();
      } catch {}
      barAudioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      try { barRecognitionRef.current?.abort(); } catch {}
      stopBarAudioAnalysis();
    };
  }, [stopBarAudioAnalysis]);

  // Listen for global 'hermes:open-godseye' custom event (from chat recon card or command palette)
  useEffect(() => {
    const handleGlobalOpenGodsEye = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      setIsGodsEyeOpen(true);
      if (detail?.target && Number.isFinite(Number(detail.target.lat)) && Number.isFinite(Number(detail.target.lon))) {
        const t = detail.target;
        const targetLoc: GeoLocation = {
          name: t.target || t.name || 'OSINT Target',
          lat: Number(t.lat),
          lon: Number(t.lon),
          alt: t.alt ? Number(t.alt) : 1800,
          pitch: t.pitch ? Number(t.pitch) : -45,
          heading: t.heading ? Number(t.heading) : 0,
          formattedAddress: t.address || t.formattedAddress,
          category: t.category,
        };
        setGodsEyeLocation(targetLoc);
        setGodsEyeTarget(t.target || t.name);
      } else if (detail?.query) {
        setGodsEyeTarget(detail.query);
        setGodsEyeLocation(null);
      }
    };

    window.addEventListener('hermes:open-godseye', handleGlobalOpenGodsEye);
    return () => window.removeEventListener('hermes:open-godseye', handleGlobalOpenGodsEye);
  }, []);

  // Listen for global 'hermes:open-task-execution' custom event
  useEffect(() => {
    const handleOpenTaskExecution = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail) {
        const taskId = `task-${nanoid()}`;
        const item: JarvisTaskItem = {
          id: taskId,
          title: detail.title || 'Live Tool Task Execution',
          protocol: detail.protocol || 'STARK PROTOCOL // NEMOTRON-3 TOOL INFERENCE',
          command: detail.command,
          isCompleted: detail.isCompleted ?? false,
          realOutput: detail.realOutput,
          sessionId: detail.sessionId || sessionId,
          startedAt: Date.now(),
        };
        setTasksQueue((prev) => [item, ...prev.filter((t) => t.title !== item.title)]);
        setActiveTaskId(taskId);
      }
    };

    window.addEventListener('hermes:open-task-execution', handleOpenTaskExecution);
    return () => window.removeEventListener('hermes:open-task-execution', handleOpenTaskExecution);
  }, [sessionId]);

  // Slash command autocomplete computation
  const isSlashAutocompleteOpen = input.startsWith('/') && !input.includes(' ');
  const slashQuery = isSlashAutocompleteOpen ? input.slice(1) : '';
  const matchedSlashCommands = searchHermesCommands(slashQuery, 12);

  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashQuery]);

  // Global Ctrl+K shortcut in chat mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        soundFx.playClick(1000);
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleBarMic = async () => {
    soundFx.playClick(1000);

    // If currently recording with MediaRecorder or SpeechRecognition, stop and transcribe
    if (isRecordingInput) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      } else {
        stopBarAudioAnalysis();
      }
      if (barRecognitionRef.current) {
        try {
          barRecognitionRef.current.stop();
        } catch {}
      }
      setIsRecordingInput(false);
      return;
    }

    // Ensure browser is operating in a Secure Context (required for microphone audio access)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      toast({
        title: "Secure Origin Required for Microphone",
        description: "Microphone access requires a secure origin (http://127.0.0.1:3001 or localhost). Please load via http://127.0.0.1:3001.",
        variant: "destructive",
      });
      return;
    }

    // Try high-accuracy Sarvam Saaras AI Speech-to-Text via MediaRecorder first
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        barStreamRef.current = stream;
        audioChunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          stopBarAudioAnalysis();
          const cleanType = (recorder.mimeType || 'audio/webm').split(';')[0].trim();
          const audioBlob = new Blob(audioChunksRef.current, { type: cleanType });
          audioChunksRef.current = [];

          if (audioBlob.size > 150) {
            setIsTranscribing(true);
            try {
              const transcript = await transcribeSarvamAudio(audioBlob, {
                model: 'saaras:v3',
              });
              if (transcript && transcript.trim()) {
                const cleanTranscript = transcript.trim();
                setInput(cleanTranscript);
                soundFx.playChirp();
                toast({
                  title: "🎙️ Voice Command Dispatched",
                  description: `"${cleanTranscript}"`,
                });
                sendQuery(cleanTranscript);
              } else {
                toast({
                  title: "Sarvam STT Completed",
                  description: "No clear speech detected. Speak clearly into the microphone.",
                });
              }
            } catch (err: any) {
              console.warn('Sarvam STT failed:', err);
              toast({
                title: "Sarvam STT Notice",
                description: err.message || "Failed to transcribe speech via Sarvam Saaras core.",
                variant: "destructive",
              });
            } finally {
              setIsTranscribing(false);
            }
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(100);
        setIsRecordingInput(true);
        barMaxDurationRef.current = setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            setIsRecordingInput(false);
          }
        }, 25000);

        // Web Audio VAD: Auto-stop after 1.8s silence following speech
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          barAudioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          barAnalyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let hasSpoken = false;
          let speechStartTime = 0;
          let lastSpokenTime = 0;

          const checkVAD = () => {
            if (!barAnalyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
              return;
            }
            barAnalyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            let peakVal = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = dataArray[i];
              if (v > peakVal) peakVal = v;
              sum += v;
            }
            const avg = sum / dataArray.length / 255;
            const active = avg > 0.02 || peakVal > 18;
            const now = Date.now();

            if (active) {
              if (!speechStartTime) speechStartTime = now;
              hasSpoken = true;
              lastSpokenTime = now;
            } else if (hasSpoken && lastSpokenTime > 0) {
              const spokeDuration = lastSpokenTime - speechStartTime;
              const silenceDuration = now - lastSpokenTime;
              if (spokeDuration > 350 && silenceDuration >= 1800) {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  try {
                    mediaRecorderRef.current.stop();
                  } catch {}
                }
                setIsRecordingInput(false);
                return;
              }
            }

            barAnimFrameRef.current = requestAnimationFrame(checkVAD);
          };

          barAnimFrameRef.current = requestAnimationFrame(checkVAD);
        }

        toast({
          title: "🎙️ Sarvam AI Voice Recording",
          description: "Listening via Saaras model... Auto-detects pause or click mic to finish.",
        });
        return;
      } catch (mediaErr: any) {
        console.warn('MediaRecorder / getUserMedia init failed:', mediaErr);
        stopBarAudioAnalysis();
        if (mediaRecorderRef.current?.state === 'recording') {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
        const name = mediaErr?.name || '';
        let fixMsg = "Microphone permission required or browser does not expose audio capture.";
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          fixMsg = "Microphone access blocked by Windows. Turn ON 'Let desktop apps access your microphone' in Windows Settings.";
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          fixMsg = "No audio input device detected. Please connect or enable a microphone in Windows Sound settings.";
        } else if (name === 'NotReadableError') {
          fixMsg = "Microphone is currently in use or locked by another Windows app.";
        }

        const SpeechRecognition =
          typeof window !== 'undefined'
            ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            : null;

        if (!SpeechRecognition) {
          toast({
            title: "Microphone Access Notice",
            description: fixMsg,
            variant: "destructive",
            action: (
              <button
                type="button"
                onClick={() => {
                  fetch('/api/system/windows-bridge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'open-mic-settings' }),
                  }).catch(() => {});
                }}
                className="px-2 py-1 text-xs font-mono font-bold rounded bg-destructive/30 hover:bg-destructive/50 text-white border border-destructive/60 cursor-pointer"
              >
                Fix in Windows
              </button>
            ),
          });
          return;
        }
      }
    }

    // Fallback: Web Speech API
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      toast({
        title: "Microphone Capture Unavailable",
        description: "Microphone permission required. Please enable microphone access in Windows Settings.",
        variant: "destructive",
        action: (
          <button
            type="button"
            onClick={() => {
              fetch('/api/system/windows-bridge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'open-mic-settings' }),
              }).catch(() => {});
            }}
            className="px-2 py-1 text-xs font-mono font-bold rounded bg-destructive/30 hover:bg-destructive/50 text-white border border-destructive/60 cursor-pointer"
          >
            Fix in Windows
          </button>
        ),
      });
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = navigator.language || 'en-IN';

      let capturedSpeech = '';
      rec.onstart = () => {
        capturedSpeech = '';
        setIsRecordingInput(true);
      };
      rec.onresult = (event: any) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        if (currentText) {
          capturedSpeech = currentText.trim();
          setInput(capturedSpeech);
        }
      };
      rec.onerror = () => setIsRecordingInput(false);
      rec.onend = () => {
        setIsRecordingInput(false);
        if (capturedSpeech) {
          soundFx.playChirp();
          sendQuery(capturedSpeech);
          capturedSpeech = '';
        }
      };

      barRecognitionRef.current = rec;
      rec.start();
    } catch {
      setIsRecordingInput(false);
    }
  };

  const loadSessionHistory = async (targetSessionId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/hermes/session-messages?sessionId=${encodeURIComponent(targetSessionId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: nanoid(),
              role: m.role as 'user' | 'model',
              content: m.content,
            }))
          );
          return;
        }
      }
      setMessages([]);
    } catch (err) {
      console.warn('Failed to load session messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      loadSessionHistory(initialSessionId);
    }
  }, [initialSessionId]);

  const handleSelectSessionInternal = (id: string) => {
    soundFx.playClick(900);
    setSessionId(id);
    loadSessionHistory(id);
    if (onSelectSession) {
      onSelectSession(id);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Only image files are supported.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setPhotoDataUri(dataUri);
        setPhotoPreview(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setPhotoDataUri(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNewSession = () => {
    soundFx.playClick(1000);
    setSessionId(undefined);
    onSessionChange?.(undefined);
    setMessages([]);
    toast({
      title: "New Hermes Thread",
      description: "Session reset. A fresh Hermes session ID will be generated.",
    });
  };

  const executeClientAction = (actionKey?: string) => {
    switch (actionKey) {
      case 'clear':
        soundFx.playClick(900);
        setMessages([]);
        setInput('');
        toast({
          title: "Visual Stream Cleared",
          description: "All messages have been purged from display.",
        });
        break;
      case 'new':
        handleNewSession();
        break;
      case 'palette':
        soundFx.playClick(1000);
        setIsCommandPaletteOpen(true);
        setInput('');
        break;
      case 'config':
      case 'settings':
        soundFx.playClick(1000);
        setIsConfigOpen(true);
        setInput('');
        break;
      case 'terminal':
        soundFx.playClick(1000);
        const termBtn = document.querySelector('button[title*="Terminal"]') as HTMLButtonElement | null;
        if (termBtn) termBtn.click();
        setInput('');
        break;
      case 'voice':
        soundFx.playClick(1000);
        setIsVoiceOpen(true);
        setInput('');
        break;
      case 'godseye':
        soundFx.playClick(1100);
        setIsGodsEyeOpen(true);
        setInput('');
        break;
      case 'yolo':
        soundFx.playClick(1200);
        toast({
          title: "YOLO Mode Active",
          description: "Autonomous execution unlocked: dangerous shell command confirmation prompts bypassed.",
        });
        sendQuery('/yolo');
        break;
      default:
        break;
    }
  };

  const handleSelectCommandFromAutocomplete = (cmd: HermesCommand, isTabKey = false) => {
    soundFx.playClick(1000);
    const hasMandatoryArgs = !!(cmd.argsHint && cmd.argsHint.trim().startsWith('<'));

    // If Tab key was used, or if the command requires mandatory arguments, populate input with space
    if (isTabKey || hasMandatoryArgs) {
      setInput(`${cmd.command} `);
    } else {
      // Optional or zero arguments on Enter: execute immediately!
      setInput('');
      if (cmd.isClientAction) {
        executeClientAction(cmd.clientActionKey);
      } else {
        sendQuery(cmd.command);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSlashAutocompleteOpen && matchedSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        soundFx.playMicroTick();
        setSlashSelectedIndex((prev) => (prev + 1) % matchedSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        soundFx.playMicroTick();
        setSlashSelectedIndex((prev) => (prev - 1 + matchedSlashCommands.length) % matchedSlashCommands.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const selected = matchedSlashCommands[slashSelectedIndex] || matchedSlashCommands[0];
        handleSelectCommandFromAutocomplete(selected, true);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = matchedSlashCommands[slashSelectedIndex] || matchedSlashCommands[0];
        handleSelectCommandFromAutocomplete(selected, false);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
    }
  };

  const sendQuery = async (queryText: string, isProtocol = false) => {
    if (!queryText.trim() || isLoading) return;

    // Check client-side instant commands
    const queryLower = queryText.trim().toLowerCase();
    if (queryLower === '/clear') {
      executeClientAction('clear');
      return;
    }
    if (queryLower === '/new' || queryLower === '/reset') {
      executeClientAction('new');
      return;
    }
    if (queryLower === '/palette') {
      executeClientAction('palette');
      return;
    }
    if (queryLower === '/config' || queryLower === '/settings') {
      executeClientAction('config');
      return;
    }
    if (queryLower === '/terminal') {
      executeClientAction('terminal');
      return;
    }
    if (queryLower === '/voice') {
      executeClientAction('voice');
      return;
    }
    if (
      queryLower === '/autosetup' ||
      queryLower === '/selfheal' ||
      queryLower === '/diagnostics' ||
      queryLower === 'auto setup' ||
      queryLower === 'setup everything' ||
      queryLower === 'detect everything' ||
      queryLower === 'self heal' ||
      queryLower === 'fix all issues' ||
      queryLower === 'run diagnostics'
    ) {
      soundFx.playClick(1100);
      setIsAutoSetupOpen(true);
      toast({
        title: "⚡ Autonomous Diagnostics & Self-Healing",
        description: "Scanning and auto-provisioning all 7 Hermes subsystems...",
      });
      return;
    }

    if (
      queryLower === '/kali' ||
      queryLower === '/wsl' ||
      queryLower === 'launch kali' ||
      queryLower === 'open kali' ||
      queryLower === 'kali terminal' ||
      queryLower === 'launch wsl kali' ||
      queryLower === 'wsl kali' ||
      queryLower === 'start kali'
    ) {
      spawnKaliTerminal();
      setInput('');
      return;
    }

    if (
      queryLower === '/windows' ||
      queryLower === '/win' ||
      queryLower === 'windows app' ||
      queryLower === 'windows launcher' ||
      queryLower === 'open windows' ||
      queryLower === 'windows host'
    ) {
      soundFx.playClick(1100);
      setIsWindowsBridgeOpen(true);
      setInput('');
      return;
    }

    if (
      queryLower === '/explorer' ||
      queryLower === 'open explorer' ||
      queryLower === 'windows explorer'
    ) {
      soundFx.playClick(1000);
      fetch('/api/system/windows-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open-explorer' }),
      });
      toast({
        title: "📂 Opening Windows Explorer",
        description: "Launching Windows File Explorer at studio codebase...",
      });
      setInput('');
      return;
    }

    // Intercept God's Eye commands and natural language geographic requests (Spoken Voice & Wispr Flow)
    const godsEyeExtracted = extractGodsEyeTarget(queryText);

    if (godsEyeExtracted !== null) {
      soundFx.playClick(1100);
      setIsGodsEyeOpen(true);
      if (godsEyeExtracted) {
        setGodsEyeTarget(godsEyeExtracted);
        // Dispatch to active modal if already mounted
        window.dispatchEvent(new CustomEvent('hermes:open-godseye', { detail: { query: godsEyeExtracted } }));
      }
    }

    soundFx.playClick(900);
    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: queryText,
      imageUrl: photoPreview ?? undefined,
    };

    setIsLoading(true);

    // Comprehensive detection: ANY task, tool instruction, protocol, or command
    const isPureGreeting = /^(?:hi|hello|hey|yo|greetings|good\s+(?:morning|afternoon|evening|day)|howdy)[.?!]?$/i.test(queryText.trim());

    const isExplicitTask =
      /\b(?:task|tasks|tool|tools|protocol|execute|execution|run|exec|scan|audit|diagnos|test|check|verify|analyze|analysis|monitor|inspect|benchmark|probe|search|find|list|show|get|create|make|build|generate|write|code|script|fix|debug|patch|install|setup|configure|config|start|stop|restart|kill|terminal|bash|sh|python|wsl|kali|system|process|processes|memory|cpu|disk|ports?|sockets?|network|perimeter|ping|curl|git|docker|boost|overclock|flush|arsenal|skills?|yolo)\b/i.test(queryText.trim());

    const isToolTask =
      godsEyeExtracted === null &&
      (isProtocol ||
       queryText.startsWith('/') ||
       isExplicitTask ||
       (!isPureGreeting && queryText.trim().length > 0));

    let derivedProtocol = queryText.startsWith('/')
      ? `PROTOCOL: ${queryText.slice(1).split(' ')[0].toUpperCase()}_EXECUTION`
      : queryText.toLowerCase().includes('boost') || queryText.toLowerCase().includes('overclock')
      ? 'PROTOCOL: STARK_HYPER_BOOST'
      : queryText.toLowerCase().includes('scan') || queryText.toLowerCase().includes('port')
      ? 'PROTOCOL: KALI_PERIMETER_AUDIT'
      : queryText.toLowerCase().includes('audit') || queryText.toLowerCase().includes('security')
      ? 'PROTOCOL: KALI_SECURITY_AUDIT'
      : queryText.toLowerCase().includes('skill')
      ? 'PROTOCOL: SKILL_ARSENAL_VERIFY'
      : queryText.toLowerCase().includes('process')
      ? 'PROTOCOL: PROCESS_ARCHITECTURE_MATRIX'
      : queryText.toLowerCase().includes('python') || queryText.toLowerCase().includes('script')
      ? 'PROTOCOL: UV_PYTHON_RUNTIME_EXEC'
      : queryText.toLowerCase().includes('task')
      ? 'PROTOCOL: AUTONOMOUS_TASK_PIPELINE'
      : queryText.toLowerCase().includes('wsl') || queryText.toLowerCase().includes('kali')
      ? 'PROTOCOL: KALI_WSL2_SUBSYSTEM_INTEROP'
      : 'STARK PROTOCOL // NEMOTRON-3 TOOL INFERENCE';

    let activeTaskInstanceId: string | null = null;
    let initialTaskAiMessageId: string | null = null;

    if (isToolTask) {
      activeTaskInstanceId = `task-${nanoid()}`;
      initialTaskAiMessageId = `msg-${activeTaskInstanceId}`;
      const newTask: JarvisTaskItem = {
        id: activeTaskInstanceId,
        title: queryText,
        protocol: derivedProtocol,
        command: queryText.startsWith('/') || isProtocol ? queryText : undefined,
        isCompleted: false,
        startedAt: Date.now(),
      };
      setTasksQueue((prev) => [newTask, ...prev]);
      setActiveTaskId(activeTaskInstanceId);

      const initialTaskAiMessage: Message = {
        id: initialTaskAiMessageId,
        role: 'model',
        content: '',
        taskMeta: {
          title: queryText,
          protocol: derivedProtocol,
          command: queryText.startsWith('/') || isProtocol ? queryText : undefined,
          status: 'RUNNING',
          exitCode: 'STREAMING // WSL2',
        },
      };
      setMessages((prev) => [...prev, userMessage, initialTaskAiMessage]);
    } else {
      setMessages((prev) => [...prev, userMessage]);
    }

    setInput('');
    handleRemoveImage();

    try {
      const res = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      soundFx.playMessagePing();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        onSessionChange?.(data.sessionId);
      }

      const answer = data.content || 'Hermes completed the task.';

      if (initialTaskAiMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === initialTaskAiMessageId
              ? {
                  ...m,
                  content: answer,
                  taskMeta: {
                    ...m.taskMeta!,
                    status: 'SUCCESS',
                    exitCode: '200 OK // 0',
                    realOutput: answer,
                  },
                }
              : m
          )
        );
      } else {
        const aiMessage: Message = {
          id: nanoid(),
          role: 'model',
          content: answer,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }

      // Check if response contains a ```godseye block with resolved coordinates and auto-fly
      if (answer && answer.includes('```godseye')) {
        const godseyeMatch = answer.match(/```godseye\s*([\s\S]*?)```/);
        if (godseyeMatch) {
          try {
            const payload = JSON.parse(godseyeMatch[1]);
            if (payload && Number.isFinite(Number(payload.lat)) && Number.isFinite(Number(payload.lon))) {
              setIsGodsEyeOpen(true);
              const targetLoc: GeoLocation = {
                name: payload.target || payload.name || 'OSINT Target',
                lat: Number(payload.lat),
                lon: Number(payload.lon),
                alt: Number(payload.alt) || 1800,
                pitch: Number(payload.pitch) || -45,
                heading: Number(payload.heading) || 0,
                formattedAddress: payload.address || payload.formattedAddress || payload.target,
                category: payload.category,
              };
              setGodsEyeLocation(targetLoc);
              setGodsEyeTarget(payload.target || payload.name);
              window.dispatchEvent(new CustomEvent('hermes:open-godseye', { detail: { target: payload } }));
            }
          } catch {}
        }
      }

      if (activeTaskInstanceId) {
        setTasksQueue((prev) =>
          prev.map((t) =>
            t.id === activeTaskInstanceId
              ? {
                  ...t,
                  isCompleted: true,
                  realOutput: answer,
                  sessionId: data.sessionId || sessionId,
                }
              : t
          )
        );
        if (isVoiceOpen) {
          setActiveTaskId(null);
        }
      }
    } catch (error: any) {
      console.error('Error invoking Hermes agent:', error);
      const errMsg = `Notice: Hermes CLI execution encountered a status error: ${error.message || 'Connection lost'}. Check gateway status or config.yaml.`;

      if (initialTaskAiMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === initialTaskAiMessageId
              ? {
                  ...m,
                  content: errMsg,
                  taskMeta: {
                    ...m.taskMeta!,
                    status: 'ERROR',
                    exitCode: 'STATUS ERROR',
                    realOutput: errMsg,
                  },
                }
              : m
          )
        );
      } else {
        const errorMessage: Message = {
          id: nanoid(),
          role: 'model',
          content: errMsg,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }

      if (activeTaskInstanceId) {
        setTasksQueue((prev) =>
          prev.map((t) =>
            t.id === activeTaskInstanceId
              ? {
                  ...t,
                  isCompleted: true,
                  realOutput: errMsg,
                }
              : t
          )
        );
        if (isVoiceOpen) {
          setActiveTaskId(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  sendQueryRef.current = sendQuery;

  const handleLoopingVoiceTranscript = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (wisprActivationMode === 'hands_free' && wisprExecutionMode === 'manual_approve') {
      soundFx.playWakeWordChime();
      setWisprPendingDictation({
        id: `hands-free-${Date.now()}`,
        timestamp: new Date().toISOString(),
        app: 'Hands-Free Voice',
        formattedText: clean,
        pastedText: clean,
      });
      return;
    }
    void sendQuery(clean);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendQuery(input, false);
  };

  const handleInsertImageGen = () => {
    soundFx.playClick(1100);
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return '/imagine futuristic holographic neon HUD cybernetic schematic with glowing nodes ';
      if (trimmed.startsWith('/imagine ')) return trimmed + ' ';
      return `/imagine ${trimmed} `;
    });
  };

  const quickPrompts = [
    { label: '🛡️ Audit Security', query: 'Perform a quick security audit of current ports and network interface in WSL.' },
    { label: '📡 Hermes Status', query: 'Status report: Check messaging gateway, platform status, and active models.' },
    { label: '💻 Python Port Scanner', query: 'Write a clean multi-threaded Python socket scanner with CLI banner, timeout handling, and formatted output.' },
    { label: '🎨 Generate Cyber HUD Concept', query: 'Generate an SVG visual architecture schematic of the Hermes AI WSL core with glowing cyan nodes and cybernetic layout.' },
    { label: '📊 System Process Matrix', query: 'Display a structured markdown table matrix of active WSL background processes, CPU load, and port sockets.' },
    { label: '⚡ System Diagnostics', query: 'Check current memory, CPU usage, and top running WSL processes.' },
    { label: '🎯 Active Skills', query: 'List your top active cybersecurity and automation skills loaded in this environment.' },
  ];

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center p-4 font-headline bg-background overflow-hidden">
      {/* Corner decorations */}
      <Corner className="absolute top-4 left-4 h-8 w-8 text-primary/50 pointer-events-none" />
      <Corner className="absolute top-4 right-4 h-8 w-8 -scale-x-100 text-primary/50 pointer-events-none" />
      <Corner className="absolute bottom-4 left-4 h-8 w-8 -scale-y-100 text-primary/50 pointer-events-none" />
      <Corner className="absolute bottom-4 right-4 h-8 w-8 scale-x-[-1] scale-y-[-1] text-primary/50 pointer-events-none" />

      {/* Top Header */}
      <div className="absolute top-2.5 left-0 right-0 px-3 sm:px-6 flex items-center justify-between text-primary text-sm z-30 pointer-events-auto">
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={() => {
              soundFx.playClick();
              setMode('hud');
            }}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 sm:px-3 py-1.5 transition-all hover:bg-primary/20 hover:text-accent hover:border-accent hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] shrink-0 cursor-pointer"
            title="Return to HUD Mode"
          >
            <Grid size={14} />
            <span className="text-xs font-bold tracking-widest">HUD MODE</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/20 bg-background/60 text-xs font-mono font-bold text-foreground shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="hidden sm:inline text-primary">HERMES AGENT //</span>
            <span className="text-accent">CHAT</span>
          </div>

          {sessionId && (
            <div className="hidden 2xl:flex items-center gap-1.5 rounded-lg border border-primary/20 bg-background/60 px-2 py-1 text-[11px] font-mono text-muted-foreground shrink-0">
              <span>THREAD:</span>
              <span className="text-accent font-bold truncate max-w-[100px]">{sessionId}</span>
            </div>
          )}

          {/* Live Cybernetic Audio Spectrum Visualizer */}
          <div className="hidden lg:flex items-center shrink-0">
            <AudioSpectrumBar compact intensity={0.4} />
          </div>
        </div>

        {/* Right Action Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 py-0.5">
          {/* Quick J.A.R.V.I.S. Command Palette Launcher */}
          <button
            onClick={() => {
              soundFx.playClick(1000);
              setIsCommandPaletteOpen(true);
            }}
            className="flex items-center gap-1 rounded-lg border border-primary/30 bg-background/60 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-accent hover:border-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)] transition-all shrink-0 cursor-pointer"
            title="Search Commands & Protocols [Ctrl+K]"
          >
            <Search size={13} className="text-primary" />
            <span className="hidden xl:inline text-[11px]">COMMANDS</span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 text-[9px] bg-primary/10 border border-primary/20 rounded text-accent font-bold">
              ⌘K
            </kbd>
          </button>

          {/* Quick Hermes Slash Protocols Matrix Launcher */}
          <button
            onClick={() => {
              soundFx.playClick(1000);
              setIsCommandsDialogOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-accent hover:bg-accent/20 hover:border-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.3)] transition-all shrink-0 cursor-pointer"
            title="Browse all 65+ Hermes Slash Commands & Skills [/]"
          >
            <Zap size={13} className="text-accent animate-pulse" />
            <span className="hidden xl:inline text-[11px] font-bold">PROTOCOLS</span>
            <span className="text-[10px] px-1 py-0.2 bg-accent/20 rounded font-bold font-mono">/</span>
          </button>

          {/* Voice HUD & Ambient Voice Launcher */}
          <button
            onClick={() => {
              soundFx.playClick(1100);
              setIsVoiceOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-primary hover:text-accent hover:bg-primary/20 hover:border-accent hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] transition-all shrink-0 cursor-pointer"
            title="Open Hermes Voice Interaction & Speech HUD [/voice]"
          >
            <Mic size={13} className="text-accent animate-pulse" />
            <span className="hidden xl:inline text-[11px] font-bold">VOICE HUD</span>
          </button>

          {/* God's Eye 3D Satellite & OSINT Launcher */}
          <button
            onClick={() => {
              soundFx.playClick(1100);
              setIsGodsEyeOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-accent hover:bg-accent/25 hover:border-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.35)] transition-all shrink-0 cursor-pointer"
            title="Open God's Eye View 3D Globe & OSINT Satellite Console (~/gods-eye-view)"
          >
            <Globe size={13} className="text-accent animate-spin" style={{ animationDuration: '20s' }} />
            <span className="hidden xl:inline text-[11px] font-bold">GOD&apos;S EYE</span>
          </button>

          {/* Autonomous Setup & Self-Healing Launcher */}
          <button
            onClick={() => {
              soundFx.playClick(1100);
              setIsAutoSetupOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-400 hover:shadow-[0_0_15px_hsl(142_71%_45%/0.35)] transition-all shrink-0 cursor-pointer"
            title="Open Autonomous System Diagnostics & Self-Healing Center"
          >
            <Wrench size={13} className="text-emerald-400 animate-pulse" />
            <span className="hidden xl:inline text-[11px] font-bold">AUTO-SETUP</span>
          </button>

          {/* Windows Host & Kali Linux Multi-Window Launcher */}
          <button
            onClick={() => {
              soundFx.playClick(1100);
              setIsWindowsBridgeOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 sm:px-2.5 py-1.5 text-xs font-mono text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-400 hover:shadow-[0_0_15px_hsl(180_100%_50%/0.35)] transition-all shrink-0 cursor-pointer"
            title="Open Windows Host & Kali Linux Orchestrator [W] / Spawn Kali Shell [K]"
          >
            <Monitor size={13} className="text-cyan-400" />
            <span className="hidden xl:inline text-[11px] font-bold">WIN / KALI</span>
          </button>

          {/* Wispr Flow Windows Dictation Engine */}
          <button
            onClick={() => {
              soundFx.playClick(1100);
              setIsWisprModalOpen(true);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1.5 text-xs font-mono transition-all shrink-0 cursor-pointer",
              isWisprRunning
                ? "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25 hover:shadow-[0_0_15px_hsl(var(--accent)/0.35)]"
                : "border-primary/20 bg-background/60 text-muted-foreground hover:bg-primary/20 hover:text-accent"
            )}
            title="Wispr Flow Windows Dictation Engine [Caps Lock]"
          >
            <Waves size={13} className={isWisprRunning ? "text-accent animate-pulse" : ""} />
            <span className="hidden xl:inline text-[11px] font-bold">WISPR FLOW</span>
          </button>

          <ThemeSwitcher />
          <WslTerminalDrawer />

          <button
            onClick={handleNewSession}
            className="flex items-center gap-1 rounded-lg border border-primary/20 bg-background/60 px-2 sm:px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-primary/20 hover:text-accent hover:border-primary/40 transition-all shrink-0 cursor-pointer"
            title="Start New Hermes Session"
          >
            <PlusCircle size={13} />
            <span className="hidden xl:inline text-[11px]">NEW THREAD</span>
          </button>

          <SystemSettingsModal onOpenConfig={() => setIsConfigOpen(true)} />
          <HermesConfigModal open={isConfigOpen} onOpenChange={setIsConfigOpen} triggerButton={<span className="hidden" />} />
          <HermesDrawer
            onSelectSession={handleSelectSessionInternal}
            onOpenConfig={() => setIsConfigOpen(true)}
          />
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 w-full max-w-4xl flex flex-col items-center justify-center overflow-hidden pt-11 sm:pt-14 pb-1 z-10 min-h-0">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 w-full my-auto">
            {!isVoiceOpen && (
              <LoopingVoiceHUD
                onSendMessage={handleLoopingVoiceTranscript}
                isLoading={isLoading || !!activeRunningTask}
                activeTaskTitle={currentTaskTitle}
                activeProtocol={currentProtocol}
                activationMode={wisprActivationMode}
              />
            )}

            {/* Quick Action Pills */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-2xl px-4 z-20 mt-1 mb-3">
              {quickPrompts.slice(0, 5).map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => sendQuery(qp.query)}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-mono text-primary/90 backdrop-blur-sm transition-all hover:border-accent hover:bg-primary/25 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] cursor-pointer"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
              <div className="flex flex-col gap-6 p-4 max-w-3xl mx-auto">
                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    onExecuteCommand={(cmd) => sendQuery(cmd, true)}
                  />
                ))}
                {isLoading && !messages.some((m) => m.taskMeta?.status === 'RUNNING') && (
                  <ChatMessage message={{ id: 'thinking', role: 'model', content: '' }} />
                )}
              </div>
            </ScrollArea>
            {!isVoiceOpen && (
              <LoopingVoiceHUD
                onSendMessage={handleLoopingVoiceTranscript}
                isLoading={isLoading || !!activeRunningTask}
                activeTaskTitle={currentTaskTitle}
                activeProtocol={currentProtocol}
                activationMode={wisprActivationMode}
                minimal
              />
            )}
          </>
        )}
      </div>

      {/* Input Bar */}
      <div className="w-full max-w-2xl pb-3 sm:pb-5 z-30 shrink-0">
        {/* Popular Slash Commands Bar */}
        <div className="flex items-center justify-center flex-wrap sm:flex-nowrap gap-1.5 pb-1.5 px-1 max-w-full mb-1">
          <span className="text-[10px] font-mono text-primary/80 shrink-0 uppercase tracking-widest font-bold flex items-center gap-1">
            <Zap size={11} className="text-accent" /> CMD:
          </span>
          {[
            { label: '/help', cmd: '/help' },
            { label: '/status', cmd: '/status' },
            { label: '/skills', cmd: '/skills' },
            { label: '/sec-audit', cmd: '/security-audit' },
            { label: '/model', cmd: '/model ' },
            { label: '/imagine', cmd: '/imagine ' },
            { label: '/yolo', cmd: '/yolo' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                soundFx.playClick(900);
                if (item.cmd.endsWith(' ')) {
                  setInput(item.cmd);
                } else {
                  sendQuery(item.cmd);
                }
              }}
              className="px-2 py-0.5 rounded-full border border-primary/25 bg-background/60 hover:bg-primary/20 hover:border-accent hover:text-accent text-[11px] font-mono text-muted-foreground whitespace-nowrap transition-all cursor-pointer"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick(1000);
              setIsCommandsDialogOpen(true);
            }}
            className="px-2.5 py-0.5 rounded-full border border-accent/40 bg-accent/15 hover:bg-accent/30 text-accent text-[11px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0"
            title="Browse all 80+ Hermes Slash Commands & Skills"
          >
            <Layers size={11} />
            <span>ALL 80+</span>
          </button>
        </div>

        {/* Pending Operator Approval Banner for Voice & Wispr Flow Dictation */}
        {wisprPendingDictation && (
          <div className="w-full p-3.5 mb-2 rounded-2xl border-2 border-accent bg-accent/15 backdrop-blur-md shadow-[0_0_30px_hsl(var(--accent)/0.35)] animate-in fade-in slide-in-from-bottom-2 z-20">
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-accent font-bold">
                <Waves size={14} className="animate-pulse" />
                <span>VOICE INPUT // AWAITING YOUR APPROVAL:</span>
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                Press <span className="text-accent font-bold">Enter</span> to Approve &bull; <span className="text-destructive font-bold">Esc</span> to Discard
              </span>
            </div>

            <p className="text-xs sm:text-sm font-sans font-semibold text-foreground mb-2.5 leading-relaxed bg-background/50 p-2.5 rounded-xl border border-accent/20">
              &ldquo;{wisprPendingDictation.formattedText || wisprPendingDictation.pastedText}&rdquo;
            </p>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-accent/20">
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                <span>SOURCE: {wisprPendingDictation.app || (wisprActivationMode === 'hands_free' ? 'KEYLESS VOICE' : 'WISPR FLOW')}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={discardWisprDictation}
                  className="px-2.5 py-1 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/15 text-[10px] font-mono font-bold cursor-pointer transition-all"
                  title="Discard this dictation [Esc]"
                >
                  ✕ DISCARD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick(1000);
                    setInput(wisprPendingDictation.formattedText || wisprPendingDictation.pastedText);
                    discardWisprDictation();
                  }}
                  className="px-2.5 py-1 rounded-lg border border-primary/40 text-primary hover:bg-primary/20 text-[10px] font-mono font-bold cursor-pointer transition-all"
                  title="Edit text in prompt before sending"
                >
                  ✎ EDIT
                </button>
                <button
                  type="button"
                  onClick={() => approveWisprDictation()}
                  className="px-3 py-1 rounded-lg bg-accent text-background hover:bg-accent/80 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer shadow-[0_0_15px_hsl(var(--accent)/0.5)] transition-all"
                  title="Approve and execute immediately [Enter]"
                >
                  <CheckCircle2 size={12} />
                  APPROVE & RUN ⚡
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wispr Flow Policy & Voice Control Strip */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 mb-1.5 rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-md text-[11px] font-mono transition-all">
          {/* Left: Wispr Status & Latest Dictation Snippet */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick(1000);
                setIsWisprModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-accent hover:text-foreground cursor-pointer shrink-0 font-bold"
              title="Open Wispr Flow Settings & Policy Hub"
            >
              <Waves size={13} className={cn("text-accent", isWisprRunning && "animate-pulse")} />
              <span className="hidden sm:inline">WISPR FLOW:</span>
            </button>

            {wisprLastDictation?.formattedText ? (
              <span className="text-foreground/85 truncate italic font-sans text-xs">
                &ldquo;{wisprLastDictation.formattedText}&rdquo;
              </span>
            ) : (
              <span className="text-muted-foreground text-[10px] truncate">
                {wisprActivationMode === 'hands_free'
                  ? 'Keyless Hands-Free Active • Speak freely with zero keys'
                  : `Ready • Press ${wisprPttLabel} on Windows host to dictate`}
              </span>
            )}
          </div>

          {/* Right: Quick Action Controls & Policy Switchers */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* If last dictation text exists and not pending, offer quick Insert */}
            {wisprLastDictation?.formattedText && !wisprPendingDictation && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick(1000);
                  setInput(wisprLastDictation.formattedText);
                }}
                className="px-2 py-0.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-[10px] text-primary font-bold transition-all cursor-pointer hidden md:inline-block"
                title="Insert last dictation into prompt"
              >
                INSERT
              </button>
            )}

            {/* Dispatch Mode Toggle: Manual Approval vs Auto-Execute */}
            <button
              type="button"
              onClick={() => setWisprExecutionMode(wisprExecutionMode === 'auto_execute' ? 'manual_approve' : 'auto_execute')}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1",
                wisprExecutionMode === 'auto_execute'
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_hsl(var(--emerald-500)/0.3)]"
                  : "border-accent/50 bg-accent/15 text-accent"
              )}
              title={wisprExecutionMode === 'auto_execute' ? "Auto-Execute active (zero clicks) - Click to switch to Manual Approval" : "Manual Approval active - Click to switch to Auto-Execute"}
            >
              {wisprExecutionMode === 'auto_execute' ? '⚡ AUTO-USE' : '✓ APPROVE'}
            </button>

            {/* Activation Mode Toggle: Keyless Hands-Free vs Caps Lock PTT */}
            <button
              type="button"
              onClick={() => setWisprActivationMode(wisprActivationMode === 'hands_free' ? 'key_ptt' : 'hands_free')}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1",
                wisprActivationMode === 'hands_free'
                  ? "border-sky-400/60 bg-sky-500/25 text-sky-300 shadow-[0_0_10px_hsl(var(--sky-400)/0.4)] animate-pulse"
                  : "border-primary/40 bg-primary/10 text-muted-foreground hover:text-foreground"
              )}
              title={wisprActivationMode === 'hands_free' ? `Keyless Hands-Free active - Click to switch to ${wisprPttLabel}` : `${wisprPttLabel} PTT active - Click to switch to Keyless Hands-Free`}
            >
              {wisprActivationMode === 'hands_free' ? '🎙️ KEYLESS' : `⌨️ ${wisprPttLabel.toUpperCase()}`}
            </button>

            {/* Open Settings Modal */}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick(1000);
                setIsWisprModalOpen(true);
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all cursor-pointer"
              title="Wispr Flow Voice Policy Settings"
            >
              <SlidersHorizontal size={12} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative w-full">
          {/* Autocomplete Popover */}
          <SlashCommandAutocomplete
            isOpen={isSlashAutocompleteOpen}
            query={slashQuery}
            selectedIndex={slashSelectedIndex}
            onSelect={handleSelectCommandFromAutocomplete}
            onClose={() => setInput('')}
          />

          <div className="relative rounded-full border border-primary/30 bg-background/60 backdrop-blur-md shadow-[0_0_20px_hsl(var(--primary)/0.15)] transition-all focus-within:border-accent focus-within:shadow-[0_0_25px_hsl(var(--primary)/0.3)]">
            {photoPreview && (
              <div className="absolute bottom-16 left-4">
                <div className="relative h-20 w-20 rounded-md border border-primary/30 p-1 bg-background/70">
                  <Image src={photoPreview} alt="Preview" fill className="rounded object-cover" />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveImage}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>
            )}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isLoading ? "Hermes is processing query via WSL..." : "Command Hermes Agent (type / for commands, or ask anything)..."}
              className="h-12 w-full rounded-full border-none bg-transparent pr-28 pl-[160px] text-sm font-sans focus-visible:ring-0 placeholder:text-muted-foreground/70"
              disabled={isLoading}
            />
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {/* Attach Image / File */}
            <Button
              type="button"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-transparent text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_15px_hsl(var(--primary))]"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Attach File/Image"
            >
              <Paperclip size={16} />
            </Button>

            {/* AI Image Generation Trigger */}
            <Button
              type="button"
              size="icon"
              className="absolute left-11 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-accent/40 bg-transparent text-accent transition-all duration-300 hover:bg-accent/25 hover:text-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.3)]"
              onClick={handleInsertImageGen}
              disabled={isLoading}
              title="Generate Visual Artifact [/imagine]"
            >
              <ImageIcon size={15} />
            </Button>

            {/* Hermes Commands Catalog Trigger */}
            <Button
              type="button"
              size="icon"
              className="absolute left-20 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-transparent text-primary transition-all duration-300 hover:bg-primary/20 hover:text-accent hover:border-accent hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
              onClick={() => {
                soundFx.playClick(1000);
                setIsCommandsDialogOpen(true);
              }}
              disabled={isLoading}
              title="Browse All 65+ Hermes Slash Commands & Skills [⚡]"
            >
              <Zap size={14} className="text-accent" />
            </Button>

            {/* Wispr Flow Dictation Trigger */}
            <Button
              type="button"
              size="icon"
              className={cn(
                "absolute left-[116px] top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-accent/40 bg-transparent text-accent transition-all duration-300 hover:bg-accent/20 hover:text-accent hover:border-accent hover:shadow-[0_0_15px_hsl(var(--accent)/0.3)]",
                isWisprRunning && "border-accent text-accent"
              )}
              onClick={() => {
                soundFx.playClick(1000);
                setIsWisprModalOpen(true);
              }}
              disabled={isLoading}
              title={`Wispr Flow Windows Engine [${wisprPttLabel}]`}
            >
              <Waves size={15} className={isWisprRunning ? "animate-pulse" : ""} />
            </Button>

            <Button
              type="button"
              size="icon"
              className={cn(
                "absolute right-12 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-transparent text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground",
                isRecordingInput && "border-destructive text-destructive bg-destructive/20 animate-pulse shadow-[0_0_15px_hsl(var(--destructive))]",
                isTranscribing && "border-accent text-accent bg-accent/20 animate-pulse shadow-[0_0_15px_hsl(var(--accent))]"
              )}
              onClick={handleToggleBarMic}
              disabled={isLoading || isTranscribing}
              title={
                isTranscribing
                  ? "Transcribing audio via Sarvam Saaras AI..."
                  : isRecordingInput
                  ? "Stop speech recording (Sarvam STT)"
                  : "Speak to Hermes (Sarvam AI STT)"
              }
            >
              {isTranscribing ? (
                <Sparkles size={16} className="animate-spin text-accent" />
              ) : isRecordingInput ? (
                <MicOff size={16} />
              ) : (
                <Mic size={16} />
              )}
            </Button>

            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-primary/40 bg-transparent text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_15px_hsl(var(--primary))]"
              disabled={isLoading || (!input.trim() && !photoDataUri)}
            >
              <Send size={16} />
            </Button>
          </div>
        </form>
      </div>

      {/* Marvel J.A.R.V.I.S. Smart Task Execution & Debrief Screen */}
      <JarvisExecutionScreen
        isOpen={!!activeTask && !isVoiceOpen}
        taskTitle={activeTask?.title || 'Hermes Neural Inference'}
        protocolName={activeTask?.protocol || 'STARK PROTOCOL // AGENT CORE'}
        command={activeTask?.command}
        isCompleted={activeTask?.isCompleted || false}
        realOutput={activeTask?.realOutput}
        sessionId={activeTask?.sessionId || sessionId}
        onClose={() => setActiveTaskId(null)}
        onAbort={() => {
          soundFx.playJarvisAlert();
          if (activeTaskId) {
            setTasksQueue((prev) => prev.filter((t) => t.id !== activeTaskId));
          }
          setActiveTaskId(null);
          setIsLoading(false);
          toast({
            title: "Protocol Aborted",
            description: "Task execution halted by operator override.",
            variant: "destructive",
          });
        }}
      />

      {/* Marvel J.A.R.V.I.S. Stacked Multi-Task Background PiP Dock */}
      {tasksQueue.length > 0 && !activeTaskId && (
        <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-2 font-mono">
          {/* Expandable Stacked Task Tray */}
          {isPipDockExpanded && (
            <div className="w-80 max-w-[90vw] max-h-72 overflow-y-auto rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-2xl p-3 shadow-[0_0_40px_hsl(var(--primary)/0.35)] space-y-2 hermes-scrollbar animate-fade-in">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-accent">
                  <Zap size={13} className="text-accent animate-pulse" />
                  <span>BACKGROUND TASK MATRIX</span>
                </div>
                <button
                  onClick={() => {
                    soundFx.playClick(900);
                    setTasksQueue((prev) => prev.filter((t) => !t.isCompleted));
                  }}
                  className="text-[10px] text-muted-foreground hover:text-accent cursor-pointer"
                  title="Clear completed tasks"
                >
                  CLEAR DONE
                </button>
              </div>

              <div className="space-y-1.5">
                {tasksQueue.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all flex flex-col gap-1.5",
                      t.isCompleted
                        ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                        : "border-primary/30 bg-primary/10 text-primary"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase tracking-wider opacity-70 block truncate">
                          {t.protocol}
                        </span>
                        <h5 className="text-[11px] font-bold text-foreground truncate">{t.title}</h5>
                      </div>
                      <span
                        className={cn(
                          "text-[8px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0",
                          t.isCompleted
                            ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                            : "border border-accent/40 bg-accent/20 text-accent animate-pulse"
                        )}
                      >
                        {t.isCompleted ? "SUCCESS" : "RUNNING"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-primary/10 text-[10px]">
                      <span className="text-muted-foreground">
                        {t.isCompleted ? "Completed" : "Active Flow"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            soundFx.playClick(1000);
                            setActiveTaskId(t.id);
                          }}
                          className="text-accent hover:underline font-bold cursor-pointer"
                          title="Open full execution screen"
                        >
                          ↗ VIEW
                        </button>
                        <button
                          onClick={() => {
                            soundFx.playClick(900);
                            setTasksQueue((prev) => prev.filter((item) => item.id !== t.id));
                          }}
                          className="text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                          title="Dismiss task"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Floating Dock Main Pill Button */}
          <button
            onClick={() => {
              soundFx.playClick(1000);
              setIsPipDockExpanded((prev) => !prev);
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-xl text-primary shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:border-accent hover:text-accent transition-all cursor-pointer text-xs font-bold"
            title="Toggle Background Task Matrix"
          >
            <div className="relative">
              <Activity size={15} className="text-accent animate-pulse" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent animate-ping" />
            </div>
            <span>
              {tasksQueue.filter((t) => !t.isCompleted).length > 0
                ? `${tasksQueue.filter((t) => !t.isCompleted).length} TASKS RUNNING`
                : `${tasksQueue.length} TASKS LOGGED`}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-accent">
              {isPipDockExpanded ? "▼ DOCK" : "▲ TRAY"}
            </span>
          </button>
        </div>
      )}

      {/* Voice HUD Dialog */}
      <Dialog open={isVoiceOpen} onOpenChange={setIsVoiceOpen}>
        <DialogContent className="flex h-auto w-auto max-w-none items-center justify-center border-none bg-transparent p-0 shadow-none focus-visible:ring-0">
          <DialogTitle className="sr-only">Voice Mode</DialogTitle>
          <DialogDescription className="sr-only">
            Voice interaction mode for Hermes Agent has been activated.
          </DialogDescription>
          {isVoiceOpen && (
            <VoiceHUD
              closeDialog={() => setIsVoiceOpen(false)}
              onOpenChatWithSession={(sid) => {
                if (sid) handleSelectSessionInternal(sid);
              }}
              isLoading={isLoading || !!activeRunningTask}
              activeTaskTitle={currentTaskTitle}
              activeProtocol={currentProtocol}
              onSendMessage={sendQuery}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Marvel J.A.R.V.I.S. Command & Protocol Palette [Ctrl+K] */}
      <JarvisCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setMode={setMode}
        onRunProtocol={(title, protocol, query) => {
          sendQuery(query || title, true);
        }}
        onBoost={() => {
          sendQuery('REACTOR OVERCLOCK: Flush memory cache buffers and surge clock in WSL.', true);
        }}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenTerminal={() => {
          const btn = document.querySelector('button[title*="Terminal"]') as HTMLButtonElement | null;
          if (btn) btn.click();
        }}
        onOpenSettings={() => {
          const btn = document.querySelector('button[title*="Settings"]') as HTMLButtonElement | null;
          if (btn) btn.click();
        }}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* Hermes All Commands Catalog Dialog */}
      <HermesCommandsDialog
        isOpen={isCommandsDialogOpen}
        onClose={() => setIsCommandsDialogOpen(false)}
        onSelectCommand={(cmdStr, executeNow) => {
          if (executeNow) {
            sendQuery(cmdStr, true);
          } else {
            setInput(cmdStr);
          }
        }}
      />

      {/* God's Eye View 3D OSINT Console Modal */}
      <GodsEyeModal
        isOpen={isGodsEyeOpen}
        onClose={() => {
          setIsGodsEyeOpen(false);
          setGodsEyeLocation(null);
          setGodsEyeTarget(undefined);
        }}
        initialLocation={godsEyeLocation}
        targetQuery={godsEyeTarget}
      />
      {/* Autonomous System Diagnostics & Self-Healing Modal */}
      <AutoSetupModal
        isOpen={isAutoSetupOpen}
        onClose={() => setIsAutoSetupOpen(false)}
      />

      {/* Windows Host & Kali Linux Multi-Window Orchestrator */}
      <WindowsKaliBridgeModal
        isOpen={isWindowsBridgeOpen}
        onOpenChange={setIsWindowsBridgeOpen}
        onTriggerAutoSetup={() => setIsAutoSetupOpen(true)}
      />

      {/* Wispr Flow Windows Engine Modal */}
      <WisprFlowModal
        isOpen={isWisprModalOpen}
        onClose={() => setIsWisprModalOpen(false)}
        onSelectPrompt={(promptText, autoExec) => {
          if (autoExec) {
            sendQuery(promptText);
          } else {
            setInput(promptText);
          }
        }}
      />
    </div>
  );
};

export default ChatMode;
