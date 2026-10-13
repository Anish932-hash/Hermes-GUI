'use client';

import { synthesizeSarvamSpeech, playSarvamAudio, stopSarvamAudio } from './sarvam';

export type AudioProfile = 'stark' | 'cyberpunk' | 'nasa' | 'stealth';

/**
 * Web Audio API futuristic sound synthesizer for Neon OS / Hermes HUD.
 * Generates sci-fi UI sounds dynamically without requiring external audio files.
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private systemAudioStream: MediaStream | null = null;
  private systemAudioSource: MediaStreamAudioSourceNode | null = null;
  private systemAudioAnalyser: AnalyserNode | null = null;
  private deviceAudioStream: MediaStream | null = null;
  private deviceAudioSource: MediaStreamAudioSourceNode | null = null;
  private deviceAudioAnalyser: AnalyserNode | null = null;
  private isMuted: boolean = false;
  private profile: AudioProfile = 'stark';
  private masterVolume: number = 1.0;
  private pitchMultiplier: number = 1.0;
  private voiceRate: number = 1.05;
  private speechOscillators: { stop: () => void } | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('neon_os_muted');
      this.isMuted = savedMute === 'true';

      const savedProfile = localStorage.getItem('neon_os_audio_profile') as AudioProfile;
      if (savedProfile && ['stark', 'cyberpunk', 'nasa', 'stealth'].includes(savedProfile)) {
        this.profile = savedProfile;
      }

      const savedVol = localStorage.getItem('neon_os_master_vol');
      if (savedVol) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) this.masterVolume = parsed;
      }

      const savedPitch = localStorage.getItem('neon_os_pitch_mult');
      if (savedPitch) {
        const parsed = parseFloat(savedPitch);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) this.pitchMultiplier = parsed;
      }

      const savedRate = localStorage.getItem('neon_os_voice_rate');
      if (savedRate) {
        const parsed = parseFloat(savedRate);
        if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.6) this.voiceRate = parsed;
      }
    }
  }

  public getProfile(): AudioProfile {
    return this.profile;
  }

  public setProfile(profile: AudioProfile) {
    this.profile = profile;
    if (typeof window !== 'undefined') {
      localStorage.setItem('neon_os_audio_profile', profile);
    }
    this.notifyListeners();
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      } catch {}
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('neon_os_master_vol', String(this.masterVolume));
    }
    this.notifyListeners();
  }

  public getPitchMultiplier(): number {
    return this.pitchMultiplier;
  }

  public setPitchMultiplier(mult: number) {
    this.pitchMultiplier = Math.max(0.5, Math.min(2.0, mult));
    if (typeof window !== 'undefined') {
      localStorage.setItem('neon_os_pitch_mult', String(this.pitchMultiplier));
    }
    this.notifyListeners();
  }

  public getVoiceRate(): number {
    return this.voiceRate;
  }

  public setVoiceRate(rate: number) {
    this.voiceRate = Math.max(0.7, Math.min(1.6, rate));
    if (typeof window !== 'undefined') {
      localStorage.setItem('neon_os_voice_rate', String(this.voiceRate));
    }
    this.notifyListeners();
  }

  public stopSpeech() {
    stopSarvamAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.stopSpeechTelemetry();
  }

  public playTestChime(type: 'click' | 'boost' | 'ping' | 'task_start' | 'task_success' | 'alert') {
    switch (type) {
      case 'click':
        this.playClick(1000);
        break;
      case 'boost':
        this.playBoost();
        break;
      case 'ping':
        this.playMessagePing();
        break;
      case 'task_start':
        this.playTaskStart();
        break;
      case 'task_success':
        this.playTaskSuccess();
        break;
      case 'alert':
        this.playJarvisAlert();
        break;
    }
  }

  public initContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.masterAnalyser) {
      try {
        this.masterAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser.fftSize = 128;
        this.masterAnalyser.smoothingTimeConstant = 0.8;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.ctx.destination);
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getDest(): AudioNode {
    if (this.masterGain) return this.masterGain;
    if (this.ctx) return this.ctx.destination;
    return null as any;
  }

  public getMasterAnalyser(): AnalyserNode | null {
    this.initContext();
    return this.masterAnalyser;
  }

  public getAudioContext(): AudioContext | null {
    return this.initContext();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('neon_os_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  public getSystemAudioAnalyser(): AnalyserNode | null {
    return this.systemAudioAnalyser;
  }

  public getDeviceAudioAnalyser(): AnalyserNode | null {
    return this.deviceAudioAnalyser;
  }

  public isSystemAudioActive(): boolean {
    return !!this.systemAudioAnalyser && !!this.systemAudioStream && this.systemAudioStream.active;
  }

  public isDeviceAudioActive(): boolean {
    return !!this.deviceAudioAnalyser && !!this.deviceAudioStream && this.deviceAudioStream.active;
  }

  /**
   * Captures Windows & External System Audio via getDisplayMedia audio loopback.
   * Prompts user to select screen/window and share audio (e.g., Spotify, YouTube, Games, Windows sounds).
   * Video tracks are immediately discarded to ensure zero overhead.
   */
  public async startSystemAudioCapture(): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined') return { success: false, error: 'Window not defined' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return { success: false, error: 'System Audio capture not supported in this browser environment.' };
    }

    try {
      this.initContext();
      if (!this.ctx) throw new Error('Web Audio Context not initialized');

      // Request display media with system audio included
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        return {
          success: false,
          error: 'No audio stream provided. Make sure to check "Share audio" in the browser selection dialog.',
        };
      }

      // Immediately shut off video tracks to save 100% of GPU/CPU video render load
      stream.getVideoTracks().forEach((t) => t.stop());

      // If an existing capture was running, clean it up
      if (this.systemAudioStream) {
        this.systemAudioStream.getTracks().forEach((t) => t.stop());
      }

      this.systemAudioStream = stream;
      this.systemAudioAnalyser = this.ctx.createAnalyser();
      this.systemAudioAnalyser.fftSize = 128;
      this.systemAudioAnalyser.smoothingTimeConstant = 0.75;

      this.systemAudioSource = this.ctx.createMediaStreamSource(stream);
      this.systemAudioSource.connect(this.systemAudioAnalyser);
      // NOTE: We do not route to ctx.destination to avoid echoing already playing audio

      audioTracks[0].onended = () => {
        this.stopSystemAudioCapture();
      };

      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'System audio capture canceled or denied' };
    }
  }

  public stopSystemAudioCapture() {
    if (this.systemAudioStream) {
      this.systemAudioStream.getTracks().forEach((t) => t.stop());
      this.systemAudioStream = null;
    }
    if (this.systemAudioSource) {
      try {
        this.systemAudioSource.disconnect();
      } catch {}
      this.systemAudioSource = null;
    }
    this.systemAudioAnalyser = null;
    this.notifyListeners();
  }

  /**
   * Captures physical audio hardware input (Microphone, Stereo Mix loopback, Line-in, CABLE output)
   */
  public async startDeviceAudioCapture(deviceId?: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { success: false, error: 'Hardware audio capture not supported.' };
    }

    try {
      this.initContext();
      if (!this.ctx) throw new Error('Web Audio Context not initialized');

      const constraints: MediaStreamConstraints = {
        video: false,
        audio: deviceId
          ? {
              deviceId: { exact: deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.deviceAudioStream) {
        this.deviceAudioStream.getTracks().forEach((t) => t.stop());
      }

      this.deviceAudioStream = stream;
      this.deviceAudioAnalyser = this.ctx.createAnalyser();
      this.deviceAudioAnalyser.fftSize = 128;
      this.deviceAudioAnalyser.smoothingTimeConstant = 0.75;

      this.deviceAudioSource = this.ctx.createMediaStreamSource(stream);
      this.deviceAudioSource.connect(this.deviceAudioAnalyser);

      const track = stream.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          this.stopDeviceAudioCapture();
        };
      }

      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Device audio capture failed' };
    }
  }

  public stopDeviceAudioCapture() {
    if (this.deviceAudioStream) {
      this.deviceAudioStream.getTracks().forEach((t) => t.stop());
      this.deviceAudioStream = null;
    }
    if (this.deviceAudioSource) {
      try {
        this.deviceAudioSource.disconnect();
      } catch {}
      this.deviceAudioSource = null;
    }
    this.deviceAudioAnalyser = null;
    this.notifyListeners();
  }

  public async getAvailableInputDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audioinput');
    } catch {
      return [];
    }
  }

  // Futuristic UI button click (short high-tech chirp)
  public playClick(freq = 880, duration = 0.04) {
    if (this.isMuted || this.profile === 'stealth') return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const effFreq = freq * this.pitchMultiplier;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.profile === 'cyberpunk' ? 'square' : this.profile === 'nasa' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(effFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(effFreq * 1.8, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.08 * this.masterVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.getDest());

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public playChirp() {
    this.playClick(1200, 0.05);
  }

  public playMicroTick() {
    this.playHover();
  }

  // Sci-fi hover blip
  public playHover() {
    if (this.isMuted || this.profile === 'stealth') return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const effFreq = 1200 * this.pitchMultiplier;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.profile === 'cyberpunk' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(effFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(effFreq * 1.33, ctx.currentTime + 0.02);

      gain.gain.setValueAtTime(0.025 * this.masterVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(this.getDest());

      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    } catch {
      // Audio policy
    }
  }

  // Reactor boost / power-up surge
  public playBoost() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Sub-bass sweep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(60, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 0.8);
      osc1.frequency.exponentialRampToValueAtTime(110, now + 1.5);

      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.5);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      // Lowpass filter for warm sci-fi energy feel
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.6);
      filter.frequency.exponentialRampToValueAtTime(300, now + 1.5);

      osc1.connect(filter);
      filter.connect(gain1);
      gain1.connect(this.getDest());

      osc1.start(now);
      osc1.stop(now + 1.5);

      // Energy pulse chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.3); // C6
      osc2.frequency.exponentialRampToValueAtTime(2093, now + 0.7); // C7

      gain2.gain.setValueAtTime(0.06, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc2.connect(gain2);
      gain2.connect(this.getDest());

      osc2.start(now + 0.3);
      osc2.stop(now + 0.8);
    } catch {
      // Audio policy
    }
  }

  // Hermes response incoming chime
  public playMessagePing() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [880, 1320, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.05, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(this.getDest());

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch {
      // Audio policy
    }
  }

  // Rising harmonic chime for each of the 15 boot diagnostic phases
  public playBootPhase(phaseIndex: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Frequency ascends musically with the 15 phases (from 220Hz up to 1760Hz)
      const baseFreq = 220 * Math.pow(2, phaseIndex / 5);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.08);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.getDest());

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  // Marvel Jarvis protocol start sound (dual harmonic chirp)
  public playTaskStart() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.06, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.2);

        osc.connect(gain);
        gain.connect(this.getDest());

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.2);
      });
    } catch {}
  }

  // Micro cyber-tick when sub-tasks step forward
  public playTaskStep() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);

      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.getDest());

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  // Jarvis alert sound
  public playJarvisAlert() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [800, 600].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.05, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.1);

        osc.connect(gain);
        gain.connect(this.getDest());

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.1);
      });
    } catch {}
  }

  // Warning alias for system alert
  public playWarning() {
    this.playJarvisAlert();
  }

  // Futuristic armor calibration sweep on theme change
  public playThemeSwitch() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.getDest());

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  // Teletype / terminal execution pulse
  public playTerminalCommand() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.04);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.getDest());

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  }

  // Wake-word activation chime (Harmonic ascend when "Hermes" is detected)
  public playWakeWordChime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [659.25, 880, 1174.66, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + idx * 0.06 + 0.12);

        gain.gain.setValueAtTime(0.07, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);

        osc.connect(gain);
        gain.connect(this.getDest());

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.18);
      });
    } catch {}
  }

  // Triumphant Stark Jarvis task completion chord
  public playTaskSuccess() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880, 1108.73, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + idx * 0.04 + 0.35);

        gain.gain.setValueAtTime(0.07, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.45);

        osc.connect(gain);
        gain.connect(this.getDest());

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.45);
      });
    } catch {}
  }

  // Starts harmonic speech carrier telemetry into masterAnalyser during vocal talkback
  public startSpeechTelemetry() {
    const ctx = this.initContext();
    if (!ctx) return;
    this.stopSpeechTelemetry();

    try {
      const carrierGain = ctx.createGain();
      const baseGain = this.isMuted ? 0 : 0.015;
      carrierGain.gain.setValueAtTime(baseGain, ctx.currentTime);
      carrierGain.connect(this.getDest());

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(140, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(680, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, ctx.currentTime);
      filter.Q.setValueAtTime(2.0, ctx.currentTime);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(4.2, ctx.currentTime);
      lfoGain.gain.setValueAtTime(90, ctx.currentTime);
      lfo.connect(filter.frequency);

      osc1.connect(filter);
      osc2.connect(carrierGain);
      filter.connect(carrierGain);

      osc1.start();
      osc2.start();
      lfo.start();

      this.speechOscillators = {
        stop: () => {
          try {
            const now = ctx.currentTime;
            carrierGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
            setTimeout(() => {
              try {
                osc1.stop();
                osc2.stop();
                lfo.stop();
                osc1.disconnect();
                osc2.disconnect();
                lfo.disconnect();
                filter.disconnect();
                carrierGain.disconnect();
              } catch {}
            }, 100);
          } catch {}
          this.speechOscillators = null;
        },
      };
    } catch {}
  }

  // Stops vocal telemetry
  public stopSpeechTelemetry() {
    if (this.speechOscillators) {
      this.speechOscillators.stop();
      this.speechOscillators = null;
    }
  }

  // Marvel JARVIS voice debrief / vocal talk-back
  public speakText(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.isMuted) {
      if (onEnd) onEnd();
      return;
    }

    stopSarvamAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.stopSpeechTelemetry();

    const cleanText = text
      .replace(/[*_#`[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[{}"']/g, ' ')
      .slice(0, 320);

    const finish = () => {
      this.stopSpeechTelemetry();
      stopSarvamAudio();
      if (onEnd) onEnd();
    };

    // 1. Attempt Sarvam Neural TTS
    synthesizeSarvamSpeech(cleanText)
      .then(({ audioUrl }) => {
        this.startSpeechTelemetry();
        playSarvamAudio(audioUrl, finish);
      })
      .catch(() => {
        // 2. Fallback to browser SpeechSynthesis
        try {
          if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            finish();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(cleanText);
          const voices = window.speechSynthesis.getVoices();
          const preferred = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Google') ||
                v.name.includes('Daniel') ||
                v.name.includes('Samantha') ||
                v.name.includes('Guy'))
          );
          if (preferred) utterance.voice = preferred;

          utterance.rate = 1.05;
          utterance.pitch = 0.95;
          utterance.onend = finish;
          utterance.onerror = finish;

          this.startSpeechTelemetry();
          window.speechSynthesis.speak(utterance);
        } catch {
          finish();
        }
      });
  }
}

export const soundFx = new AudioSynthesizer();
