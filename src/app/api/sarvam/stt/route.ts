import { NextRequest, NextResponse } from 'next/server';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const rawModel = formData.get('model');
    const model = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : 'saaras:v3';
    if (!/^[a-zA-Z0-9:_-]{1,64}$/.test(model)) {
      return NextResponse.json({ error: 'Invalid STT model identifier' }, { status: 400 });
    }
    const rawLang = formData.get('language_code');
    const languageCode = typeof rawLang === 'string' && rawLang.trim() ? rawLang.trim() : 'unknown';
    if (languageCode.length > 32 || [...languageCode].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
    }
    const rawApiKey = formData.get('apiKey');
    if (rawApiKey !== null && (typeof rawApiKey !== 'string' || rawApiKey.length > 512 || [...rawApiKey].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) {
      return NextResponse.json({ error: 'Invalid API key field' }, { status: 400 });
    }
    const clientApiKey = typeof rawApiKey === 'string' ? rawApiKey : null;

    const apiKey = clientApiKey || process.env.SARVAM_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        {
          error: 'SARVAM_API_KEY is not configured. Please add your Sarvam API key in System Settings or .env',
          code: 'KEY_MISSING',
        },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Audio file is required in formData' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file exceeds the 20 MB limit' }, { status: 413 });
    }

    const rawMime = (file as Blob).type || '';
    // Strip any parameters (e.g. ';codecs=opus') to prevent Sarvam 400 rejection
    let cleanMime = rawMime.split(';')[0].trim().toLowerCase();
    let ext = '';

    if (cleanMime.includes('webm')) {
      cleanMime = 'audio/webm';
      ext = 'webm';
    } else if (cleanMime.includes('ogg') || cleanMime.includes('opus')) {
      cleanMime = 'audio/ogg';
      ext = 'ogg';
    } else if (cleanMime.includes('mp3') || cleanMime.includes('mpeg')) {
      cleanMime = 'audio/mp3';
      ext = 'mp3';
    } else if (cleanMime.includes('wav') || cleanMime.includes('wave')) {
      cleanMime = 'audio/wav';
      ext = 'wav';
    } else if (cleanMime.includes('mp4') || cleanMime.includes('m4a')) {
      cleanMime = 'audio/mp4';
      ext = 'm4a';
    } else if (cleanMime.includes('aac')) {
      cleanMime = 'audio/aac';
      ext = 'aac';
    } else if (cleanMime.includes('flac')) {
      cleanMime = 'audio/flac';
      ext = 'flac';
    } else if (cleanMime.includes('aiff')) {
      cleanMime = 'audio/aiff';
      ext = 'aiff';
    } else if (cleanMime.includes('amr')) {
      cleanMime = 'audio/amr';
      ext = 'amr';
    } else if (cleanMime.includes('wma')) {
      cleanMime = 'audio/x-ms-wma';
      ext = 'wma';
    } else {
      return NextResponse.json(
        { error: `Unsupported or missing audio format: ${rawMime || 'unknown'}` },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const cleanBlob = new Blob([arrayBuffer], { type: cleanMime });
    const fileName = `audio.${ext}`;

    const sarvamFormData = new FormData();
    sarvamFormData.append('file', cleanBlob, fileName);
    sarvamFormData.append('model', model);
    if (languageCode) {
      sarvamFormData.append('language_code', languageCode);
    }

    const sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey.trim(),
      },
      signal: AbortSignal.timeout(15000),
      body: sarvamFormData,
    });

    if (!sarvamRes.ok) {
      await sarvamRes.text(); // Consume the body without exposing provider details to the client.
      return NextResponse.json(
        {
          error: 'Sarvam STT provider request failed',
          statusCode: sarvamRes.status,
        },
        { status: sarvamRes.status }
      );
    }

    const data = await sarvamRes.json();
    return NextResponse.json({
      transcript: data.transcript || '',
      languageCode: data.language_code || languageCode,
      model: model,
    });
  } catch (error: any) {
    console.error('Sarvam STT error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in Sarvam STT route' },
      { status: 500 }
    );
  }
}
