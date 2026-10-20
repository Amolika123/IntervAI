import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;

    const res = await fetch(`${PYTHON_API_BASE_URL}/api/interview/${interviewId}/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error) {
    console.error('Interview cleanup proxy error:', error);
    return NextResponse.json({ error: 'Failed to cleanup temporary question bank' }, { status: 500 });
  }
}
