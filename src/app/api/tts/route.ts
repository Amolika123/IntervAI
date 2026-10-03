import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required for TTS' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Signal client to use Web Speech API (window.speechSynthesis)
      return NextResponse.json({ fallback: true });
    }

    const openai = new OpenAI({ apiKey });
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text.slice(0, 1000), // Cap length for fast low-latency streaming
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.warn('OpenAI TTS endpoint error, falling back to Web Speech API:', error);
    return NextResponse.json({ fallback: true });
  }
}
