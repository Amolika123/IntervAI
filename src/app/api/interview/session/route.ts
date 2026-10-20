import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

async function handleSessionRequest(interviewId: string) {
  if (!interviewId) {
    return NextResponse.json({ error: 'interviewId is required' }, { status: 400 });
  }

  const res = await fetch(`${PYTHON_API_BASE_URL}/api/interview/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviewId }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return NextResponse.json(data, { status: res.status });
  }

  // Normalize payload for complete frontend consistency
  const candidateContext = data.candidateContext || {};
  const candidate = candidateContext.candidate || {};
  const projects = candidateContext.projects || [];
  const style = data.style || 'FAANG';

  return NextResponse.json({
    success: true,
    interviewId,
    candidateName: candidate.name || 'Candidate',
    projects,
    interviewStyle: style,
    style,
    openingQuestion: data.openingQuestion,
    openingSource: data.openingSource,
    candidateContext,
    clientSecret: data.clientSecret,
    mockMode: data.mockMode,
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const interviewId = searchParams.get('interviewId') || searchParams.get('id') || '';
    return await handleSessionRequest(interviewId);
  } catch (error) {
    console.error('Session GET proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const interviewId = body.interviewId || body.id || '';
    return await handleSessionRequest(interviewId);
  } catch (error) {
    console.error('Session POST proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
