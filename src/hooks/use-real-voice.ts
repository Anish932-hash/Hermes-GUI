'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { soundFx } from '@/lib/audio-synth';
import {
  synthesizeSarvamSpeech,
  playSarvamAudio,
  stopSarvamAudio,
  transcribeSarvamAudio,
} from '@/lib/sarvam';
import { extractGodsEyeTarget } from '@/lib/godseye';

export type VoiceMode = 'manual' | 'auto';
export type VoiceStatus = 'idle' | 'monitoring' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface UseRealVoiceOptions {
  sessionId?: string;
  onQueryComplete?: (query: string, response: string, sessionId?: string) => void;
  onTranscriptReady?: (transcript: string) => void;
  skipApiQuery?: boolean;
  autoSpeakResponse?: boolean;
  initialMode?: VoiceMode;
  wakeWord?: string;
  continuousDictation?: boolean;
}

// Check if running inside Electron desktop container
export const isElectronEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    navigator.userAgent.includes('Electron') ||
    !!(window as any).process?.versions?.electron ||
    !!(window as any).electron
  );
};

// Phonetically tolerant regex matching for "Hermes" and "Jarvis" + STT variations
const WAKE_WORD_REGEX =
  /\b(hermes|her mes|her mess|hermis|hermas|harmes|hermez|helmes|hermies|ermes|harness|jarvis|jarviz|javice|jarviss|hey hermes|hi hermes|ok hermes|hello hermes|hey jarvis|hi jarvis|ok jarvis|hello jarvis|हर्मिस|हर्मेस|जार्विस)\b/i;

const WAKE_WORD_TOKENS = new Set([
  'hermes',
  'hermis',
  'hermas',
  'hermez',
  'harmes',
  'helmes',
  'hermies',
  'ermes',
  'harness',
  'jarvis',
  'jarviz',
  'javice',
  'jarviss',
  'हर्मिस',
  'हर्मेस',
  'जार्विस',
]);

export function parseWakeWord(rawText: string): { matched: boolean; commandAfterWake: string } {
  if (!rawText) return { matched: false, commandAfterWake: '' };

  const normalized = rawText
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(' ');
  const wakeIndex = ['hey', 'hi', 'ok', 'hello'].includes(words[0]) ? 1 : 0;
  const prefix = words.slice(0, wakeIndex + 1).join(' ');
  if (WAKE_WORD_REGEX.test(prefix) || WAKE_WORD_TOKENS.has(words[wakeIndex])) {
    return { matched: true, commandAfterWake: words.slice(wakeIndex + 1).join(' ').trim() };
  }

  return { matched: false, commandAfterWake: '' };
}

function splitSpeechText(text: string, maxLength = 2300): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxLength) {
      if (current) chunks.push(current);
      current = '';
      for (let offset = 0; offset < word.length; offset += maxLength) {
        chunks.push(word.slice(offset, offset + maxLength));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function useRealVoice(options: UseRealVoiceOptions = {}) {
  const {
    sessionId,
    onQueryComplete,
    onTranscriptReady,
    skipApiQuery = false,
    autoSpeakResponse = true,
    initialMode = 'auto',
    wakeWord = 'Hermes',
    continuousDictation = false,
  } = options;

  const [mode, setModeState] = useState<VoiceMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hermes_voice_mode') as VoiceMode;
      if (saved === 'manual' || saved === 'auto') return saved;
    }
    return initialMode;
  });

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 1
  const [frequencyBars, setFrequencyBars] = useState<number[]>(() => new Array(24).fill(4));
  const [inputDb, setInputDb] = useState<string>('-54.0');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);

  // References to manage state and async lifecycles
  const recognitionRef = useRef<any>(null);
  const isRecognitionRunningRef = useRef(false);
  const isStoppingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingAudioRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const lastSpokenTimestampRef = useRef(0);

  const vadClipRecorderRef = useRef<MediaRecorder | null>(null);
  const vadClipChunksRef = useRef<Blob[]>([]);
  const isVadClipRecordingRef = useRef(false);
  const vadMonitoringStartRef = useRef(0);
  const vadMonitoringLastSpeechRef = useRef(0);
  const isVadProcessingRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const synthWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const awokenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const vadClipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeTranscriptRef = useRef('');
  const modeRef = useRef<VoiceMode>(mode);
  const statusRef = useRef<VoiceStatus>(status);
  const continuousDictationRef = useRef(continuousDictation);
  continuousDictationRef.current = continuousDictation;
  const isAwokenRef = useRef(false);
  const isProcessingRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const unmountedRef = useRef(false);
  const retryCountRef = useRef(0);
  const voiceRequestIdRef = useRef(0);
  const voiceRequestAbortRef = useRef<AbortController | null>(null);
  const speechRunIdRef = useRef(0);

  const startMonitoringRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  const startVadClipRecordingRef = useRef<() => void>(() => {});
  const stopVadClipRecordingRef = useRef<() => void>(() => {});
  const sendVoiceQueryRef = useRef<(q: string) => Promise<void>>(async () => {});

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Support check: Supported in both browser (Web Speech) and Electron (MediaDevices / MediaRecorder + Sarvam STT)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasSpeech = !!(
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      );
      setIsSupported((hasMedia && typeof MediaRecorder !== 'undefined') || hasSpeech);
    }
  }, []);

  // Ambient VAD wake-word recorder functions (for Electron / standalone Windows without Web Speech API)
  const stopVadClipRecording = useCallback(() => {
    if (vadClipRecorderRef.current && vadClipRecorderRef.current.state === 'recording') {
      try {
        vadClipRecorderRef.current.stop();
      } catch {}
    }
  }, []);

  const cancelVadClipRecording = useCallback(() => {
    if (vadClipRecorderRef.current && vadClipRecorderRef.current.state === 'recording') {
      try {
        vadClipRecorderRef.current.onstop = null;
        vadClipRecorderRef.current.stop();
      } catch {}
    }
    vadClipRecorderRef.current = null;
    isVadClipRecordingRef.current = false;
    vadClipChunksRef.current = [];
    vadMonitoringStartRef.current = 0;
    vadMonitoringLastSpeechRef.current = 0;
  }, []);

  const startVadClipRecording = useCallback(() => {
    if (isVadClipRecordingRef.current || isVadProcessingRef.current || !mediaStreamRef.current) return;
    try {
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }
      const recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, { mimeType })
        : new MediaRecorder(mediaStreamRef.current);

      vadClipChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          vadClipChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (vadClipTimeoutRef.current) {
          clearTimeout(vadClipTimeoutRef.current);
          vadClipTimeoutRef.current = null;
        }
        isVadClipRecordingRef.current = false;
        const chunks = vadClipChunksRef.current;
        vadClipChunksRef.current = [];
        vadMonitoringStartRef.current = 0;
        vadMonitoringLastSpeechRef.current = 0;

        if (chunks.length === 0 || statusRef.current !== 'monitoring') return;

        const cleanType = (recorder.mimeType || 'audio/webm').split(';')[0].trim();
        const clipBlob = new Blob(chunks, { type: cleanType });
        if (clipBlob.size < 120) return;

        isVadProcessingRef.current = true;
        try {
          const recognized = await transcribeSarvamAudio(clipBlob);
          const clean = (recognized || '').trim();
          const { matched, commandAfterWake } = parseWakeWord(clean);

          if (matched) {
            // Wake-word detected!
            isAwokenRef.current = true;
            setIsWakeWordDetected(true);
            soundFx.playWakeWordChime();

            if (wakeWordTimeoutRef.current) clearTimeout(wakeWordTimeoutRef.current);
            wakeWordTimeoutRef.current = setTimeout(() => {
              setIsWakeWordDetected(false);
            }, 3000);

            if (commandAfterWake.length > 2) {
              activeTranscriptRef.current = commandAfterWake;
              setTranscript(commandAfterWake);
              sendVoiceQueryRef.current(commandAfterWake);
            } else {
              // User only said "Hermes" or "Jarvis": immediately transition to listening mode to capture the command!
              startListeningRef.current();
            }
          } else if (continuousDictationRef.current && clean.length > 1) {
            // Keyless dictation does not require a wake word. The VAD clip is
            // already bounded by a short silence before it reaches this point.
            activeTranscriptRef.current = clean;
            setTranscript(clean);
            sendVoiceQueryRef.current(clean);
          }
        } catch (err) {
          console.warn('Ambient VAD wake-word check notice:', err);
        } finally {
          isVadProcessingRef.current = false;
        }
      };

      vadClipRecorderRef.current = recorder;
      recorder.start(100);
      isVadClipRecordingRef.current = true;
      if (vadClipTimeoutRef.current) clearTimeout(vadClipTimeoutRef.current);
      vadClipTimeoutRef.current = setTimeout(() => stopVadClipRecordingRef.current(), 25000);
    } catch (err) {
      console.warn('Failed to start ambient VAD recorder:', err);
    }
  }, []);

  startVadClipRecordingRef.current = startVadClipRecording;
  stopVadClipRecordingRef.current = stopVadClipRecording;

  // Web Audio visualizer & Voice Activity Detection (VAD) loop (completely independent and non-blocking)
  const startAudioAnalysis = useCallback(async (): Promise<MediaStream | null> => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setError('Microphone requires a secure origin (http://127.0.0.1:3001 or localhost). Please load via http://127.0.0.1:3001');
        } else {
          setError('Microphone API not supported by browser environment.');
        }
        return null;
      }
      if (mediaStreamRef.current) return mediaStreamRef.current; // Already analyzing

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (optErr) {
        console.warn('Advanced audio constraints not supported by device, trying default audio:', optErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (basicErr: any) {
          console.warn('Microphone access failed:', basicErr);
          const name = basicErr?.name || '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setError('Microphone access blocked. Check site permissions in browser address bar (lock icon) or Windows Settings.');
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setError('No microphone found. Please connect or enable an audio input device in Windows Sound settings.');
          } else if (name === 'NotReadableError' || name === 'TrackStartError') {
            setError('Microphone is busy or locked by another application. Please close apps using the microphone.');
          } else {
            setError(`Microphone unavailable: ${basicErr?.message || 'Access denied or device error'}`);
          }
          return null;
        }
      }
      if (unmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          void audioCtx.resume().catch(() => {});
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!analyserRef.current || unmountedRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          let peakVal = 0;
          const bars: number[] = [];
          const step = Math.max(1, Math.floor(dataArray.length / 24));

          for (let i = 0; i < 24; i++) {
            const val = dataArray[i * step] || 0;
            if (val > peakVal) peakVal = val;
            bars.push(Math.max(4, Math.round((val / 255) * 100)));
          }

          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }

          const avg = sum / dataArray.length / 255;
          const active = avg > 0.012 || peakVal > 14;
          const db =
            avg > 0.002 ? Math.max(-54, Math.min(-0.5, 20 * Math.log10(avg * 2.2))) : -54;

          setAudioLevel(avg);
          setFrequencyBars(bars);
          setInputDb(db.toFixed(1));
          setIsVoiceActive(active);

          const now = Date.now();

          // 1. Manual or Active Listening VAD: Automatically stop listening after 1.4s of silence
          if (statusRef.current === 'listening') {
            if (active) {
              if (!speechStartTimeRef.current) {
                speechStartTimeRef.current = now;
              }
              hasSpokenRef.current = true;
              lastSpokenTimestampRef.current = now;
              if (listeningTimeoutRef.current) {
                clearTimeout(listeningTimeoutRef.current);
                listeningTimeoutRef.current = null;
              }
            } else if (hasSpokenRef.current && lastSpokenTimestampRef.current > 0) {
              const spokeDuration = lastSpokenTimestampRef.current - speechStartTimeRef.current;
              const silenceDuration = now - lastSpokenTimestampRef.current;
              if (
                spokeDuration > 250 &&
                silenceDuration >= 1400 &&
                !isStoppingRef.current &&
                !hasSubmittedRef.current
              ) {
                hasSpokenRef.current = false;
                lastSpokenTimestampRef.current = 0;
                speechStartTimeRef.current = 0;
                stopListeningRef.current();
              }
            }
          }

          // 2. Electron / Ambient Auto-Mode VAD: Detect speech onset and capture ambient wake-word clip
          if (statusRef.current === 'monitoring' && !isRecognitionRunningRef.current) {
            if (active) {
              if (!vadMonitoringStartRef.current) {
                vadMonitoringStartRef.current = now;
              }
              vadMonitoringLastSpeechRef.current = now;
              if (!isVadClipRecordingRef.current && !isVadProcessingRef.current) {
                startVadClipRecordingRef.current();
              }
            } else if (isVadClipRecordingRef.current && vadMonitoringLastSpeechRef.current > 0) {
              const silenceDuration = now - vadMonitoringLastSpeechRef.current;
              const totalClipDuration = now - vadMonitoringStartRef.current;
              if (silenceDuration >= 600 || totalClipDuration >= 4000) {
                stopVadClipRecordingRef.current();
              }
            }
          }

          animationFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      }
      return stream;
    } catch (err: any) {
      console.warn('Microphone stream error:', err);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone access blocked. Enable microphone permissions in Windows Settings > Privacy.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect or enable an audio input device in Windows Sound settings.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('Microphone is busy or locked by another application. Please close apps using the microphone.');
      } else {
        setError(`Microphone unavailable: ${err?.message || 'Access denied or device error'}`);
      }
      return null;
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    cancelVadClipRecording();
    hasSpokenRef.current = false;
    speechStartTimeRef.current = 0;
    lastSpokenTimestampRef.current = 0;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setFrequencyBars(new Array(24).fill(4));
    setInputDb('-54.0');
    setIsVoiceActive(false);
  }, [cancelVadClipRecording]);

  // Safe SpeechRecognition cleanup helper
  const safelyDestroyRecognition = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      cancelVadClipRecording();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      mediaRecorderRef.current = null;

      const rec = recognitionRef.current;
      if (!rec) {
        resolve();
        return;
      }
      isStoppingRef.current = true;
      try {
        rec.onstart = null;
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.abort();
      } catch {}
      recognitionRef.current = null;
      isRecognitionRunningRef.current = false;
      setTimeout(() => {
        isStoppingRef.current = false;
        resolve();
      }, 100);
    });
  }, []);

  // SpeechSynthesis talk-back function with Sarvam Neural TTS + Web Speech fallback
  const speakText = useCallback(
    (textToSpeak: string, onEnd?: () => void) => {
      if (typeof window === 'undefined') {
        if (onEnd) onEnd();
        return;
      }

      const runId = ++speechRunIdRef.current;
      if (synthWatchdogRef.current) clearTimeout(synthWatchdogRef.current);
      stopSarvamAudio();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const cleanText = textToSpeak.replace(/[*_#`[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
      const chunks = splitSpeechText(cleanText);
      let chunkIndex = 0;

      let hasFinished = false;
      const isCurrentRun = () => speechRunIdRef.current === runId && !unmountedRef.current;
      const finishSpeech = () => {
        if (hasFinished || !isCurrentRun()) return;
        hasFinished = true;
        soundFx.stopSpeechTelemetry();
        stopSarvamAudio();
        if (synthWatchdogRef.current) {
          clearTimeout(synthWatchdogRef.current);
          synthWatchdogRef.current = null;
        }
        delete (window as any).__hermesActiveUtterance;
        isProcessingRef.current = false;

        if (onEnd) {
          onEnd();
        } else {
          if (modeRef.current === 'auto') {
            setTimeout(() => {
              if (modeRef.current === 'auto' && !unmountedRef.current) {
                startMonitoringRef.current();
              }
            }, 600);
          } else {
            setStatus('idle');
          }
        }
      };

      const playNextChunk = async () => {
        if (!isCurrentRun() || hasFinished) return;
        if (chunkIndex >= chunks.length) {
          finishSpeech();
          return;
        }

        const chunk = chunks[chunkIndex++];
        let chunkFinished = false;
        const finishChunk = () => {
          if (chunkFinished || !isCurrentRun()) return;
          chunkFinished = true;
          if (synthWatchdogRef.current) {
            clearTimeout(synthWatchdogRef.current);
            synthWatchdogRef.current = null;
          }
          void playNextChunk();
        };

        try {
          const { audioUrl } = await synthesizeSarvamSpeech(chunk);
          if (!isCurrentRun()) return;
          setStatus('speaking');
          soundFx.startSpeechTelemetry();
          playSarvamAudio(audioUrl, finishChunk);
          synthWatchdogRef.current = setTimeout(() => {
            stopSarvamAudio();
            finishChunk();
          }, Math.max(12000, chunk.length * 180 + 8000));
        } catch {
          if (!isCurrentRun()) return;
          if (!('speechSynthesis' in window)) {
            finishChunk();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(chunk);
          (window as any).__hermesActiveUtterance = utterance;
          const voices = window.speechSynthesis.getVoices();
          const preferred = voices.find(
            (voice) =>
              voice.lang.startsWith('en') &&
              (voice.name.includes('Natural') || voice.name.includes('Google') ||
                voice.name.includes('Daniel') || voice.name.includes('Samantha') || voice.name.includes('Guy'))
          );
          if (preferred) utterance.voice = preferred;
          utterance.rate = 1.05;
          utterance.pitch = 0.95;
          utterance.onend = finishChunk;
          utterance.onerror = finishChunk;
          synthWatchdogRef.current = setTimeout(
            finishChunk,
            Math.max(3500, chunk.length * 100 + 5000)
          );
          setStatus('speaking');
          soundFx.startSpeechTelemetry();
          try {
            window.speechSynthesis.speak(utterance);
          } catch {
            finishChunk();
          }
        }
      };

      if (!chunks.length) {
        finishSpeech();
      } else {
        void playNextChunk();
      }
    },
    []
  );

  // Send voice query to Hermes in WSL
  const sendVoiceQuery = useCallback(
    async (queryText: string) => {
      const parsedWakeWord = parseWakeWord(queryText);
      const cleanQuery = (parsedWakeWord.matched ? parsedWakeWord.commandAfterWake : queryText).trim();
      if (!cleanQuery) {
        isProcessingRef.current = false;
        hasSubmittedRef.current = false;
        stopAudioAnalysis();
        if (modeRef.current === 'auto') {
          startMonitoringRef.current();
        } else {
          setStatus('idle');
        }
        return;
      }

      // If consumer only wants recognized transcript directly (e.g. Chat Mode)
      if (skipApiQuery && onTranscriptReady) {
        if (isProcessingRef.current) return;
        const requestId = ++voiceRequestIdRef.current;
        isProcessingRef.current = true;
        soundFx.playClick(880);
        await safelyDestroyRecognition();
        stopAudioAnalysis();
        if (requestId !== voiceRequestIdRef.current || unmountedRef.current) return;
        onTranscriptReady(cleanQuery);
        isProcessingRef.current = false;
        hasSubmittedRef.current = false;
        setStatus('idle');
        if (modeRef.current === 'auto') {
          setTimeout(() => {
            if (modeRef.current === 'auto' && !unmountedRef.current && requestId === voiceRequestIdRef.current) {
              startMonitoringRef.current();
            }
          }, 500);
        }
        return;
      }

      if (isProcessingRef.current) return;
      const requestId = ++voiceRequestIdRef.current;
      const requestAbort = new AbortController();
      voiceRequestAbortRef.current?.abort();
      voiceRequestAbortRef.current = requestAbort;
      isProcessingRef.current = true;
      setStatus('thinking');
      soundFx.playClick(880);

      // Instantly trigger God's Eye if voice query contains location/reconnaissance intent
      const godsEyeTarget = extractGodsEyeTarget(cleanQuery);
      if (godsEyeTarget !== null && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hermes:open-godseye', {
            detail: godsEyeTarget ? { query: godsEyeTarget } : {},
          })
        );
      }

      // Cleanly shutdown recognition and audio analysis before inference
      await safelyDestroyRecognition();
      stopAudioAnalysis();
      if (requestId !== voiceRequestIdRef.current || unmountedRef.current) return;

      // Thinking Watchdog: Never let inference stay hung forever
      if (thinkingWatchdogRef.current) clearTimeout(thinkingWatchdogRef.current);
      thinkingWatchdogRef.current = setTimeout(() => {
        if (requestId === voiceRequestIdRef.current && statusRef.current === 'thinking') {
          requestAbort.abort();
          voiceRequestAbortRef.current = null;
          isProcessingRef.current = false;
          hasSubmittedRef.current = false;
          setError('Inference timed out in WSL. Resetting voice state.');
          setStatus('idle');
        }
      }, 80000);

      try {
        const res = await fetch('/api/hermes/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanQuery,
            sessionId,
          }),
          signal: requestAbort.signal,
        });

        if (requestId !== voiceRequestIdRef.current || unmountedRef.current) return;

        if (thinkingWatchdogRef.current) {
          clearTimeout(thinkingWatchdogRef.current);
          thinkingWatchdogRef.current = null;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const data = await res.json();
        if (requestId !== voiceRequestIdRef.current || unmountedRef.current) return;
        voiceRequestAbortRef.current = null;
        const aiAnswer = data.content || 'Hermes completed the command.';

        // Parse any ```godseye telemetry block from assistant and fly to target
        if (aiAnswer.includes('```godseye') && typeof window !== 'undefined') {
          const match = aiAnswer.match(/```godseye\s*([\s\S]*?)```/);
          if (match) {
            try {
              const payload = JSON.parse(match[1]);
              if (payload && Number.isFinite(Number(payload.lat)) && Number.isFinite(Number(payload.lon))) {
                window.dispatchEvent(new CustomEvent('hermes:open-godseye', { detail: { target: payload } }));
              }
            } catch {}
          }
        }

        setResponse(aiAnswer);
        soundFx.playMessagePing();

        if (onQueryComplete) {
          onQueryComplete(cleanQuery, aiAnswer, data.sessionId || sessionId);
        }

        if (autoSpeakResponse) {
          speakText(aiAnswer);
        } else {
          isProcessingRef.current = false;
          hasSubmittedRef.current = false;
          if (modeRef.current === 'auto') {
            setTimeout(() => {
              if (modeRef.current === 'auto' && !unmountedRef.current) {
                startMonitoringRef.current();
              }
            }, 800);
          } else {
            setStatus('idle');
          }
        }
      } catch (err: any) {
        if (requestId !== voiceRequestIdRef.current || err?.name === 'AbortError' || unmountedRef.current) return;
        console.error('Hermes Voice Query Error:', err);
        voiceRequestAbortRef.current = null;
        if (thinkingWatchdogRef.current) {
          clearTimeout(thinkingWatchdogRef.current);
          thinkingWatchdogRef.current = null;
        }
        const errMsg = `Notice: Unable to execute query with Hermes in WSL (${err.message}).`;
        setResponse(errMsg);
        setError(err.message);
        isProcessingRef.current = false;
        hasSubmittedRef.current = false;

        if (modeRef.current === 'auto') {
          setTimeout(() => {
            if (modeRef.current === 'auto' && !unmountedRef.current) {
              startMonitoringRef.current();
            }
          }, 1500);
        } else {
          setStatus('idle');
        }
      }
    },
    [sessionId, skipApiQuery, onTranscriptReady, autoSpeakResponse, speakText, onQueryComplete, safelyDestroyRecognition, stopAudioAnalysis]
  );

  sendVoiceQueryRef.current = sendVoiceQuery;

  // Stop listening manually (flush MediaRecorder and trigger transcription/query)
  const stopListening = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    hasSpokenRef.current = false;
    speechStartTimeRef.current = 0;
    lastSpokenTimestampRef.current = 0;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    } else {
      stopAudioAnalysis();
      if (activeTranscriptRef.current && !hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        sendVoiceQuery(activeTranscriptRef.current);
      } else if (!activeTranscriptRef.current) {
        if (modeRef.current === 'auto') {
          setTimeout(() => {
            if (modeRef.current === 'auto' && !unmountedRef.current) {
              startMonitoringRef.current();
            }
          }, 400);
        } else {
          setStatus('idle');
        }
      }
    }
  }, [sendVoiceQuery, stopAudioAnalysis]);

  stopListeningRef.current = stopListening;

  // Continuous ambient monitoring for Wake-Word "Hermes" (Automatic Mode)
  const startMonitoring = useCallback(async () => {
    if (typeof window === 'undefined' || unmountedRef.current) return;

    // Don't start monitoring if currently speaking or thinking
    if (
      isProcessingRef.current ||
      statusRef.current === 'thinking' ||
      statusRef.current === 'speaking'
    ) {
      return;
    }

    await safelyDestroyRecognition();

    isProcessingRef.current = false;
    hasSubmittedRef.current = false;
    isAwokenRef.current = false;
    activeTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setIsWakeWordDetected(false);
    setError(null);

    const stream = await startAudioAnalysis();
    if (!stream) {
      setError((prev) => prev || 'Microphone access unavailable. Check Windows privacy permissions.');
      setStatus('idle');
      return;
    }

    const isElectron = isElectronEnv();
    const SpeechRecognition =
      !isElectron &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    // If Web Speech API is available in a standard browser (NOT Electron), use continuous recognition
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          isRecognitionRunningRef.current = true;
          setStatus('monitoring');
          retryCountRef.current = 0;
        };

        recognition.onresult = (event: any) => {
          let finalStr = '';
          let interimStr = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalStr += event.results[i][0].transcript;
            } else {
              interimStr += event.results[i][0].transcript;
            }
          }

          const rawSpoken = (finalStr || interimStr).trim();
          if (!rawSpoken) return;

          // 1. If currently in standby monitoring, check for wake-word "Hermes" or "Jarvis"
          if (!isAwokenRef.current) {
            if (continuousDictation) {
              activeTranscriptRef.current = rawSpoken;
              setTranscript(rawSpoken);
              setInterimTranscript(interimStr);
              if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = setTimeout(() => {
                if (activeTranscriptRef.current && !hasSubmittedRef.current) {
                  hasSubmittedRef.current = true;
                  sendVoiceQueryRef.current(activeTranscriptRef.current);
                }
              }, 1200);
              return;
            }
            const { matched, commandAfterWake } = parseWakeWord(rawSpoken);
            if (matched) {
              isAwokenRef.current = true;
              setIsWakeWordDetected(true);
              soundFx.playWakeWordChime();
              setStatus('listening');

              if (wakeWordTimeoutRef.current) clearTimeout(wakeWordTimeoutRef.current);
              wakeWordTimeoutRef.current = setTimeout(() => {
                setIsWakeWordDetected(false);
              }, 3000);

              if (awokenTimeoutRef.current) clearTimeout(awokenTimeoutRef.current);
              awokenTimeoutRef.current = setTimeout(() => {
                if (isAwokenRef.current && statusRef.current === 'listening') {
                  isAwokenRef.current = false;
                  setIsWakeWordDetected(false);
                  setStatus('monitoring');
                  setTranscript('');
                  setInterimTranscript('');
                  activeTranscriptRef.current = '';
                }
              }, 8000);

              if (commandAfterWake.length > 2) {
                if (awokenTimeoutRef.current) clearTimeout(awokenTimeoutRef.current);
                activeTranscriptRef.current = commandAfterWake;
                setTranscript(commandAfterWake);

                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = setTimeout(() => {
                  if (activeTranscriptRef.current && !hasSubmittedRef.current) {
                    hasSubmittedRef.current = true;
                    sendVoiceQuery(activeTranscriptRef.current);
                  }
                }, 1100);
              }
            }
            return;
          }

          // 2. Already awoken, capture spoken command
          if (isAwokenRef.current) {
            const { commandAfterWake } = parseWakeWord(rawSpoken);
            const commandText = (commandAfterWake || rawSpoken).trim();
            if (commandText) {
              if (awokenTimeoutRef.current) clearTimeout(awokenTimeoutRef.current);
              activeTranscriptRef.current = commandText;
              setTranscript(commandText);
              setInterimTranscript(interimStr);

              if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = setTimeout(() => {
                if (activeTranscriptRef.current && !hasSubmittedRef.current) {
                  hasSubmittedRef.current = true;
                  sendVoiceQuery(activeTranscriptRef.current);
                }
              }, 1100);
            }
          }
        };

        recognition.onerror = (event: any) => {
          isRecognitionRunningRef.current = false;
          const errType = event.error;
          if (errType === 'not-allowed' || errType === 'service-not-allowed') {
            setError('Microphone access denied by browser');
            setStatus('idle');
          } else if (errType === 'network') {
            // Google Cloud Speech network unavailable in Electron or restricted environments
            // Fall back cleanly to ambient VAD
            safelyDestroyRecognition();
            setStatus('monitoring');
          }
        };

        recognition.onend = () => {
          isRecognitionRunningRef.current = false;
          if (
            modeRef.current === 'auto' &&
            !isProcessingRef.current &&
            !unmountedRef.current &&
            statusRef.current !== 'thinking' &&
            statusRef.current !== 'speaking'
          ) {
            if (activeTranscriptRef.current && !hasSubmittedRef.current && (isAwokenRef.current || continuousDictation)) {
              hasSubmittedRef.current = true;
              sendVoiceQuery(activeTranscriptRef.current);
              return;
            }

            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            const backoff = Math.min(1200, 200 + retryCountRef.current * 200);
            retryCountRef.current += 1;

            restartTimeoutRef.current = setTimeout(() => {
              if (modeRef.current === 'auto' && !isProcessingRef.current && !unmountedRef.current) {
                startMonitoring();
              }
            }, backoff);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setStatus('monitoring');
        return;
      } catch (err: any) {
        console.warn('SpeechRecognition monitoring notice:', err);
      }
    }

    // In Electron or browser without Web Speech: ambient VAD loop handles wake-word automatically
    setStatus('monitoring');
  }, [sendVoiceQuery, startAudioAnalysis, safelyDestroyRecognition, continuousDictation]);

  startMonitoringRef.current = startMonitoring;

  // Manual listening mode (Works everywhere: Electron MediaRecorder + Sarvam STT & Browser SpeechRecognition)
  const startListening = useCallback(async () => {
    if (typeof window === 'undefined' || unmountedRef.current) return;

    cancelVadClipRecording();
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setResponse('');
    activeTranscriptRef.current = '';
    isAwokenRef.current = true;
    hasSubmittedRef.current = false;
    isProcessingRef.current = false;
    hasSpokenRef.current = false;
    speechStartTimeRef.current = 0;
    lastSpokenTimestampRef.current = 0;
    audioChunksRef.current = [];

    soundFx.playClick(1000);

    // 1. Start audio visualization loop (captures microphone MediaStream)
    const stream = await startAudioAnalysis();
    if (!stream) {
      setError((prev) => prev || 'Could not access microphone. Check Windows privacy permissions.');
      setStatus('idle');
      return;
    }

    setStatus('listening');

    // 2. Initialize MediaRecorder on the microphone stream (universal support in Electron & Browsers)
    try {
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          isRecordingAudioRef.current = false;
          if (listeningTimeoutRef.current) {
            clearTimeout(listeningTimeoutRef.current);
            listeningTimeoutRef.current = null;
          }
          if (vadClipTimeoutRef.current) {
            clearTimeout(vadClipTimeoutRef.current);
            vadClipTimeoutRef.current = null;
          }
          if (hasSubmittedRef.current) return;

          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];

          // If browser speech recognition already generated a solid transcript, prioritize it
          if (activeTranscriptRef.current.trim()) {
            hasSubmittedRef.current = true;
            stopAudioAnalysis();
            sendVoiceQuery(activeTranscriptRef.current.trim());
            return;
          }

          if (chunks.length === 0) {
            stopAudioAnalysis();
            if (modeRef.current === 'auto') {
              setTimeout(() => {
                if (modeRef.current === 'auto' && !unmountedRef.current) {
                  startMonitoringRef.current();
                }
              }, 400);
            } else {
              setStatus('idle');
            }
            return;
          }

          const cleanType = (recorder.mimeType || 'audio/webm').split(';')[0].trim();
          const recordedBlob = new Blob(chunks, {
            type: cleanType,
          });

          if (recordedBlob.size < 120) {
            stopAudioAnalysis();
            if (modeRef.current === 'auto') {
              setTimeout(() => {
                if (modeRef.current === 'auto' && !unmountedRef.current) {
                  startMonitoringRef.current();
                }
              }, 400);
            } else {
              setStatus('idle');
            }
            return;
          }

          // Transcribe using Sarvam Neural STT (Saaras:v3)
          try {
            stopAudioAnalysis();
            setStatus('thinking');
            setInterimTranscript('Transcribing audio via Sarvam Saaras AI...');
            const sttResult = await transcribeSarvamAudio(recordedBlob);
            const clean = sttResult.trim();

            if (clean) {
              hasSubmittedRef.current = true;
              activeTranscriptRef.current = clean;
              setTranscript(clean);
              setInterimTranscript('');
              sendVoiceQuery(clean);
            } else {
              setInterimTranscript('');
              if (modeRef.current === 'auto') {
                setTimeout(() => {
                  if (modeRef.current === 'auto' && !unmountedRef.current) {
                    startMonitoringRef.current();
                  }
                }, 400);
              } else {
                setStatus('idle');
              }
            }
          } catch (sttErr: any) {
            console.warn('Sarvam STT fallback notice:', sttErr);
            stopAudioAnalysis();
            setInterimTranscript('');
            setError(sttErr.message || 'Speech-to-text failed');
            if (modeRef.current === 'auto') {
              setTimeout(() => {
                if (modeRef.current === 'auto' && !unmountedRef.current) {
                  startMonitoringRef.current();
                }
              }, 800);
            } else {
              setStatus('idle');
            }
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(200); // chunk every 200ms
        isRecordingAudioRef.current = true;
        if (vadClipTimeoutRef.current) clearTimeout(vadClipTimeoutRef.current);
        vadClipTimeoutRef.current = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 25000);
      }
    } catch (recErr: any) {
      console.warn('MediaRecorder init notice:', recErr);
      stopAudioAnalysis();
      setStatus('idle');
      setError(`Microphone recorder unavailable: ${recErr?.message || 'Unable to record audio'}`);
    }

    if (typeof MediaRecorder === 'undefined') {
      const hasNativeRecognition = !isElectronEnv() && !!(
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      );
      if (!hasNativeRecognition) {
        stopAudioAnalysis();
        setStatus('idle');
        setError('This browser cannot record microphone audio. Try a current version of Edge or Chrome.');
        return;
      }
    }

    // Set listening inactivity timeout watchdog (reverts to auto monitoring if user remains silent)
    if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);

    voiceRequestIdRef.current += 1;
    voiceRequestAbortRef.current?.abort();
    voiceRequestAbortRef.current = null;
    speechRunIdRef.current += 1;
    listeningTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'listening' && !hasSpokenRef.current && !hasSubmittedRef.current) {
        if (modeRef.current === 'auto') {
          startMonitoring();
        } else {
          setStatus('idle');
        }
      }
    }, 7000);

    // 3. Optional: Concurrently run Web Speech API if supported for live interim words outside Electron
    const isElectron = isElectronEnv();
    const SpeechRecognition =
      !isElectron &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          isRecognitionRunningRef.current = true;
        };

        recognition.onresult = (event: any) => {
          let finalStr = '';
          let interimStr = '';

          for (let i = event.results.length - 1; i >= 0; i--) {
            if (event.results[i].isFinal) {
              finalStr = event.results[i][0].transcript + ' ' + finalStr;
            } else {
              interimStr = event.results[i][0].transcript + ' ' + interimStr;
            }
          }

          const currentText = (finalStr || interimStr).trim();
          if (currentText) {
            hasSpokenRef.current = true;
            activeTranscriptRef.current = currentText;
            setTranscript(currentText);
            setInterimTranscript(interimStr);
          }

          // Automatic silence trigger after 2400ms of user pause
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = setTimeout(() => {
            if (activeTranscriptRef.current && !hasSubmittedRef.current) {
              stopListening();
            }
          }, 2400);
        };

        recognition.onerror = () => {
          isRecognitionRunningRef.current = false;
        };

        recognition.onend = () => {
          isRecognitionRunningRef.current = false;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.warn('SpeechRecognition start notice:', err.message);
      }
    }
  }, [sendVoiceQuery, startAudioAnalysis, stopAudioAnalysis, stopListening]);

  startListeningRef.current = startListening;

  // Mode switcher (Manual <-> Auto)
  const setMode = useCallback(
    async (newMode: VoiceMode) => {
      soundFx.playClick(newMode === 'auto' ? 1100 : 900);
      setModeState(newMode);
      modeRef.current = newMode;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hermes_voice_mode', newMode);
      }

      await safelyDestroyRecognition();
      stopAudioAnalysis();
      setIsWakeWordDetected(false);

      if (newMode === 'auto') {
        startMonitoring();
      } else {
        setStatus('idle');
      }
    },
    [startMonitoring, stopAudioAnalysis, safelyDestroyRecognition]
  );

  const toggleMode = useCallback(() => {
    const nextMode = mode === 'manual' ? 'auto' : 'manual';
    setMode(nextMode);
  }, [mode, setMode]);

  // Cancel / emergency reset
  const cancel = useCallback(() => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (wakeWordTimeoutRef.current) clearTimeout(wakeWordTimeoutRef.current);
    if (awokenTimeoutRef.current) clearTimeout(awokenTimeoutRef.current);
    if (synthWatchdogRef.current) clearTimeout(synthWatchdogRef.current);
    if (thinkingWatchdogRef.current) clearTimeout(thinkingWatchdogRef.current);
    if (vadClipTimeoutRef.current) clearTimeout(vadClipTimeoutRef.current);
    if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);

    isProcessingRef.current = false;
    hasSubmittedRef.current = false;
    isAwokenRef.current = false;
    activeTranscriptRef.current = '';
    audioChunksRef.current = [];

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isRecognitionRunningRef.current = false;

    stopSarvamAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    delete (window as any).__hermesActiveUtterance;
    soundFx.stopSpeechTelemetry();

    stopAudioAnalysis();
    setStatus('idle');
    setTranscript('');
    setInterimTranscript('');
    setResponse('');
    setError(null);
    setIsWakeWordDetected(false);
  }, [stopAudioAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      cancel();
    };
  }, [cancel]);

  // Initialize auto mode on mount
  useEffect(() => {
    if (mode === 'auto') {
      const initTimer = setTimeout(() => {
        if (!unmountedRef.current && modeRef.current === 'auto') {
          startMonitoring();
        }
      }, 400);
      return () => clearTimeout(initTimer);
    }
  }, []);

  return {
    mode,
    setMode,
    toggleMode,
    status,
    transcript: transcript || interimTranscript,
    response,
    error,
    audioLevel,
    frequencyBars,
    inputDb,
    isVoiceActive,
    isSupported,
    isWakeWordDetected,
    wakeWord,
    startListening,
    stopListening,
    startMonitoring,
    sendVoiceQuery,
    speakText,
    cancel,
  };
}
