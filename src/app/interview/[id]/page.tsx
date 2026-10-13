'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  Clock,
  Sparkles,
  Send,
  Bot,
  User,
  VolumeX,
  RefreshCw,
  AlertCircle,
  Play,
  ChevronDown,
  ChevronUp,
  Code2,
  Zap,
  Building2
} from 'lucide-react';
import { SpeechEngine, VoiceState } from '@/lib/voice/speechEngine';
import { INTERVIEW_STYLES, InterviewStyleId } from '@/lib/interviewer/styles';

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
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyleId>('FAANG');
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

        const resolvedStyle: InterviewStyleId =
          sessionData.style && sessionData.style in INTERVIEW_STYLES
            ? (sessionData.style as InterviewStyleId)
            : 'FAANG';

        if (isMounted) {
          setInterviewStyle(resolvedStyle);
        }

        const name = sessionData.candidateContext?.candidate?.name || 'Candidate';
        if (sessionData.candidateContext?.candidate?.name) {
          setCandidateName(name);
        }

        let pList: any[] = [];
        if (sessionData.candidateContext?.projects) {
          pList = sessionData.candidateContext.projects;
          setProjects(pList);
          const firstProj = pList[0];
          if (firstProj) {
            setActiveGroundingSource(`project:${firstProj.name}:${firstProj.contextSource}`);
          }
        }

        const p1 = pList[0];
        let openingQ = '';

        if (resolvedStyle === 'FAANG') {
          openingQ = p1
            ? `Hello ${name}. Let's dive into ${p1.name}. Can you walk me through the core implementation details and the primary data structures you used?`
            : `Hello ${name}. Can you walk me through the primary technical project on your resume, focusing on your implementation choices and data structures?`;
        } else if (resolvedStyle === 'MANGOS') {
          openingQ = p1
            ? `Hello ${name}. Let's discuss ${p1.name}. Can you walk me through the high-level architecture and the fundamental design trade-offs you made?`
            : `Hello ${name}. Can you walk me through your primary technical project on your resume and the architectural decisions behind it?`;
        } else {
          // BIG_4
          openingQ = p1
            ? `Hello ${name}. Let's examine ${p1.name}. Can you walk me through its practical implementation, focusing on your APIs, databases, and application architecture?`
            : `Hello ${name}. Can you walk me through your primary technical project, focusing on your practical engineering decisions and database/API design?`;
        }

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

    speechEngineRef.current.unlockAudioContext();
    setSessionStarted(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn('Microphone permission denied:', err);
      setMicGranted(false);
    }

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    await speechEngineRef.current.speakAIQuestion(openingQuestionText);
  };

  // Candidate Final Answer Handler (VAD auto-submit or manual click)
  const handleCandidateFinalAnswer = async (answerText: string) => {
    if (!answerText.trim()) return;

    setVoiceState('PROCESSING_ANSWER');
    setInterimSpeechText('');

    const lastAiTurn = [...transcript].reverse().find((t) => t.speaker === 'AI');
    const questionText = lastAiTurn ? lastAiTurn.text : 'Grounded project question';

    const currentOrder = currentQuestionOrder;
    setTranscript((prev) => [
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

    // Dynamic Style-Grounded Follow-up logic
    setTimeout(async () => {
      let nextQ = '';
      let nextSource = activeGroundingSource;

      const p1 = projects[0];
      const p2 = projects[1];

      if (interviewStyle === 'FAANG') {
        if (nextOrder === 2 && p1) {
          nextQ = `In ${p1.name}, what were the main computational or memory bottlenecks, and how did you analyze the algorithmic complexity (time and space)?`;
          nextSource = `project:${p1.name}:algorithms_complexity`;
        } else if (nextOrder === 3 && p1) {
          nextQ = `What edge cases, boundary inputs, or malformed data did you account for in ${p1.name}, and how did your implementation handle unexpected inputs?`;
          nextSource = `project:${p1.name}:edge_cases_and_boundaries`;
        } else if (nextOrder === 4 && p2) {
          nextQ = `Moving to another project on your resume, ${p2.name}. Walk me through how you structured its data flow and optimized its runtime performance.`;
          nextSource = `project:${p2.name}:performance_optimization`;
        } else {
          nextQ = `How would you evaluate and optimize the algorithmic efficiency and resource utilization across the systems you built?`;
          nextSource = `resume:skills:computational_efficiency`;
        }
      } else if (interviewStyle === 'MANGOS') {
        if (nextOrder === 2 && p1) {
          nextQ = `Why did you choose this specific system architecture and model/component stack for ${p1.name} over other viable architectural alternatives?`;
          nextSource = `project:${p1.name}:architecture_tradeoffs`;
        } else if (nextOrder === 3 && p1) {
          nextQ = `In a production failure scenario—such as an upstream dependency timeout, rate limit, or corrupted data—how does ${p1.name} respond, and how would you evaluate its robustness?`;
          nextSource = `project:${p1.name}:failure_scenarios_and_fault_tolerance`;
        } else if (nextOrder === 4 && p2) {
          nextQ = `Looking at another project on your resume, ${p2.name}. What were the primary architectural trade-offs, and how does it scale under heavy distributed load?`;
          nextSource = `project:${p2.name}:distributed_scalability`;
        } else {
          nextQ = `How would you evaluate and optimize the system scalability, memory constraints, or latency trade-offs of the architectures you built?`;
          nextSource = `resume:skills:system_tradeoffs`;
        }
      } else {
        // BIG_4
        if (nextOrder === 2 && p1) {
          nextQ = `How did you design the database schemas, query indexing, and API contracts in ${p1.name} to ensure data consistency and reliability?`;
          nextSource = `project:${p1.name}:database_and_apis`;
        } else if (nextOrder === 3 && p1) {
          nextQ = `When debugging complex issues or synchronization errors in ${p1.name}, what logging, monitoring, and troubleshooting strategies did you use?`;
          nextSource = `project:${p1.name}:debugging_and_observability`;
        } else if (nextOrder === 4 && p2) {
          nextQ = `Moving to another project on your resume, ${p2.name}. Can you explain its practical architecture, API endpoints, and database interactions?`;
          nextSource = `project:${p2.name}:practical_engineering`;
        } else {
          nextQ = `How would you address real-world enterprise constraints—such as security standards, auditability, and maintaining high uptime SLAs—in these systems?`;
          nextSource = `resume:skills:enterprise_constraints`;
        }
      }

      setActiveGroundingSource(nextSource);

      setTranscript((prev) => [
        ...prev,
        { order: nextOrder, speaker: 'AI', text: nextQ, groundingSource: nextSource }
      ]);

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

  const currentStyleConfig = INTERVIEW_STYLES[interviewStyle] || INTERVIEW_STYLES.FAANG;

  const renderVoiceStateBanner = () => {
    switch (voiceState) {
      case 'AI_SPEAKING':
        return { label: `IntervAI is speaking (${currentStyleConfig.name} style)...`, color: currentStyleConfig.color, icon: <Volume2 size={20} /> };
      case 'LISTENING':
        return { label: 'Listening to you... Speak your answer into microphone', color: '#22c55e', icon: <Mic size={20} /> };
      case 'PROCESSING_ANSWER':
        return { label: 'Analyzing candidate answer...', color: 'var(--accent-purple)', icon: <RefreshCw size={20} className="spin" /> };
      case 'GENERATING_NEXT_QUESTION':
        return { label: `Formulating ${currentStyleConfig.name} follow-up question...`, color: 'var(--accent-indigo)', icon: <Sparkles size={20} /> };
      case 'ERROR':
        return { label: errorMessage || 'Microphone error', color: '#f87171', icon: <AlertCircle size={20} /> };
      default:
        return { label: `Ready to Start (${currentStyleConfig.name} Style)`, color: currentStyleConfig.color, icon: <Play size={20} /> };
    }
  };

  const stateBanner = renderVoiceStateBanner();

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Navigation Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

          {/* Active Style Badge in Header */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: `${currentStyleConfig.color}15`,
            border: `1px solid ${currentStyleConfig.color}40`,
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: currentStyleConfig.color
          }}>
            {interviewStyle === 'FAANG' && <Code2 size={13} />}
            {interviewStyle === 'MANGOS' && <Zap size={13} />}
            {interviewStyle === 'BIG_4' && <Building2 size={13} />}
            <span>{currentStyleConfig.name} Style</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
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
                  Ready to Start {currentStyleConfig.name} Voice Interview
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
                  Preset: <strong>{currentStyleConfig.name}</strong> ({currentStyleConfig.companies.join(', ')}). Click below to authorize audio playback and microphone input.
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
                    border: `3px solid ${currentStyleConfig.color}60`,
                    transition: 'all 0.4s ease',
                    boxShadow: voiceState === 'AI_SPEAKING' ? `0 0 35px ${currentStyleConfig.color}60` : voiceState === 'LISTENING' ? '0 0 35px rgba(34, 197, 94, 0.5)' : 'none'
                  }} 
                  className={voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING' ? 'voice-pulse-active' : ''}
                >
                  {voiceState === 'LISTENING' ? (
                    <Mic size={52} color="#ffffff" />
                  ) : (
                    <Bot size={52} color={voiceState === 'AI_SPEAKING' ? '#ffffff' : currentStyleConfig.color} />
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
              <span style={{ color: currentStyleConfig.color, fontSize: '0.75rem', textTransform: 'none', fontWeight: 700 }}>
                {currentStyleConfig.name} Probing
              </span>
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
                      {turn.speaker === 'AI' ? `IntervAI (${currentStyleConfig.name})` : candidateName}
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
            Interview Control & Context
          </h4>

          {/* Active Style Details Card */}
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: `${currentStyleConfig.color}10`,
            border: `1px solid ${currentStyleConfig.color}35`
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>
              Selected Style Preset
            </div>
            <div style={{ fontWeight: 800, color: currentStyleConfig.color, fontSize: '1rem' }}>
              {currentStyleConfig.name} • {currentStyleConfig.badge}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {currentStyleConfig.companies.join(', ')}
            </div>
          </div>

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
            <span>AI speaks every question. Questions probe deeply according to {currentStyleConfig.name} interview patterns.</span>
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
