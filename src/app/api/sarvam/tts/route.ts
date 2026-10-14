import { NextRequest, NextResponse } from 'next/server';

import { isLocalRequest } from '@/lib/local-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const {
      text,
      speaker: requestedSpeaker,
      languageCode = 'en-IN',
      pace = 1.0,
      pitch = 0,
      model = 'bulbul:v3',
      apiKey: clientApiKey,
    } = body;

    if (typeof languageCode !== 'string' || languageCode.length > 32 || /[\\u0000-\\u001f\\u007f]/.test(languageCode)) {
      return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
    }
    if (typeof pace !== 'number' || !Number.isFinite(pace) || pace < 0.5 || pace > 2) {
      return NextResponse.json({ error: 'Pace must be a finite number between 0.5 and 2' }, { status: 400 });
    }
    if (typeof pitch !== 'number' || !Number.isFinite(pitch) || pitch < -20 || pitch > 20) {
      return NextResponse.json({ error: 'Pitch must be a finite number between -20 and 20' }, { status: 400 });
    }
    if (requestedSpeaker !== undefined && (typeof requestedSpeaker !== 'string' || requestedSpeaker.length > 64 || /[\\u0000-\\u001f\\u007f]/.test(requestedSpeaker))) {
      return NextResponse.json({ error: 'Invalid speaker identifier' }, { status: 400 });
    }
    if (clientApiKey != null && (typeof clientApiKey !== 'string' || clientApiKey.length > 512 || /[\\u0000-\\u001f\\u007f]/.test(clientApiKey))) {
      return NextResponse.json({ error: 'Invalid API key field' }, { status: 400 });
    }

    if (!['bulbul:v2', 'bulbul:v3', 'bulbul:v4-flash'].includes(model)) {
      return NextResponse.json({ error: 'Unsupported Sarvam TTS model' }, { status: 400 });
    }

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

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text prompt is required' }, { status: 400 });
    }

    const maxLength = model === 'bulbul:v2' ? 1500 : 2500;
    const trimmedText = text.trim();
    if (trimmedText.length > maxLength) {
      return NextResponse.json(
        { error: `Text exceeds the ${maxLength}-character limit for ${model}` },
        { status: 413 }
      );
    }

    const speaker = typeof requestedSpeaker === 'string' && requestedSpeaker.trim()
      ? requestedSpeaker.trim()
      : model === 'bulbul:v4-flash'
        ? undefined
        : model === 'bulbul:v2'
          ? 'anushka'
          : 'simran';

    const payload: Record<string, unknown> = {
      inputs: [trimmedText],
      target_language_code: languageCode,
      pace,
      speech_sample_rate: 22050,
      model,
    };
    if (speaker) payload.speaker = speaker;
    // Bulbul v3 and v4-flash reject the legacy v2 pitch/loudness/preprocessing fields.
    if (model === 'bulbul:v2') {
      payload.pitch = pitch;
      payload.loudness = 1.5;
      payload.enable_preprocessing = true;
    }

    const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey.trim(),
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify(payload),
    });

    if (!sarvamRes.ok) {
      await sarvamRes.text(); // Consume the body without exposing provider details to the client.
      return NextResponse.json(
        {
          error: 'Sarvam TTS provider request failed',
          statusCode: sarvamRes.status,
        },
        { status: sarvamRes.status }
      );
    }

    const data = await sarvamRes.json();
    const base64Audio = data?.audios?.[0];

    if (!base64Audio) {
      return NextResponse.json({ error: 'No audio returned by Sarvam TTS' }, { status: 502 });
    }

    return NextResponse.json({
      audio: `data:audio/wav;base64,${base64Audio}`,
      rawBase64: base64Audio,
      model: model,
      speaker: speaker || null,
    });
  } catch (error: any) {
    console.error('Sarvam TTS error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in Sarvam TTS route' },
      { status: 500 }
    );
  }
}
