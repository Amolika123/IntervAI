'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Volume2, Square, Clock, Sparkles, Send, Bot, User, VolumeX, RefreshCw, AlertCircle, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { SpeechEngine, VoiceState } from '@/lib/voice/speechEngine';

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

  // Session & Voice States
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const [projects, setProjects] = useState<any[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('READY_TO_START');
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [interimSpeechText, setInterimSpeechText] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isEnding, setIsEnding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAccessibilityText, setShowAccessibilityText] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');

  // Transcript & Grounding State
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentQuestionOrder, setCurrentQuestionOrder] = useState<number>(1);
  const [activeGroundingSource, setActiveGroundingSource] = useState<string>('resume:project_1');
  const [openingQuestionText, setOpeningQuestionText] = useState<string>('');

  // Engine References
  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Session Data
  useEffect(() => {
    let isMounted = true;

    const engine = new SpeechEngine({
      onStateChange: (state) => {
        if (isMounted) setVoiceState(state);
      },
      onInterimTranscript: (text) => {
        if (isMounted) setInterimSpeechText(text);
      },
      onFinalTranscript: (finalText) => {
        if (isMounted && finalText.trim().length > 0) {
          handleCandidateFinalAnswer(finalText.trim());
        }
      },
      onError: (msg) => {
        if (isMounted) {
          setErrorMessage(msg);
          setVoiceState('ERROR');
        }
      }
    });

    speechEngineRef.current = engine;

    async function loadInterviewData() {
      try {
        const sessionRes = await fetch('/api/interview/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewId })
        });

        const sessionData = await sessionRes.json();

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

        const p1 = sessionData.candidateContext?.projects?.[0];
        const openingQ = p1
          ? `Hello ${sessionData.candidateContext?.candidate?.name || ''}. Can you walk me through the overall architecture of your ${p1.name} project?`
          : `Hello ${sessionData.candidateContext?.candidate?.name || ''}. Can you walk me through your primary technical project listed on your resume?`;

        const openingSrc = p1 ? `project:${p1.name}:${p1.contextSource}` : 'resume:project_overview';

        if (isMounted) {
          setOpeningQuestionText(openingQ);
          setActiveGroundingSource(openingSrc);
          setTranscript([
            { order: 1, speaker: 'AI', text: openingQ, groundingSource: openingSrc }
          ]);
        }
      } catch (e) {
        console.error('Failed to load session data:', e);
        if (isMounted) {
          setErrorMessage('Failed to connect to interview session.');
          setVoiceState('ERROR');
        }
      }
    }

    loadInterviewData();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (speechEngineRef.current) speechEngineRef.current.destroy();
    };
  }, [interviewId]);

  // User Gesture Click Handler: Unlocks Audio Context & Starts Spoken AI Voice
  const handleStartVoiceSession = async () => {
    if (!speechEngineRef.current) return;

    // 1. Warm up browser audio context
    speechEngineRef.current.unlockAudioContext();
    setSessionStarted(true);

    // 2. Request Microphone Access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.warn('Microphone permission denied:', err);
      setMicGranted(false);
    }

    // 3. Start Timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    // 4. Speak Opening Question Aloud
    await speechEngineRef.current.speakAIQuestion(openingQuestionText);
  };

  // Candidate Final Answer Handler (VAD auto-submit or manual click)
  const handleCandidateFinalAnswer = async (answerText: string) => {
    if (!answerText.trim()) return;

    setVoiceState('PROCESSING_ANSWER');
    setInterimSpeechText('');

    const lastAiTurn = [...transcript].reverse().find(t => t.speaker === 'AI');
    const questionText = lastAiTurn ? lastAiTurn.text : 'Grounded project question';

    const currentOrder = currentQuestionOrder;
    setTranscript(prev => [
      ...prev,
      { order: currentOrder, speaker: 'Candidate', text: answerText }
    ]);

    // Save turn asynchronously to backend DB
    try {
      await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          order: currentOrder,
          questionText,
          groundingSource: activeGroundingSource,
          transcript: answerText
        })
      });
    } catch (e) {
      console.error('Failed to persist turn:', e);
    }

    const nextOrder = currentOrder + 1;
    setCurrentQuestionOrder(nextOrder);
    setVoiceState('GENERATING_NEXT_QUESTION');

    // Dynamic Follow-up logic grounded in candidate resume
    setTimeout(async () => {
      let nextQ = '';
      let nextSource = activeGroundingSource;

      const p1 = projects[0];
      const p2 = projects[1];

      if (nextOrder === 2 && p1) {
        nextQ = `Why did you choose the specific architecture and tech stack for ${p1.name}? What trade-offs or alternatives did you consider?`;
        nextSource = `project:${p1.name}:architecture_tradeoffs`;
      } else if (nextOrder === 3 && p1) {
        nextQ = `What happens in ${p1.name} if there's a failure or an edge case during data processing or under heavy traffic load?`;
        nextSource = `project:${p1.name}:failure_edge_cases`;
      } else if (nextOrder === 4 && p2) {
        nextQ = `Moving to another project on your resume, ${p2.name}. Can you walk me through how you implemented its core functionality?`;
        nextSource = `project:${p2.name}:overview`;
      } else {
        nextQ = `How would you evaluate and optimize the scalability or latency of the systems you built?`;
        nextSource = `resume:skills:scalability`;
      }

      setActiveGroundingSource(nextSource);

      setTranscript(prev => [
        ...prev,
        { order: nextOrder, speaker: 'AI', text: nextQ, groundingSource: nextSource }
      ]);

      // Speak Next AI Question Aloud
      if (speechEngineRef.current) {
        await speechEngineRef.current.speakAIQuestion(nextQ);
      }
    }, 800);
  };

  const handleInterruptAI = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stopSpeaking();
      speechEngineRef.current.startListening();
    }
  };

  const handleManualStartListening = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.startListening();
    }
  };

  const handleEndInterview = async () => {
    setIsEnding(true);
    setVoiceState('INTERVIEW_ENDED');
    if (speechEngineRef.current) {
      speechEngineRef.current.destroy();
    }

    try {
      await fetch('/api/interview/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId })
      });
      router.push(`/results/${interviewId}`);
    } catch (e) {
      console.error('Error concluding interview:', e);
      router.push(`/results/${interviewId}`);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVoiceStateBanner = () => {
    switch (voiceState) {
      case 'AI_SPEAKING':
        return { label: 'IntervAI is speaking question aloud...', color: 'var(--accent-cyan)', icon: <Volume2 size={20} /> };
      case 'LISTENING':
        return { label: 'Listening to you... Speak your answer into microphone', color: '#22c55e', icon: <Mic size={20} /> };
      case 'PROCESSING_ANSWER':
        return { label: 'Analyzing candidate answer...', color: 'var(--accent-purple)', icon: <RefreshCw size={20} className="spin" /> };
      case 'GENERATING_NEXT_QUESTION':
        return { label: 'Formulating next grounded follow-up question...', color: 'var(--accent-indigo)', icon: <Sparkles size={20} /> };
      case 'ERROR':
        return { label: errorMessage || 'Microphone error', color: '#f87171', icon: <AlertCircle size={20} /> };
      default:
        return { label: 'Ready to Start Voice Session', color: 'var(--accent-indigo)', icon: <Play size={20} /> };
    }
  };

  const stateBanner = renderVoiceStateBanner();

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Navigation Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: stateBanner.color,
            boxShadow: `0 0 12px ${stateBanner.color}`
          }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Live Voice Technical Interview <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {candidateName}</span>
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

      {/* Main Interactive Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', flex: 1 }}>
        
        {/* Left Column: Voice Orb & Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI Voice Avatar Orb Panel */}
          <div className="glass-panel" style={{ padding: '2.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            
            {/* Start Voice Session Overlay if not started */}
            {!sessionStarted ? (
              <div style={{ padding: '1rem 0' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto',
                  boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)'
                }}>
                  <Volume2 size={44} color="#ffffff" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  Ready to Start Technical Voice Interview
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                  Click below to authorize audio playback and microphone input. The AI will speak the first question aloud.
                </p>
                <button onClick={handleStartVoiceSession} className="btn-primary" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>
                  <Play size={20} />
                  <span>Start Voice Session Now</span>
                </button>
              </div>
            ) : (
              <>
                {/* Animated Glowing Voice Orb */}
                <div 
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    background: voiceState === 'AI_SPEAKING' ? 'var(--gradient-primary)' : voiceState === 'LISTENING' ? 'linear-gradient(135deg, #22c55e, #10b981)' : 'var(--bg-surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto',
                    border: '3px solid var(--border-highlight)',
                    transition: 'all 0.4s ease',
                    boxShadow: voiceState === 'AI_SPEAKING' ? '0 0 35px rgba(99, 102, 241, 0.5)' : voiceState === 'LISTENING' ? '0 0 35px rgba(34, 197, 94, 0.5)' : 'none'
                  }} 
                  className={voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING' ? 'voice-pulse-active' : ''}
                >
                  {voiceState === 'LISTENING' ? (
                    <Mic size={52} color="#ffffff" />
                  ) : (
                    <Bot size={52} color={voiceState === 'AI_SPEAKING' ? '#ffffff' : 'var(--accent-indigo)'} />
                  )}
                </div>

                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                  Interv<span className="gradient-text">AI</span> Voice Interviewer
                </h3>

                {/* Voice State Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '25px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${stateBanner.color}`,
                  color: stateBanner.color,
                  fontSize: '0.925rem',
                  fontWeight: 700,
                  marginBottom: '1rem'
                }}>
                  {stateBanner.icon}
                  <span>{stateBanner.label}</span>
                </div>

                {/* Frequency Spectrum Waveform */}
                {(voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING') && (
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', height: '36px' }}>
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                  </div>
                )}

                {/* Candidate Interim Live Speech View */}
                {voiceState === 'LISTENING' && interimSpeechText && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: '#22c55e',
                    fontSize: '0.95rem',
                    fontStyle: 'italic',
                    maxWidth: '600px',
                    margin: '1rem auto 0 auto'
                  }}>
                    "{interimSpeechText}"
                  </div>
                )}

                {/* Action controls: Interrupt / Re-listen */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '1.25rem' }}>
                  {voiceState === 'AI_SPEAKING' && (
                    <button onClick={handleInterruptAI} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                      <VolumeX size={16} />
                      <span>Interrupt AI & Answer</span>
                    </button>
                  )}
                  {voiceState !== 'AI_SPEAKING' && voiceState !== 'LISTENING' && (
                    <button onClick={handleManualStartListening} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                      <Mic size={16} color="#22c55e" />
                      <span>Tap to Speak</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Live Transcript Stream Panel */}
          <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', maxHeight: '380px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Verified Interview Transcript</span>
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

            {/* Accessibility Manual Text Input Fallback (Accordion) */}
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setShowAccessibilityText(!showAccessibilityText)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {showAccessibilityText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Text Fallback (For debugging / accessibility)</span>
              </button>

              {showAccessibilityText && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type answer manually if microphone unavailable..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualText.trim()) {
                        handleCandidateFinalAnswer(manualText);
                        setManualText('');
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (manualText.trim()) {
                        handleCandidateFinalAnswer(manualText);
                        setManualText('');
                      }
                    }}
                    className="btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <Send size={14} />
                    <span>Submit</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Sidebar: Context & Voice Status */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            Voice Control & Context
          </h4>

          {/* Microphone Status Card */}
          <div style={{ padding: '12px', borderRadius: '10px', background: micGranted ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${micGranted ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '0.9rem', color: micGranted ? '#22c55e' : '#f87171' }}>
              {micGranted ? <Mic size={18} /> : <MicOff size={18} />}
              <span>{micGranted ? 'MICROPHONE ACTIVE' : 'MICROPHONE DISABLED'}</span>
            </div>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {micGranted ? 'Automatic VAD turns speech into answer when you finish.' : 'Click Start Voice Session to activate microphone.'}
            </p>
          </div>

          {/* Grounded Projects List */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Grounded Resume Context
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
            <span>AI speaks every question. Speak your answer into the microphone.</span>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
