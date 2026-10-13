/**
 * Sarvam AI Speech Services Client
 * Powers Speech-to-Text (Saaras) and Text-to-Speech (Bulbul) models
 */

export interface SarvamTTSOptions {
  speaker?: 'simran' | 'dev' | 'priya' | 'rahul' | 'aditya';
  languageCode?: 'en-IN' | 'hi-IN' | 'bn-IN' | 'ta-IN' | 'te-IN' | 'mr-IN';
  pace?: number;
  pitch?: number;
  apiKey?: string;
}

export function getStoredSarvamApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('sarvam_api_key') || '';
}

export function setStoredSarvamApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key) {
    localStorage.setItem('sarvam_api_key', key.trim());
  } else {
    localStorage.removeItem('sarvam_api_key');
  }
}

/**
 * Synthesize speech via Sarvam Bulbul model
 */
export async function synthesizeSarvamSpeech(
  text: string,
  options: SarvamTTSOptions = {}
): Promise<{ audioUrl: string; model: string; speaker: string }> {
  const apiKey = options.apiKey || getStoredSarvamApiKey();

  const res = await fetch('/api/sarvam/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      speaker: options.speaker || 'simran',
      languageCode: options.languageCode || 'en-IN',
      pace: options.pace ?? 1.0,
      pitch: options.pitch ?? 0,
      apiKey: apiKey || undefined,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Sarvam TTS failed with status ${res.status}`);
  }

  const data = await res.json();
  return {
    audioUrl: data.audio,
    model: data.model || 'bulbul:v3',
    speaker: data.speaker || 'simran',
  };
}

/**
 * Transcribe recorded speech blob via Sarvam Saaras model
 */
export async function transcribeSarvamAudio(
  audioBlob: Blob,
  options: { model?: string; languageCode?: string; apiKey?: string } = {}
): Promise<string> {
  const apiKey = options.apiKey || getStoredSarvamApiKey();
  const rawMime = audioBlob.type || '';
  const cleanMime = rawMime.split(';')[0].trim().toLowerCase() || 'audio/wav';
  let filename = 'speech.wav';
  if (cleanMime.includes('webm')) filename = 'speech.webm';
  else if (cleanMime.includes('ogg') || cleanMime.includes('opus')) filename = 'speech.ogg';
  else if (cleanMime.includes('mp4') || cleanMime.includes('m4a')) filename = 'speech.m4a';
  else if (cleanMime.includes('mp3') || cleanMime.includes('mpeg')) filename = 'speech.mp3';

  // Ensure clean blob without parameter extensions
  const cleanBlob = audioBlob.slice(0, audioBlob.size, cleanMime);

  const formData = new FormData();
  formData.append('file', cleanBlob, filename);
  if (options.model) formData.append('model', options.model);
  if (options.languageCode) formData.append('language_code', options.languageCode);
  if (apiKey) formData.append('apiKey', apiKey);

  const res = await fetch('/api/sarvam/stt', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Sarvam STT failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.transcript || '';
}

let currentAudio: HTMLAudioElement | null = null;

/**
 * Play synthesized Sarvam audio with stop control
 */
export function playSarvamAudio(audioDataUri: string, onEnded?: () => void): HTMLAudioElement {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
  }

  const audio = new Audio(audioDataUri);
  currentAudio = audio;

  if (onEnded) {
    audio.onended = () => {
      onEnded();
      if (currentAudio === audio) currentAudio = null;
    };
    audio.onerror = () => {
      onEnded();
      if (currentAudio === audio) currentAudio = null;
    };
  }

  audio.play().catch((err) => {
    console.warn('Audio play prevented:', err);
    if (onEnded) onEnded();
  });

  return audio;
}

export function stopSarvamAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
}
