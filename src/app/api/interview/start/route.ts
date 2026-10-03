import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CandidateProfile } from '@/lib/nlp/resumeParser';
import { buildCandidateContext } from '@/lib/context/candidateContextBuilder';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resumeId } = body;

    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });
    }

    const resume = await db.resume.findUnique({
      where: { id: resumeId },
      include: { projects: { include: { sources: true } } }
    });

    if (!resume) {
      return NextResponse.json({ error: 'Resume record not found' }, { status: 404 });
    }

    const parsedProfile: CandidateProfile = JSON.parse(resume.parsedProfile);
    const candidateContext = await buildCandidateContext(parsedProfile);

    // Create interview record
    const interview = await db.interview.create({
      data: {
        userId: resume.userId,
        resumeId: resume.id,
        status: 'CREATED',
        candidateContext: JSON.stringify(candidateContext)
      }
    });

    return NextResponse.json({
      success: true,
      interviewId: interview.id,
      candidateContext
    });

  } catch (error) {
    console.error('Start interview endpoint error:', error);
    return NextResponse.json({ error: 'Failed to start interview session' }, { status: 500 });
  }
}
