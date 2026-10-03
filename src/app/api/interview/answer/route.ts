import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { interviewId, order, questionText, groundingSource, transcript, projectId } = body;

    if (!interviewId || !questionText || !transcript) {
      return NextResponse.json({ error: 'Missing required fields (interviewId, questionText, transcript)' }, { status: 400 });
    }

    const question = await db.interviewQuestion.create({
      data: {
        interviewId,
        order: order || 1,
        questionText,
        groundingSource: groundingSource || 'resume:general',
        projectId: projectId || null
      }
    });

    const answer = await db.interviewAnswer.create({
      data: {
        interviewId,
        questionId: question.id,
        transcript
      }
    });

    return NextResponse.json({
      success: true,
      questionId: question.id,
      answerId: answer.id
    });

  } catch (error) {
    console.error('Save answer endpoint error:', error);
    return NextResponse.json({ error: 'Failed to persist interview turn' }, { status: 500 });
  }
}
