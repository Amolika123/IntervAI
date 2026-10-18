import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${PYTHON_API_BASE_URL}/api/interview/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error) {
    console.error('Start interview proxy error:', error);
    return NextResponse.json({ error: 'Failed to start interview session' }, { status: 500 });
  }
}
