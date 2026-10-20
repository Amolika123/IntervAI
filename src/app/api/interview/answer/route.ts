import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const forwardPayload = {
      interviewId: body.interviewId,
      order: body.order || 1,
      questionText: body.questionText || body.question || '',
      transcript: body.transcript !== undefined ? body.transcript : (body.answer || ''),
      status: body.status || 'answered',
      groundingSource: body.groundingSource || 'resume:general',
      projectId: body.projectId || null,
    };

    const res = await fetch(`${PYTHON_API_BASE_URL}/api/interview/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Normalize next grounding source fields
    const nextGrounding = data.nextGroundingSource || data.groundingSource || 'resume:general';

    return NextResponse.json({
      ...data,
      groundingSource: nextGrounding,
      nextGroundingSource: nextGrounding,
      order: data.nextOrder || data.order,
      nextOrder: data.nextOrder || data.order,
    }, { status: 200 });

  } catch (error) {
    console.error('Save answer proxy error:', error);
    return NextResponse.json({ error: 'Failed to persist interview turn' }, { status: 500 });
  }
}
