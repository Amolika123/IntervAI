import { NextResponse } from 'next/server';

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file uploaded.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF resumes are accepted.' }, { status: 400 });
    }

    const forwardFormData = new FormData();
    forwardFormData.append('file', file, file.name);

    const res = await fetch(`${PYTHON_API_BASE_URL}/api/resume/upload`, {
      method: 'POST',
      body: forwardFormData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error: unknown) {
    console.error('Resume upload proxy error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process resume';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
