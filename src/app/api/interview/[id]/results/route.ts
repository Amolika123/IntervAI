import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: {
        evaluation: true,
        questions: {
          include: { answer: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const candidateContext = JSON.parse(interview.candidateContext);

    let evaluation = null;
    if (interview.evaluation) {
      evaluation = {
        id: interview.evaluation.id,
        overallScore: interview.evaluation.overallScore,
        overallAssessment: interview.evaluation.overallAssessment,
        strengths: JSON.parse(interview.evaluation.strengths),
        areasToImprove: JSON.parse(interview.evaluation.areasToImprove),
        questionBreakdown: JSON.parse(interview.evaluation.questionBreakdown)
      };
    }

    const transcriptTurns = interview.questions.map(q => ({
      order: q.order,
      questionText: q.questionText,
      groundingSource: q.groundingSource,
      transcript: q.answer?.transcript || null,
      createdAt: q.createdAt
    }));

    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        status: interview.status,
        startedAt: interview.startedAt,
        endedAt: interview.endedAt,
        createdAt: interview.createdAt
      },
      candidate: candidateContext.candidate,
      projects: candidateContext.projects,
      evaluation,
      transcript: transcriptTurns
    });

  } catch (error) {
    console.error('Fetch interview results API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve interview results' }, { status: 500 });
  }
}
