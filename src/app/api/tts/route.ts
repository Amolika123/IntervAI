import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${PYTHON_API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('audio/mpeg')) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.byteLength.toString(),
        },
      });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error) {
    console.warn('TTS proxy error, signaling Web Speech API fallback:', error);
    return NextResponse.json({ fallback: true });
  }
}
