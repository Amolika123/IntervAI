'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Volume2, Square, Clock, ShieldCheck, Sparkles, Send, Bot, User, CheckCircle } from 'lucide-react';

interface LiveInterviewProps {
  params: Promise<{ id: string }>;
}

interface TranscriptTurn {
  order: number;
  speaker: 'AI' | 'Candidate';
  text: string;
  groundingSource?: string;
}

export default function LiveInterviewPage({ params }: LiveInterviewProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;

  // Session & Audio States
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const [projects, setProjects] = useState<any[]>([]);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isEnding, setIsEnding] = useState<boolean>(false);
  const [mockMode, setMockMode] = useState<boolean>(false);
  const [simulatedText, setSimulatedText] = useState<string>('');

  // Transcript Turns
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentQuestionOrder, setCurrentQuestionOrder] = useState<number>(1);
  const [activeGroundingSource, setActiveGroundingSource] = useState<string>('resume:project_1');

  // PeerConnection & Audio References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Session
  useEffect(() => {
    let isMounted = true;

    async function setupSession() {
      try {
        // Request microphone permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;
          if (isMounted) setMicGranted(true);
        } catch (err) {
          console.warn('Microphone access denied or not available:', err);
          if (isMounted) setMicGranted(false);
        }

        // Request WebRTC Ephemeral Session from API
        const sessionRes = await fetch('/api/interview/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewId })
        });

        const sessionData = await sessionRes.json();

        if (!sessionRes.ok || !sessionData.success) {
          console.warn('Session API returned non-200 or mock mode:', sessionData);
        }

        if (sessionData.candidateContext?.candidate?.name) {
          setCandidateName(sessionData.candidateContext.candidate.name);
        }
        if (sessionData.candidateContext?.projects) {
          setProjects(sessionData.candidateContext.projects);
          const firstProj = sessionData.candidateContext.projects[0];
          if (firstProj) {
            setActiveGroundingSource(`project:${firstProj.name}:${firstProj.contextSource}`);
          }
        }

        if (sessionData.mockMode) {
          setMockMode(true);
          // Pre-populate initial opening question from system prompt
          const initialQ = sessionData.candidateContext?.projects?.[0]
            ? `Can you walk me through the overall architecture of your ${sessionData.candidateContext.projects[0].name} project?`
            : `Can you walk me through your primary technical project listed on your resume?`;

          setTranscript([
            { order: 1, speaker: 'AI', text: initialQ, groundingSource: 'project:overview' }
          ]);
        } else if (sessionData.clientSecret && process.env.NEXT_PUBLIC_ENABLE_WEBRTC) {
          // Initialize Realtime WebRTC Peer Connection
          await initializeWebRTC(sessionData.clientSecret, sessionData.systemInstructions);
        } else {
          // Default browser preview mode
          setMockMode(true);
          const initialQ = sessionData.candidateContext?.projects?.[0]
            ? `Can you walk me through the architecture of your ${sessionData.candidateContext.projects[0].name} project?`
            : `Can you walk me through your primary technical project?`;

          setTranscript([
            { order: 1, speaker: 'AI', text: initialQ, groundingSource: 'project:overview' }
          ]);
        }

        // Start Elapsed Timer
        timerRef.current = setInterval(() => {
          setElapsedSeconds(prev => prev + 1);
        }, 1000);

      } catch (e) {
        console.error('Failed to setup interview voice session:', e);
      }
    }

    setupSession();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [interviewId]);

  // WebRTC Setup helper
  const initializeWebRTC = async (ephemeralKey: string, instructions: string) => {
    try {
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Remote Audio Output Element
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      pc.ontrack = e => {
        audioEl.srcObject = e.streams[0];
        setIsAiSpeaking(true);
      };

      // Add local audio tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => pc.addTrack(track, audioStreamRef.current!));
      }

      // Create Data Channel for Realtime transcript & event sync
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === 'response.audio_transcript.delta') {
          setIsAiSpeaking(true);
        } else if (event.type === 'response.audio_transcript.done') {
          setIsAiSpeaking(false);
          // Record AI turn
          if (event.transcript) {
            setTranscript(prev => [...prev, {
              order: currentQuestionOrder,
              speaker: 'AI',
              text: event.transcript,
              groundingSource: activeGroundingSource
            }]);
          }
        } else if (event.type === 'input_audio_buffer.speech_started') {
          setIsCandidateSpeaking(true);
        } else if (event.type === 'input_audio_buffer.speech_stopped') {
          setIsCandidateSpeaking(false);
        }
      };

      // Create WebRTC Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const sdpResponse = await fetch(`${baseUrl}?model=gpt-4o-realtime-preview-2024-12-17`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });

      const answerSDP = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSDP });

    } catch (e) {
      console.error('WebRTC initialization error:', e);
      setMockMode(true);
    }
  };

  // Persist turn to DB and handle follow-up question generation in preview mode
  const handleCandidateResponse = async (answerText: string) => {
    if (!answerText.trim()) return;

    const lastAiTurn = [...transcript].reverse().find(t => t.speaker === 'AI');
    const questionText = lastAiTurn ? lastAiTurn.text : 'Grounded project question';

    // Append Candidate turn to UI
    const updatedTranscript: TranscriptTurn[] = [
      ...transcript,
      { order: currentQuestionOrder, speaker: 'Candidate', text: answerText }
    ];
    setTranscript(updatedTranscript);
    setSimulatedText('');
    setIsCandidateSpeaking(false);

    // Save turn asynchronously to DB
    try {
      await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          order: currentQuestionOrder,
          questionText,
          groundingSource: activeGroundingSource,
          transcript: answerText
        })
      });
    } catch (e) {
      console.error('Failed to persist turn:', e);
    }

    // Determine adaptive next grounded question
    const nextOrder = currentQuestionOrder + 1;
    setCurrentQuestionOrder(nextOrder);

    // Dynamic Follow-up logic
    setTimeout(() => {
      let nextQ = '';
      let nextSource = activeGroundingSource;

      const p1 = projects[0];
      const p2 = projects[1];

      if (nextOrder === 2 && p1) {
        nextQ = `Why did you choose the specific architecture and tech stack for ${p1.name}? What alternatives did you consider?`;
        nextSource = `project:${p1.name}:architecture_tradeoffs`;
      } else if (nextOrder === 3 && p1) {
        nextQ = `What happens in ${p1.name} if there's a failure or an edge case during document retrieval or high concurrent load?`;
        nextSource = `project:${p1.name}:failure_edge_cases`;
      } else if (nextOrder === 4 && p2) {
        nextQ = `Moving to another project on your resume, ${p2.name}. Can you walk me through how you implemented it?`;
        nextSource = `project:${p2.name}:overview`;
      } else {
        nextQ = `How would you measure and optimize the scalability or query latency of the systems you built?`;
        nextSource = `resume:skills:scalability`;
      }

      setActiveGroundingSource(nextSource);
      setTranscript(prev => [
        ...prev,
        { order: nextOrder, speaker: 'AI', text: nextQ, groundingSource: nextSource }
      ]);
    }, 600);
  };

  const handleEndInterview = async () => {
    setIsEnding(true);
    try {
      // Finalize session in DB & trigger Evaluation Engine
      const endRes = await fetch('/api/interview/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId })
      });

      const endData = await endRes.json();
      router.push(`/results/${interviewId}`);
    } catch (e) {
      console.error('Error ending interview:', e);
      router.push(`/results/${interviewId}`);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Navigation / Status Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isAiSpeaking ? 'var(--accent-cyan)' : isCandidateSpeaking ? 'var(--accent-pink)' : '#22c55e',
            boxShadow: '0 0 12px #22c55e'
          }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Live Technical Interview <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {candidateName}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem' }}>
            <Clock size={16} color="var(--accent-indigo)" />
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatTimer(elapsedSeconds)}</span>
          </div>

          <button onClick={handleEndInterview} disabled={isEnding} className="btn-danger">
            <Square size={16} />
            <span>{isEnding ? 'Finalizing Evaluation...' : 'End Interview'}</span>
          </button>
        </div>
      </header>

      {/* Main Voice Interactive Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', flex: 1 }}>
        {/* Left Column: Visualizer & Live Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Avatar / Speaker Indicator Panel */}
          <div className="glass-panel" style={{ padding: '2.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: isAiSpeaking ? 'var(--gradient-primary)' : 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              border: '2px solid var(--border-highlight)',
              transition: 'all 0.4s ease'
            }} className={isAiSpeaking ? 'voice-pulse-active' : ''}>
              <Bot size={48} color={isAiSpeaking ? '#ffffff' : 'var(--accent-indigo)'} />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              Interv<span className="gradient-text">AI</span> Lead Interviewer
            </h3>
            
            <p style={{ color: isAiSpeaking ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontSize: '0.925rem', fontWeight: 600 }}>
              {isAiSpeaking ? 'Speaking grounded technical question...' : isCandidateSpeaking ? 'Listening to candidate response...' : 'Waiting for candidate input...'}
            </p>

            {/* Audio Waveform visualization */}
            {(isAiSpeaking || isCandidateSpeaking) && (
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', height: '40px', marginTop: '1rem' }}>
                <div className="wave-bar" />
                <div className="wave-bar" />
                <div className="wave-bar" />
                <div className="wave-bar" />
                <div className="wave-bar" />
              </div>
            )}
          </div>

          {/* Live Grounded Transcript Stream */}
          <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', maxHeight: '420px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Live Interview Transcript</span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', textTransform: 'none' }}>Grounding Enforced</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '6px' }}>
              {transcript.map((turn, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  gap: '12px',
                  alignSelf: turn.speaker === 'AI' ? 'flex-start' : 'flex-end',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: turn.speaker === 'AI' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {turn.speaker === 'AI' ? <Bot size={18} color="var(--accent-indigo)" /> : <User size={18} color="var(--accent-pink)" />}
                  </div>

                  <div style={{
                    background: turn.speaker === 'AI' ? 'var(--bg-surface-elevated)' : 'rgba(236, 72, 153, 0.08)',
                    border: '1px solid var(--border-color)',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    fontSize: '0.925rem'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.75rem', color: turn.speaker === 'AI' ? 'var(--accent-indigo)' : 'var(--accent-pink)', marginBottom: '4px' }}>
                      {turn.speaker === 'AI' ? 'IntervAI Lead' : candidateName}
                    </div>
                    <div>{turn.text}</div>
                    {turn.groundingSource && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                        Source: {turn.groundingSource}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Candidate Voice Input / Simulation Bar */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder={micGranted ? "Speak into microphone or type response here..." : "Type your answer..."}
                value={simulatedText}
                onChange={(e) => setSimulatedText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && simulatedText.trim()) {
                    handleCandidateResponse(simulatedText);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => handleCandidateResponse(simulatedText)}
                disabled={!simulatedText.trim()}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.875rem' }}
              >
                <Send size={16} />
                <span>Submit Answer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Grounded Context Dossier sidebar */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            Candidate Context Dossier
          </h4>

          {/* Mic Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: micGranted ? '#22c55e' : 'var(--text-muted)' }}>
            {micGranted ? <Mic size={18} color="#22c55e" /> : <MicOff size={18} color="#f87171" />}
            <span>{micGranted ? 'Microphone Active' : 'Voice Simulated Mode'}</span>
          </div>

          {/* Active Projects List */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Grounded Projects ({projects.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projects.map((proj, i) => (
                <div key={i} style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{proj.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Source: {proj.contextSource}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', padding: '10px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Sparkles size={14} color="var(--accent-indigo)" style={{ display: 'inline', marginRight: '6px' }} />
            <span>Questions probe deeply into your actual resume claims, implementation, trade-offs, and edge cases.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
