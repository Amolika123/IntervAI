import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateInterviewEvaluation } from '@/lib/evaluation/evaluator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { interviewId } = body;

    if (!interviewId) {
      return NextResponse.json({ error: 'interviewId is required' }, { status: 400 });
    }

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: {
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
    const candidateName = candidateContext.candidate?.name || 'Candidate';

    const turns = interview.questions
      .filter(q => q.answer !== null)
      .map(q => ({
        order: q.order,
        questionText: q.questionText,
        groundingSource: q.groundingSource,
        transcript: q.answer!.transcript
      }));

    // Generate AI evaluation
    const evalData = await generateInterviewEvaluation(candidateName, candidateContext, turns);

    // Save evaluation record to DB
    const evaluation = await db.evaluation.upsert({
      where: { interviewId },
      create: {
        interviewId,
        overallScore: Math.round(evalData.overallScore),
        overallAssessment: evalData.overallAssessment,
        strengths: JSON.stringify(evalData.strengths),
        areasToImprove: JSON.stringify(evalData.areasToImprove),
        questionBreakdown: JSON.stringify(evalData.questionBreakdown)
      },
      update: {
        overallScore: Math.round(evalData.overallScore),
        overallAssessment: evalData.overallAssessment,
        strengths: JSON.stringify(evalData.strengths),
        areasToImprove: JSON.stringify(evalData.areasToImprove),
        questionBreakdown: JSON.stringify(evalData.questionBreakdown)
      }
    });

    // Update interview status
    await db.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      evaluationId: evaluation.id,
      overallScore: evaluation.overallScore
    });

  } catch (error) {
    console.error('Finalize interview API error:', error);
    return NextResponse.json({ error: 'Failed to finalize interview evaluation' }, { status: 500 });
  }
}
