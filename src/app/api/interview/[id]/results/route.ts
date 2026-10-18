import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;

    const res = await fetch(`${PYTHON_API_BASE_URL}/api/interview/${interviewId}/results`, {
      method: 'GET',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error) {
    console.error('Fetch interview results proxy error:', error);
    return NextResponse.json({ error: 'Failed to retrieve interview results' }, { status: 500 });
  }
}
