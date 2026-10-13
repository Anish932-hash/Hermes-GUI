import { NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

const PULSE_SERVER = '/mnt/wslg/PulseServer';

interface WslAudioSample {
  active: boolean;
  rms: number;
  db: number;
  fft: number[];
  server: string;
  sink: string;
  monitor: string;
  isAvailable: boolean;
  sinkState: string;
}

function samplePulseAudio(timeoutMs = 90): Promise<WslAudioSample> {
  return new Promise((resolve) => {
    const isAvailable = fs.existsSync(PULSE_SERVER);
    if (!isAvailable) {
      return resolve({
        active: false,
        rms: 0,
        db: -90,
        fft: Array(28).fill(0),
        server: PULSE_SERVER,
        sink: 'RDPSink',
        monitor: 'RDPSink.monitor',
        isAvailable: false,
        sinkState: 'OFFLINE',
      });
    }

    let proc: any;
    try {
      proc = spawn('parec', [
        `--server=${PULSE_SERVER}`,
        '-d',
        'RDPSink.monitor',
        '--raw',
        '--rate=44100',
        '--channels=2',
        '--format=s16le',
      ]);
    } catch {
      return resolve({
        active: false,
        rms: 0,
        db: -90,
        fft: Array(28).fill(0),
        server: PULSE_SERVER,
        sink: 'RDPSink',
        monitor: 'RDPSink.monitor',
        isAvailable: true,
        sinkState: 'UNAVAILABLE',
      });
    }

    const chunks: Buffer[] = [];
    let bytesRead = 0;

    proc.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      bytesRead += chunk.length;
      if (bytesRead >= 2048) {
        if (!proc.killed) proc.kill();
      }
    });

    proc.on('error', () => {
      resolve({
        active: false,
        rms: 0,
        db: -90,
        fft: Array(28).fill(0),
        server: PULSE_SERVER,
        sink: 'RDPSink',
        monitor: 'RDPSink.monitor',
        isAvailable: true,
        sinkState: 'ERROR',
      });
    });

    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill();
      finish();
    }, timeoutMs);

    proc.on('close', finish);

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (chunks.length === 0) {
        return resolve({
          active: false,
          rms: 0,
          db: -90,
          fft: Array(28).fill(0),
          server: PULSE_SERVER,
          sink: 'RDPSink',
          monitor: 'RDPSink.monitor',
          isAvailable: true,
          sinkState: 'IDLE',
        });
      }

      const buf = Buffer.concat(chunks);
      const sampleCount = Math.floor(buf.length / 2);
      if (sampleCount === 0) {
        return resolve({
          active: false,
          rms: 0,
          db: -90,
          fft: Array(28).fill(0),
          server: PULSE_SERVER,
          sink: 'RDPSink',
          monitor: 'RDPSink.monitor',
          isAvailable: true,
          sinkState: 'IDLE',
        });
      }

      let sumSq = 0;
      const samples = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const val = buf.readInt16LE(i * 2);
        samples[i] = val;
        sumSq += val * val;
      }

      const rms = Math.sqrt(sumSq / sampleCount);
      const db = rms > 1 ? Math.max(-90, Math.min(0, 20 * Math.log10(rms / 32768))) : -90;
      const active = rms > 45;

      // Group into 28 frequency bins
      const binSize = Math.max(1, Math.floor(sampleCount / 28));
      const fft: number[] = [];
      for (let b = 0; b < 28; b++) {
        let bSum = 0;
        const start = b * binSize;
        const end = Math.min(sampleCount, start + binSize);
        for (let j = start; j < end; j++) {
          bSum += Math.abs(samples[j]);
        }
        const bAvg = end > start ? bSum / (end - start) : 0;
        // Normalize 0 to 100
        fft.push(Math.min(100, Math.round((bAvg / 16384) * 100)));
      }

      resolve({
        active,
        rms: Math.round(rms),
        db: parseFloat(db.toFixed(1)),
        fft,
        server: PULSE_SERVER,
        sink: 'RDPSink',
        monitor: 'RDPSink.monitor',
        isAvailable: true,
        sinkState: active ? 'STREAMING' : 'READY',
      });
    }
  });
}

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const sample = await samplePulseAudio(90);
    return NextResponse.json(sample);
  } catch (error: any) {
    return NextResponse.json(
      {
        active: false,
        rms: 0,
        db: -90,
        fft: Array(28).fill(0),
        server: PULSE_SERVER,
        isAvailable: fs.existsSync(PULSE_SERVER),
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'test_tone';

    if (action === 'test_tone') {
      const freq = body.frequency || 660;
      const duration = body.duration || 0.4;

      // Trigger a harmless test chirp inside WSL PulseAudio
      exec(`sox -n -t pulseaudio default synth ${duration} sine ${freq} vol 0.35 2>/dev/null &`);

      return NextResponse.json({
        success: true,
        message: `Dispatched ${duration}s test tone (${freq}Hz) to WSL PulseAudio default sink`,
      });
    }

    if (action === 'diagnostics') {
      const { stdout: sinks } = await execAsync(`PULSE_SERVER=${PULSE_SERVER} pactl list short sinks 2>/dev/null || echo "None"`).catch(() => ({ stdout: 'None' }));
      const { stdout: sources } = await execAsync(`PULSE_SERVER=${PULSE_SERVER} pactl list short sources 2>/dev/null || echo "None"`).catch(() => ({ stdout: 'None' }));
      const { stdout: clients } = await execAsync(`PULSE_SERVER=${PULSE_SERVER} pactl list short sink-inputs 2>/dev/null || echo "None"`).catch(() => ({ stdout: 'None' }));

      return NextResponse.json({
        pulseServer: PULSE_SERVER,
        exists: fs.existsSync(PULSE_SERVER),
        sinks: sinks.trim().split('\n').filter(Boolean),
        sources: sources.trim().split('\n').filter(Boolean),
        activeAudioClients: clients.trim().split('\n').filter(Boolean),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
