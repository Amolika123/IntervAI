import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildInterviewerSystemPrompt } from '@/lib/interviewer/systemPrompt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { interviewId } = body;

    if (!interviewId) {
      return NextResponse.json({ error: 'interviewId is required' }, { status: 400 });
    }

    const interview = await db.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const candidateContext = JSON.parse(interview.candidateContext);
    const systemPrompt = buildInterviewerSystemPrompt(candidateContext);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Mock session for local development without OpenAI Realtime key
      return NextResponse.json({
        success: true,
        mockMode: true,
        clientSecret: 'mock_ephemeral_token_dev',
        systemInstructions: systemPrompt,
        candidateContext
      });
    }

    // Call official OpenAI Realtime Ephemeral Session Creation API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse',
        instructions: systemPrompt,
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Realtime Session creation error:', errText);
      return NextResponse.json({
        success: false,
        error: 'Failed to create OpenAI Realtime session',
        details: errText
      }, { status: 500 });
    }

    const sessionData = await response.json();

    // Update interview status to IN_PROGRESS
    await db.interview.update({
      where: { id: interviewId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      clientSecret: sessionData.client_secret?.value || sessionData.id,
      sessionData,
      systemInstructions: systemPrompt,
      candidateContext
    });

  } catch (error) {
    console.error('Session generation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
